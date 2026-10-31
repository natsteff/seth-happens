import {jukeboxTracks,DEFAULT_JUKEBOX_TRACK} from './afterparty-model.mjs';

/** One streamed track and one gain node; never preload/decode the entire catalogue.
 * The separate context can play while the gameplay context remains suspended. */
export class JukeboxAudio{
 readonly audio=document.createElement('audio');
 selected=DEFAULT_JUKEBOX_TRACK;enabled=true;muted=false;volume=.75;error='';
 private context?:AudioContext;private gain?:GainNode;private active=false;private version=0;
 onchange=()=>{};
 constructor(){
  this.audio.preload='none';this.audio.loop=true;
  this.audio.addEventListener('error',()=>{this.error='Track unavailable — choose another';this.onchange();});
  for(const event of ['playing','pause','waiting'])this.audio.addEventListener(event,()=>this.onchange());
 }
 open({enabled,muted,volume}:{enabled:boolean;muted:boolean;volume:number}){
  this.active=true;this.enabled=enabled;this.muted=muted;this.volume=volume;
  this.select(DEFAULT_JUKEBOX_TRACK);
 }
 private unlock(){
  if(!this.context){
   this.context=new AudioContext();this.gain=this.context.createGain();
   this.context.createMediaElementSource(this.audio).connect(this.gain);this.gain.connect(this.context.destination);
  }
  if(this.context.state==='suspended')void this.context.resume().catch(()=>{this.error='Tap Play to enable music';this.onchange();});
 }
 select(index:number){
  if(!Number.isInteger(index)||index<0||index>=jukeboxTracks.length)return;
  this.version++;this.audio.pause();this.selected=index;this.error='';
  this.audio.src=new URL(`./audio/music/${jukeboxTracks[index].file}`,document.baseURI).href;
  this.refresh();
 }
 refresh(){
  const version=++this.version;
  if(!this.active||!this.enabled||this.muted||document.hidden){this.audio.pause();this.onchange();return;}
  this.unlock();
  if(this.gain)this.gain.gain.value=this.volume;
  void this.audio.play().then(()=>{if(version===this.version){this.error='';this.onchange();}}).catch(()=>{if(version===this.version){this.error='Tap Play to enable music';this.onchange();}});
  this.onchange();
 }
 setVolume(value:number){if(!Number.isFinite(value))return;this.volume=Math.max(0,Math.min(1,value));if(this.gain)this.gain.gain.value=this.volume;this.onchange();}
 close(){
  this.active=false;this.version++;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();
  // Retain the single connected context for a later visit; no extra sources accumulate.
  if(this.context?.state==='running')void this.context.suspend();
 }
 get status(){return this.muted?'Sound muted':!this.enabled?'Music off':document.hidden?'Paused':this.error||'Playing';}
}
