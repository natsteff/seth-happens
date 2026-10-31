import {afterpartyCredits,afterpartyPhase,AFTERPARTY_TIMES,jukeboxTracks,nextDance} from './afterparty-model.mjs';
import {AfterpartyArt} from './afterparty-art';
import {JukeboxAudio} from './jukebox-audio';
import {gameAudio} from './audio';
import {installOpeningGuard} from './dialog-input.mjs';

export function createAfterparty(onClose:()=>void){
 const dialog=document.createElement('dialog');dialog.id='afterparty';dialog.setAttribute('aria-labelledby','afterparty-title');
 dialog.innerHTML=`<header class="party-header"><div><span class="party-eyebrow">SETH HAPPENS!</span><h2 id="afterparty-title">Credits / Jukebox</h2></div><button id="party-close" type="button">Close</button></header>
 <div class="party-stage"><canvas aria-label="Rave afterparty: Seth dances with Allison, the cats and the game's characters in front of the BT-AI DJ booth."></canvas><p class="party-loading" role="status">Loading the afterparty…</p><div class="party-credits" aria-label="Game credits"></div></div>
 <section class="party-deck" aria-label="Jukebox controls"><div class="party-now"><span class="party-eyebrow">BT-AI · JUKEBOX</span><strong id="party-track-title"></strong><span id="party-status" role="status"></span></div>
 <div class="party-track-controls"><button id="party-prev" aria-label="Previous jukebox track">◀</button><label for="party-track">Track</label><select id="party-track"></select><button id="party-next" aria-label="Next jukebox track">▶</button></div>
 <div class="party-mix"><button id="party-play"></button><button id="party-mute"></button><label for="party-volume">Volume <output id="party-volume-value"></output></label><input id="party-volume" type="range" min="0" max="100" step="1"></div></section>`;
 document.getElementById('play-area')!.append(dialog);
 const credits=dialog.querySelector<HTMLDivElement>('.party-credits')!;
 for(const [kind,text] of afterpartyCredits){const line=document.createElement('div');line.className=`credit-${kind}`;line.textContent=text;credits.append(line);}
 const stage=dialog.querySelector<HTMLDivElement>('.party-stage')!,canvas=dialog.querySelector('canvas')!;
 const art=new AfterpartyArt(canvas),player=new JukeboxAudio(),guard=installOpeningGuard(dialog);
 const select=dialog.querySelector<HTMLSelectElement>('#party-track')!,volume=dialog.querySelector<HTMLInputElement>('#party-volume')!;
 jukeboxTracks.forEach((track,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=track.title;select.append(option);});
 let frame=0,loadVersion=0,elapsed=0,last=0,creditsHeight=0,stageHeight=0;
 let dance=nextDance(0,undefined),assetsReady=false,reduced=false,lastPaint=0,phase='';
 let observer:ResizeObserver|undefined,unsubscribe:(()=>void)|undefined;
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 function resize(){if(!dialog.open)return;art.resize();creditsHeight=credits.scrollHeight;stageHeight=stage.clientHeight;paint();}
 function sync(){
  if(!dialog.open)return;
  select.value=String(player.selected);volume.value=String(Math.round(player.volume*100));
  dialog.querySelector('#party-volume-value')!.textContent=`${volume.value}%`;
  dialog.querySelector('#party-track-title')!.textContent=jukeboxTracks[player.selected].title;
  dialog.querySelector('#party-status')!.textContent=player.status;
  dialog.querySelector('#party-play')!.textContent=player.enabled?'Pause music':'Play music';
  dialog.querySelector('#party-play')!.setAttribute('aria-pressed',String(player.enabled));
  dialog.querySelector('#party-mute')!.textContent=player.muted?'Sound: Off':'Sound: On';
  dialog.querySelector('#party-mute')!.setAttribute('aria-pressed',String(!player.muted));
 }
 player.onchange=sync;
 function paint(){
  if(!dialog.open)return;
  phase=afterpartyPhase(elapsed);dialog.dataset.phase=phase;dialog.dataset.dance=dance.name;dialog.dataset.elapsed=String(Math.round(elapsed));
  dialog.querySelector<HTMLElement>('.party-loading')!.hidden=assetsReady;
  if(assetsReady)art.render(elapsed,phase,dance.name,reduced);
  credits.hidden=elapsed>=AFTERPARTY_TIMES.credits;
  if(!credits.hidden)credits.style.transform=`translateY(${stageHeight-(stageHeight+creditsHeight)*elapsed/AFTERPARTY_TIMES.credits}px)`;
 }
 function animate(time:number){
  if(!dialog.open)return;
  if(last&&!document.hidden&&assetsReady)elapsed+=Math.min(100,time-last);last=time;
  if(elapsed>=dance.until)dance=nextDance(elapsed,dance.name);
  if(time-lastPaint>=1000/30){lastPaint=time;paint();}
  // The final booth is still: keep music streaming without an idle render loop.
  if(elapsed<AFTERPARTY_TIMES.logo)frame=requestAnimationFrame(animate);else {paint();frame=0;}
 }
 function close(){
  if(!dialog.open)return;
  loadVersion++;cancelAnimationFrame(frame);frame=0;observer?.disconnect();observer=undefined;unsubscribe?.();unsubscribe=undefined;
  player.close();dialog.close();onClose();
 }
 const change=()=>{player.select(Number(select.value));};select.addEventListener('change',change);
 for(const [id,step] of [['party-prev',-1],['party-next',1]] as const)dialog.querySelector(`#${id}`)!.addEventListener('click',()=>player.select((player.selected+step+jukeboxTracks.length)%jukeboxTracks.length));
 dialog.querySelector('#party-play')!.addEventListener('click',()=>{player.enabled=!player.enabled;player.refresh();});
 dialog.querySelector('#party-mute')!.addEventListener('click',()=>gameAudio.toggle());
 volume.addEventListener('input',()=>player.setVolume(Number(volume.value)/100));
 dialog.querySelector('#party-close')!.addEventListener('click',close);
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 for(const type of ['keydown','keyup'])dialog.addEventListener(type,event=>event.stopPropagation());
 document.addEventListener('visibilitychange',()=>{if(dialog.open){last=0;player.refresh();}});
 media.addEventListener('change',()=>{reduced=media.matches;if(dialog.open)paint();});
 return {
  get isOpen(){return dialog.open;},
  open(){
   if(dialog.open)return;
   elapsed=0;last=0;lastPaint=0;dance=nextDance(0,undefined);reduced=media.matches;
   credits.hidden=false;dialog.showModal();resize();
   (dialog.querySelector('#party-close') as HTMLButtonElement).focus({preventScroll:true});guard.arm();
   // Start from the user's gesture; don't wait for scene images before requesting playback.
   player.open({enabled:gameAudio.music.enabled,muted:gameAudio.muted,volume:gameAudio.music.volume});
   unsubscribe=gameAudio.music.subscribe(()=>{player.muted=gameAudio.muted;player.refresh();});
   observer=new ResizeObserver(resize);observer.observe(stage);
   const version=++loadVersion;
   if(!assetsReady)void art.load().then(ok=>{if(version!==loadVersion||!dialog.open)return;assetsReady=true;resize();if(!ok)dialog.querySelector('#party-status')!.textContent='Some scene art is unavailable; music controls still work.';});
   frame=requestAnimationFrame(animate);sync();
  }
 };
}
