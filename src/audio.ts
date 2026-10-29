import {loadSettings,saveSettings} from './preferences.mjs';
import { MusicRadio } from './music';
import { recordedClips, type VoiceReaction, type LocationCue, type AudioClip } from './voice-clips';
type Cue = 'jump' | 'photo' | 'pickup' | 'impact' | 'miss' | 'win' | 'piano' | 'clown' | 'timer';
/** Original synthesized effects; nothing downloaded and no audio service. */
class GameAudio {
  readonly music=new MusicRadio();
  private context?: AudioContext;
  private paused=false;
  private pausedAt=0;
  private master?: GainNode;
  private effects?: GainNode;
  private noise?: AudioBuffer;
  private voiceUntil=0;
  private voicePriority=0;
  private voiceBuffers=new Map<AudioClip,AudioBuffer>();
  private voiceSource?:AudioBufferSourceNode;
  private rideSource?:AudioBufferSourceNode;
  private loadingVoices?:Promise<void>;
  private activeKind?:VoiceReaction;
  private locationSources=new Set<AudioBufferSourceNode>();
  lastLocation='';
  muted = loadSettings().muted;
  lastCue = '';
  lastSpoken='';
  playedKinds=new Set<AudioClip>();
  get loadedVoiceCount(){return this.voiceBuffers.size;}
  voiceStatus='not-loaded';
  voiceName='owner WAV recordings';
  constructor(){this.syncButton();}
  get state() { return this.context?.state ?? 'locked'; }
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.context.destination);this.music.attach(this.context,this.master);
      this.effects=this.context.createGain();this.effects.gain.value=.18;this.effects.connect(this.master);
      this.noise = this.context.createBuffer(1, this.context.sampleRate * .15, this.context.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i=0;i<data.length;i++) data[i] = (Math.random()*2-1)*(1-i/data.length);
    }
    if (this.context.state === 'suspended'&&!this.paused) await this.context.resume();
    this.syncButton();this.music.refresh();
    await this.loadVoices();
  }
  async setPaused(paused:boolean){
    if(this.paused===paused)return;
    this.paused=paused;this.music.setHold('pause',paused);
    if(paused){this.pausedAt=performance.now();if(this.context?.state==='running')await this.context.suspend();}
    else{if(this.voiceSource)this.voiceUntil+=performance.now()-this.pausedAt;if(this.context?.state==='suspended')await this.context.resume();this.music.refresh();}
  }
  toggle() { this.muted = !this.muted;saveSettings({muted:this.muted});if(this.muted){if(this.activeKind!=='start'&&this.activeKind!=='hero')this.stopVoice();this.stopLocations();} if(this.master&&this.context)this.master.gain.setValueAtTime(this.muted?0:.8,this.context.currentTime);this.music.setMuted(this.muted);this.syncButton(); }
  private syncButton() {
    const button=document.getElementById('sound-toggle');
    if(button){button.textContent=`Sound: ${this.muted?'Off':'On'} · S`;button.setAttribute('aria-pressed',String(!this.muted));button.dataset.context=this.state;}
  }
  beginRun(){
    this.music.beginRun();
    void this.setPaused(false);this.cancelRide();this.stopVoice();this.stopLocations();this.lastSpoken='';this.lastLocation='';
  }
  private stopLocations(){for(const source of this.locationSources)source.stop();this.locationSources.clear();}
  playLocation(kind:LocationCue){
    if(this.muted||!this.context||!this.master||this.context.state!=='running')return;
    const buffer=this.voiceBuffers.get(kind);if(!buffer)return;
    const source=this.context.createBufferSource(),gain=this.context.createGain();
    source.buffer=buffer;gain.gain.value=.45;source.connect(gain);gain.connect(this.master);source.start();
    this.locationSources.add(source);this.playedKinds.add(kind);this.lastLocation=kind;
    source.onended=()=>{this.locationSources.delete(source);source.disconnect();gain.disconnect();};
  }
  private stopVoice(){
    const previous=this.voiceSource;this.voiceSource=undefined;
    previous?.stop();this.voiceUntil=0;this.activeKind=undefined;
  }
  private loadVoices():Promise<void>{
    if(this.loadingVoices)return this.loadingVoices;
    this.loadingVoices=Promise.all(Object.entries(recordedClips).map(async([kind,url])=>{
      try{
        const response=await fetch(url);
        if(!response.ok)throw new Error(`Voice file ${response.status}`);
        this.voiceBuffers.set(kind as AudioClip,await this.context!.decodeAudioData(await response.arrayBuffer()));
      }catch{this.voiceStatus='recording-load-failed';}
    })).then(()=>{if(this.voiceBuffers.size===Object.keys(recordedClips).length)this.voiceStatus='ready';});
    return this.loadingVoices;
  }
  async playIntro(started?:()=>void):Promise<void>{
    await this.unlock();
    if(!this.voiceBuffers.has('start'))return;
    started?.();
    await new Promise<void>(resolve=>this.speak('Let’s go!','start',resolve,true));
  }
  cancelRide(){this.rideSource?.stop();this.rideSource=undefined;}
  duration(kind:AudioClip){return (this.voiceBuffers.get(kind)?.duration??10)*1000;}
  playRide():Promise<void>{
    const buffer=this.voiceBuffers.get('elevator');
    if(!this.context||!this.master||!buffer)return new Promise(resolve=>setTimeout(resolve,10000));
    return new Promise(resolve=>{
      const source=this.context!.createBufferSource();source.buffer=buffer;source.connect(this.master!);
      source.onended=()=>{source.disconnect();if(this.rideSource===source)this.rideSource=undefined;resolve();};this.rideSource=source;source.start();this.playedKinds.add('elevator');
    });
  }
  async playHero():Promise<void>{await this.unlock();if(!this.voiceBuffers.has('hero'))return;await new Promise<void>(resolve=>this.speak('My hero!','hero',resolve,true));}
  speak(text:string,kind:VoiceReaction,finished?:()=>void,allowMuted=false,rate=1) {
    if((this.muted&&!allowMuted)||!this.context||!this.master)return;
    const buffer=this.voiceBuffers.get(kind);
    if(!buffer){this.voiceStatus='not-loaded';return;}
    const priority=kind==='mega'||kind==='quick'?0:kind==='start'?1:kind==='win'?5:kind==='hero'?4:kind==='fall'?3:2,now=performance.now();
    if(now<this.voiceUntil&&priority<this.voicePriority)return;
    this.stopVoice();
    const source=this.context.createBufferSource();source.buffer=buffer;source.playbackRate.value=rate;source.connect(this.master);source.start();
    this.lastSpoken=text;this.playedKinds.add(kind);this.activeKind=kind;this.voiceSource=source;this.voiceStatus='playing';this.voiceUntil=now+buffer.duration/rate*1000;this.voicePriority=priority;
    source.onended=()=>{source.disconnect();if(this.voiceSource===source){this.voiceSource=undefined;this.activeKind=undefined;this.voiceStatus='ended';}finished?.();};
  }
  play(cue:Cue,urgent=false) {
    this.lastCue=cue;
    if(this.muted||!this.context||!this.master||this.context.state!=='running')return;
    const ctx=this.context, start=ctx.currentTime;
    const tone=(f:number,duration:number,delay=0,type:OscillatorType='sine',end=f)=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(f,start+delay);osc.frequency.exponentialRampToValueAtTime(Math.max(end,20),start+delay+duration);
      gain.gain.setValueAtTime(.001,start+delay);gain.gain.linearRampToValueAtTime(cue==='timer'?(urgent?.42:.3):.5,start+delay+.008);gain.gain.exponentialRampToValueAtTime(.001,start+delay+duration);
      osc.connect(gain);gain.connect(cue==='timer'?this.master!:this.effects!);osc.start(start+delay);osc.stop(start+delay+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();};
    };
    if(cue==='timer'){tone(urgent?1100:880,.09,0,'sine');if(urgent)tone(1100,.09,.16,'sine');}
    if(cue==='jump'){tone(105,.10,0,'triangle',65);}
    if(cue==='photo'){
      const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=this.noise!;gain.gain.value=.65;source.connect(gain);gain.connect(this.effects!);source.start();source.onended=()=>{source.disconnect();gain.disconnect();};tone(1150,.03);tone(660,.04,.065);
    }
    if(cue==='pickup'){this.speak('Mmm, beer!','beer');tone(440,.13);tone(554,.13,.10);tone(659,.23,.20);}
    if(cue==='impact'){tone(120,.22,0,'triangle',42);tone(75,.12,.03,'sine',35);}
    if(cue==='miss'){tone(440,.16,0,'triangle',240);tone(220,.17,.16,'triangle',130);}
    if(cue==='win'){this.speak('Great success!','win');[392,494,587,784].forEach((f,i)=>tone(f,.3,i*.13));}
    if(cue==='piano'){tone(73,.25,0,'triangle');tone(78,.25,0,'triangle');tone(110,.3,0,'triangle');}
    if(cue==='clown'){tone(330,.12,0,'sawtooth',380);tone(247,.17,.13,'sawtooth',190);}
  }
}
export const gameAudio=new GameAudio();

if ('speechSynthesis' in window) window.speechSynthesis.cancel();
