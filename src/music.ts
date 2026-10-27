import {loadSettings,saveSettings} from './preferences.mjs';
import {championTracks,failureTrack,cheaterTrack,countdownTracks,radioTracks,DEFAULT_RADIO_TRACK,nextRadioTrack} from './radio-playlist.mjs';
/** Stream only the selected owner-supplied MP3; no decoding/caching the whole playlist. */
export class MusicRadio{
 audio=document.createElement('audio');
 private standby=document.createElement('audio');
 get elements(){return [this.audio,this.standby];}
 private deckGains=new Map<HTMLAudioElement,GainNode>();
 private fade?:{outgoing:HTMLAudioElement;elapsed:number;last:number;ready:boolean};
 private fadeTimer?:ReturnType<typeof setInterval>;
 countdown=false;countdownSelected=0;selected=DEFAULT_RADIO_TRACK;enabled=true;volume=.75;muted=false;error='';
 outcome:null|'success'|'failure'|'cheater'=null;championSelected=0;private ended=false;
 private leadInTimer?:ReturnType<typeof setTimeout>;
 private clearLeadIn(){if(this.leadInTimer!==undefined)clearTimeout(this.leadInTimer);this.leadInTimer=undefined;this.holds.delete('voice-lead-in');}
 private running=false;private context?:AudioContext;private gain?:GainNode;
 private holds=new Set<string>();private version=0;
 private listeners=new Set<()=>void>();
 constructor(){
  const settings=loadSettings();this.selected=settings.track;this.countdownSelected=settings.countdownTrack;this.championSelected=settings.championTrack;this.volume=settings.volume;this.enabled=settings.musicEnabled;this.muted=settings.muted;
  for(const element of this.elements){
   element.hidden=true;element.preload='none';element.loop=true;
   element.addEventListener('ended',()=>{if(element===this.audio&&this.outcome==='cheater'){this.ended=true;this.notify();}});
   for(const event of ['playing','pause','waiting','canplay'])element.addEventListener(event,()=>this.notify());
   element.addEventListener('error',()=>{if(element===this.audio){this.error='Track unavailable — choose another';this.notify();}});
  }
  this.audio.id='radio-audio';this.standby.id='radio-audio-standby';this.audio.src=this.trackUrl();this.prepareCountdown();
 }
 private trackUrl(){return new URL(`./audio/music/${this.track.file}`,document.baseURI).href;}
 attach(context:AudioContext,master:GainNode){
  if(this.context)return;this.context=context;
  this.gain=context.createGain();this.gain.connect(master);
  for(const element of this.elements){const level=context.createGain();level.gain.value=element===this.audio?1:0;level.connect(this.gain);context.createMediaElementSource(element).connect(level);this.deckGains.set(element,level);}
  this.updateGain();this.refresh();
 }
 private prepareCountdown(){
  if(this.countdown||this.outcome)return;
  this.standby.preload='auto';this.standby.src=new URL(`./audio/music/${countdownTracks[this.countdownSelected].file}`,document.baseURI).href;
 }
 private setDeckLevel(element:HTMLAudioElement,value:number,smooth=false){
  const gain=this.deckGains.get(element)?.gain;if(!gain)return;
  if(smooth&&this.context)gain.setTargetAtTime(value,this.context.currentTime,.01);else{if(this.context)gain.cancelScheduledValues(this.context.currentTime);gain.value=value;}
 }
 private cancelFade(){
  if(this.fadeTimer!==undefined)clearInterval(this.fadeTimer);this.fadeTimer=undefined;
  if(this.fade)this.fade.outgoing.pause();this.fade=undefined;
  this.setDeckLevel(this.audio,1);this.setDeckLevel(this.standby,0);
 }
 private tickFade(){
  const fade=this.fade,context=this.context;if(!fade||!context)return;
  const now=context.currentTime,delta=Math.max(0,now-fade.last);fade.last=now;
  if(!fade.ready||context.state!=='running'||this.audio.paused||this.blocked)return;
  fade.elapsed+=delta;
  const progress=Math.min(1,fade.elapsed/1.25);
  this.setDeckLevel(this.audio,progress,true);this.setDeckLevel(fade.outgoing,1-progress,true);
  if(progress===1)this.cancelFade();
 }
 private get blocked(){return !this.enabled||!this.running||[...this.holds].some(reason=>reason!=='scores'||!this.outcome);}
 subscribe(callback:()=>void){this.listeners.add(callback);callback();return()=>this.listeners.delete(callback);}
 private notify(){for(const callback of this.listeners)callback();}
 private updateGain(){if(this.gain&&this.context){this.gain.gain.cancelScheduledValues(this.context.currentTime);this.gain.gain.setTargetAtTime(this.volume,this.context.currentTime,.06);}}
 setMuted(value:boolean){this.muted=value;this.notify();}
 private save(){saveSettings({track:this.selected,countdownTrack:this.countdownSelected,championTrack:this.championSelected,volume:this.volume,musicEnabled:this.enabled});}
 setVolume(value:number){if(!Number.isFinite(value))return;this.volume=Math.max(0,Math.min(1,value));this.updateGain();this.save();this.notify();}
 select(index:number){
  if(this.countdown||this.outcome)return;
  if(!Number.isInteger(index)||index<0||index>=radioTracks.length)return;
  this.version++;this.audio.pause();this.selected=index;this.enabled=true;this.error='';
  this.audio.src=this.trackUrl();this.audio.loop=true;this.save();this.refresh();
 }
 step(direction:number){this.select(nextRadioTrack(this.selected,direction));}
 off(){this.cancelFade();this.enabled=false;this.save();this.refresh();}
 toggle(){if(this.enabled)this.cancelFade();this.enabled=!this.enabled;this.save();this.refresh();}
 beginRun(){this.cancelFade();this.clearLeadIn();this.outcome=null;this.ended=false;this.audio.loop=true;this.countdown=false;this.audio.src=this.trackUrl();this.running=false;this.version++;this.audio.pause();this.audio.currentTime=0;this.holds.clear();this.error='';this.prepareCountdown();this.notify();}
 startRun(){this.running=true;this.refresh();}
 endRun(){this.cancelFade();this.clearLeadIn();this.running=false;this.refresh();}
 setHold(reason:string,value:boolean){
  if(this.holds.has(reason)===value)return;
  if(value)this.holds.add(reason);else this.holds.delete(reason);this.refresh();
 }
 finishRun(outcome:'success'|'failure'|'cheater'){this.cancelFade();this.clearLeadIn();this.outcome=outcome;this.countdown=false;this.ended=false;this.running=true;this.holds.delete('scores');this.version++;this.audio.pause();this.error='';this.audio.src=this.trackUrl();this.audio.loop=outcome!=='cheater';
  if(outcome==='cheater'){this.holds.add('voice-lead-in');this.leadInTimer=setTimeout(()=>{this.leadInTimer=undefined;this.holds.delete('voice-lead-in');this.refresh();},2000);}
  this.refresh();}
 get track(){if(this.outcome==='success')return championTracks[this.championSelected];if(this.outcome==='failure')return failureTrack;if(this.outcome==='cheater')return cheaterTrack;return this.countdown?countdownTracks[this.countdownSelected]:radioTracks[this.selected];}
 toggleCountdownTrack(){if(this.countdown||this.outcome)return;this.countdownSelected=1-this.countdownSelected;this.prepareCountdown();this.save();this.notify();}
 toggleChampionTrack(){if(this.outcome)return;this.championSelected=1-this.championSelected;this.save();this.notify();}
 updateRemaining(seconds:number){
  if(!this.running||this.outcome||this.countdown||seconds>30||seconds<=0)return;
  const outgoing=this.audio,canBlend=!this.blocked&&!outgoing.paused&&this.context?.state==='running';
  this.countdown=true;this.version++;this.error='';
  if(canBlend){
   this.audio=this.standby;this.standby=outgoing;this.audio.id='radio-audio';outgoing.id='radio-audio-outgoing';
   this.audio.currentTime=0;this.audio.loop=true;this.setDeckLevel(this.audio,0);
   this.fade={outgoing,elapsed:0,last:this.context!.currentTime,ready:false};
   this.fadeTimer=setInterval(()=>this.tickFade(),16);
  }else{outgoing.pause();this.audio.src=this.trackUrl();this.audio.loop=true;}
  this.refresh();
 }
 get status(){
  if(this.countdown)return 'Hurry, wrap it up or die!';
  if(!this.enabled)return 'Music off';
  if(this.error)return this.error;
  if(!this.running)return 'Starts after intro';
  if(this.holds.has('voice-lead-in'))return 'Voice first · music starts shortly';
  if([...this.holds].some(reason=>reason!=='scores'||!this.outcome))return 'Paused';
  if(this.ended)return 'Finished';
  if(this.muted)return 'Sound muted';
  if(this.volume===0)return 'Music volume 0%';
  if(!this.context||this.context.state!=='running')return 'Click or press a key to enable audio';
  return this.audio.paused?'Ready — click game to enable audio':'Playing';
 }
 refresh(){
  if(this.ended){this.notify();return;}
  if(this.blocked){this.version++;this.audio.pause();this.fade?.outgoing.pause();if(this.fade&&this.context)this.fade.last=this.context.currentTime;this.notify();return;}
  if(this.fade&&this.context?.state==='running'&&this.fade.outgoing.paused)void this.fade.outgoing.play().catch(()=>{});
  if(this.context?.state==='running'&&this.audio.paused){
   const version=++this.version,element=this.audio;
   void element.play().then(()=>{if(version===this.version){this.error='';if(this.fade){this.fade.ready=true;this.fade.last=this.context!.currentTime;}this.notify();}}).catch(()=>{if(version===this.version){this.error='Click game or select track to enable music';this.notify();}});
  }
  this.notify();
 }
}
