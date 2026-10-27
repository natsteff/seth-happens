import {gameAudio} from './audio';
import {championTracks,countdownTracks,radioShortcut} from './radio-playlist.mjs';
import {scoresOpen} from './scoreboard';
const radio=document.getElementById('radio')!;
const music=gameAudio.music;
radio.append(...music.elements);
const volume=document.getElementById('radio-volume') as HTMLInputElement;
const toggle=document.getElementById('radio-toggle') as HTMLButtonElement;
music.subscribe(()=>{
 const track=music.track;
 radio.dataset.countdown=String(music.countdown);
 radio.dataset.finished=String(!!music.outcome);
 (document.getElementById('radio-champion') as HTMLButtonElement).disabled=!!music.outcome;
 document.getElementById('radio-champion-title')!.textContent=championTracks[music.championSelected].title;
 for(const id of ['radio-prev','radio-next','radio-countdown'])(document.getElementById(id) as HTMLButtonElement).disabled=music.countdown||!!music.outcome;
 document.getElementById('radio-countdown-title')!.textContent=countdownTracks[music.countdownSelected].title;
 document.getElementById('radio-track')!.textContent=(music.countdown||music.outcome)?track.title:`${music.selected+1} · ${track.title}`;
 document.getElementById('radio-description')!.textContent=track.description;
 document.getElementById('radio-state')!.textContent=music.status;
 document.getElementById('radio-volume-value')!.textContent=`${Math.round(music.volume*100)}%`;
 volume.value=String(Math.round(music.volume*100));
 toggle.textContent=music.enabled?(music.countdown?'Music on':'Music on · 0 = off'):'Music off · click to enable';
 toggle.setAttribute('aria-pressed',String(music.enabled));
 radio.dataset.track=String(music.selected+1);radio.dataset.enabled=String(music.enabled);radio.dataset.status=music.status;
});
for(const [id,direction] of [['radio-prev',-1],['radio-next',1]] as const){document.getElementById(id)!.addEventListener('click',event=>{void gameAudio.unlock();music.step(direction);(event.currentTarget as HTMLButtonElement).blur();});}
toggle.addEventListener('click',()=>{void gameAudio.unlock();music.toggle();toggle.blur();});
volume.addEventListener('input',()=>{const value=Number(volume.value)/100;music.setVolume(value);void gameAudio.unlock();});
for(const type of ['keydown','keyup'])document.addEventListener(type,event=>{
 if(event.target instanceof Element&&event.target.closest('#radio input'))event.stopPropagation();
},true);
document.addEventListener('keydown',event=>{
 if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||scoresOpen())return;
 if(event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
 const action=radioShortcut(event.code);if(!action)return;
 if((music.countdown||music.outcome)&&!action.off)return;
 event.preventDefault();void gameAudio.unlock();
 if(action.off)music.off();else if(typeof action.track==='number')music.select(action.track);else if(typeof action.step==='number')music.step(action.step);
});

document.getElementById('radio-countdown')!.addEventListener('click',event=>{music.toggleCountdownTrack();(event.currentTarget as HTMLButtonElement).blur();});

// Pointer use returns to gameplay; keyboard focus remains available for range keys.
let volumePointer:number|undefined;
volume.addEventListener('pointerdown',event=>{volumePointer=event.pointerId;});
for(const type of ['pointerup','pointercancel'] as const)window.addEventListener(type,event=>{
 if(event.pointerId!==volumePointer)return;
 volumePointer=undefined;
 requestAnimationFrame(()=>{if(document.activeElement===volume)volume.blur();});
});

document.getElementById('radio-champion')!.addEventListener('click',event=>{music.toggleChampionTrack();(event.currentTarget as HTMLButtonElement).blur();});
