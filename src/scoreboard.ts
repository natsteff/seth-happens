import { RUN_LIMIT_MS,formatRunSeconds } from './mission.mjs';
import {gameAudio} from './audio';
import { rankScores,readScores,saveScore,verifyClearPassword,SCORE_KEY } from './scores.mjs';
type Result={score:number;falls:number;squishes:number;bumps:number;photos:number;latePhotos:number;beer:boolean;elapsedMs?:number;bonus?:number;cheater?:boolean};
const dialog=document.createElement('dialog');
dialog.className='score-dialog';
document.getElementById('game')!.append(dialog);
let pending:(Result&{id:string;date:string})|null=null;
let all=false;
let scope:'server'|'local'='local';
let notice='';
let returnFocus:HTMLElement|null=null;
let nameDraft='';
export function scoresOpen(){return dialog.open;}
// Prevent Phaser's window listeners from capturing letters while a dialog is open.
for(const type of ['keydown','keyup'])document.addEventListener(type,event=>{
  if(dialog.open)event.stopPropagation();
},true);
function message(text:string){dialog.querySelector('[role="status"]')!.textContent=text;}
let revision=0;
let serverEnabled=false,apiBase='';
const configReady=fetch(new URL('./game-config.json',document.baseURI),{cache:'no-store'})
  .then(response=>{if(!response.ok)throw Error();return response.json();})
  .then(config=>{serverEnabled=config.serverHighScores===true;apiBase=typeof config.scoreApiUrl==='string'?config.scoreApiUrl.replace(/\/$/,''):'';})
  .catch(()=>{serverEnabled=false;});
let syncing:Promise<void>|null=null;
async function syncLocalScores(){
  if(!serverEnabled)return;
  if(syncing)return syncing;
  syncing=(async()=>{
    const remote=await request();const known=new Set(remote.scores.map((s:any)=>s.id));
    for(const score of readScores(localStorage))if(!known.has(score.id)){
      await request('/import',score);known.add(score.id);
    }
  })().finally(()=>{syncing=null;});
  return syncing;
}
void configReady.then(()=>syncLocalScores()).catch(()=>{/* Retry on score-list open or reconnect. */});
window.addEventListener('online',()=>{void configReady.then(()=>syncLocalScores()).catch(()=>{});});
async function request(path='',body?:unknown){
  if(!apiBase)throw new Error('Server leaderboard is not configured. This PC scores remain separate.');
  const response=await fetch(apiBase+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000),cache:'no-store'});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Leaderboard unavailable.');return result;
}
function render(){
  const current=++revision;
  const draft=dialog.querySelector('[name="player"]') as HTMLInputElement|null;
  if(draft)nameDraft=draft.value;
  dialog.innerHTML=`<div class="score-heading"><span class="score-eyebrow">THE ROOFTOP RECORD BOOK</span><h2 id="scores-title">HIGH SCORES</h2></div>${serverEnabled?'':'<!--'}<div class="score-actions"><button id="server-scores" aria-pressed="${scope==='server'}">Server High Scores</button><button id="local-scores" aria-pressed="${scope==='local'}">This PC High Scores</button></div>${serverEnabled?'':'-->'}<p>${scope==='server'?'Shared by this deployment.':'Saved only in this browser on this PC.'} Ties favor the earliest run. First five CHEATER runs sit below every legitimate score.</p>
  <p id="score-music" aria-live="polite"></p><form id="score-entry" ${pending?'':'hidden'}><label>Name or initials <input name="player" maxlength="16" required autocomplete="off"></label><button>Save score</button></form>
  <p role="status" aria-live="polite"></p><div class="score-list"></div>
  <div class="score-actions"><button id="all-scores">${all?'Show top 10':'Show all scores'}</button><button id="clear-scores">Clear high scores</button><button id="close-scores">Close</button></div>
  <form id="clear-form" hidden><label>Clear password <input name="password" type="password" required autocomplete="off"></label><label><input name="confirm" type="checkbox" required> Permanently delete all ${scope==='server'?'server':'this browser’s'} scores</label><button>Confirm clear</button></form>`;
  updateScoreMusic();
  dialog.setAttribute('aria-labelledby','scores-title');
  (dialog.querySelector('[name="player"]') as HTMLInputElement).value=nameDraft;
  message(notice||'Loading scores…');
  void (scope==='server'?request():Promise.resolve().then(()=>({scores:readScores(localStorage)}))).then(result=>{
    if(current!==revision)return;
    message(notice);
    const scores=rankScores(result.scores);
    const list=dialog.querySelector('.score-list')!;
    if(!scores.length)list.textContent='No scores yet. Make the first beer run!';
    else{
      const table=document.createElement('table');
      table.innerHTML='<thead><tr><th>Rank</th><th>Name</th><th>Score</th><th>Run details</th></tr></thead>';
      const body=table.createTBody();
      (all?scores:[...scores.filter((s:any)=>!s.cheater).slice(0,10),...scores.filter((s:any)=>s.cheater)]).forEach((s:any,i:number)=>{
        const row=body.insertRow();
        row.className=s.cheater?'cheater-row':'';
        row.insertCell().textContent=s.cheater?'—':String(i+1);
        const player=row.insertCell();player.textContent=s.name;
        if(s.cheater){const badge=document.createElement('span');badge.className='cheater-badge';badge.textContent='CHEATER';player.append(badge);}
        const points=row.insertCell();points.className='score-points';points.textContent=s.score.toLocaleString();
        const details=row.insertCell();details.className='run-details';
        const facts=[
          ['DATE',new Date(s.date).toLocaleDateString()],
          ['TIME',s.elapsedMs===undefined?'Legacy run':formatRunSeconds(s.elapsedMs)+(s.elapsedMs>=RUN_LIMIT_MS?' · previous time limit':'')],
          ['PHOTOS',`${s.photos}/2${s.latePhotos?' · '+s.latePhotos+' recovered':''}`],
          ['SIX-PACK',s.beer?'Delivered':'Not delivered'],
          ['MISHAPS',`${s.falls} falls · ${s.squishes} squishes · ${s.bumps} bumps`],
          ['TIME BONUS',s.cheater?'Shortcut: fixed score':'+'+(s.bonus??0).toLocaleString()]
        ];
        for(const [label,value] of facts){const fact=document.createElement('div'),title=document.createElement('span'),text=document.createElement('strong');title.textContent=label;text.textContent=value;fact.append(title,text);details.append(fact);}
      });
      list.append(table);
    }
  }).catch(error=>{if(current===revision)message([notice,error.message||'Could not load scores.'].filter(Boolean).join(' '));});
  dialog.querySelector('#score-entry')!.addEventListener('submit',async event=>{
    event.preventDefault();if(!pending)return;
    const form=event.currentTarget as HTMLFormElement;
    const name=String(new FormData(form).get('player')??'').trim();
    if(!name){message('Enter a name or initials.');return;}
    const button=form.querySelector('button')!;button.disabled=true;
    const result={...pending,name};const outcomes:string[]=[];let localOK=false,serverOK=!serverEnabled;
    try{const saved=saveScore(localStorage,result);localOK=true;outcomes.push(saved.some((s:any)=>s.id===result.id)?'This PC: saved.':'This PC: five CHEATER slots already filled.');}
    catch{outcomes.push('This PC: could not save; existing records unchanged.');}
    if(serverEnabled)try{const saved=await request('',result);serverOK=true;outcomes.push(saved.accepted?'Server: saved.':'Server: five CHEATER slots already filled.');}
    catch(error){outcomes.push('Server: '+(error instanceof Error?error.message:'could not save.'));}
    if(localOK&&serverOK){pending=null;nameDraft='';}
    notice=outcomes.join(' ');render();

  });
  dialog.querySelector('#server-scores')?.addEventListener('click',()=>{scope='server';notice='';render();});
  dialog.querySelector('#local-scores')?.addEventListener('click',()=>{scope='local';notice='';render();});
  dialog.querySelector('#all-scores')!.addEventListener('click',()=>{all=!all;render();});
  dialog.querySelector('#close-scores')!.addEventListener('click',()=>dialog.close());
  dialog.querySelector('#clear-scores')!.addEventListener('click',()=>{
    (dialog.querySelector('#clear-form') as HTMLFormElement).hidden=false;
    (dialog.querySelector('[name="password"]') as HTMLInputElement).focus();
  });
  dialog.querySelector('#clear-form')!.addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget as HTMLFormElement;
    const password=form.querySelector('[name="password"]') as HTMLInputElement;
    const value=password.value;password.value='';
    const button=form.querySelector('button')!;button.disabled=true;
    try{
      if(scope==='server')await request('/clear',{password:value});
      else{if(!await verifyClearPassword(value))throw new Error('Incorrect password. Scores were not cleared.');localStorage.removeItem(SCORE_KEY);}
      notice=scope==='server'?'Server high scores cleared.':'This PC high scores cleared.';render();
    }catch(error){message(error instanceof Error?error.message:'Could not clear shared scores.');}
    finally{button.disabled=false;}
  });
}
async function openScores(){
  returnFocus=document.activeElement as HTMLElement;
  await configReady;if(!serverEnabled)scope='local';
  if(serverEnabled){try{await syncLocalScores();}catch{notice='Some local scores could not sync. They remain on this PC; retry by reopening High Scores.';}}
  render();
  if(!dialog.open)dialog.showModal();
}
export function offerScore(result:Result){notice='';nameDraft='';pending={...result,id:crypto.randomUUID(),date:new Date().toISOString()};openScores();}
export function resetScoreEntry(){nameDraft='';pending=null;if(dialog.open)dialog.close();}
document.getElementById('high-scores')!.addEventListener('click',openScores);
dialog.addEventListener('close',()=>returnFocus?.focus());

function updateScoreMusic(){const label=dialog.querySelector('#score-music');if(label)label.textContent=gameAudio.music.outcome?`Music: ${gameAudio.music.track.title} · ${gameAudio.music.status}`:'';}
gameAudio.music.subscribe(updateScoreMusic);
