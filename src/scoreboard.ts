import {deviceFallback} from './score-fallback.mjs';
import {OnlineScores} from './online-scores.mjs';
import { savedPlayerName, rememberPlayerName, clearPasswordRequired, fitScoreDialog } from './score-options.mjs';
import { RUN_LIMIT_MS,formatRunSeconds } from './mission.mjs';
import {gameAudio} from './audio';
import { rankScores,readScores,saveScore,verifyClearPassword,SCORE_KEY } from './scores.mjs';
type Result={score:number;falls:number;squishes:number;bumps:number;photos:number;latePhotos:number;beer:boolean;elapsedMs?:number;bonus?:number;cheater?:boolean};
const dialog=document.createElement('dialog');
dialog.className='score-dialog';
document.getElementById('game')!.append(dialog);
let pending:(Result&{id:string;date:string})|null=null;
let all=false;
let scope:'server'|'local'|'online'|'historical'='local';
let online:OnlineScores|undefined;
let onlinePage:any=null,onlineRows:any[]=[],onlineMore=false;
let onlineBoard='';

let notice='';
let returnFocus:HTMLElement|null=null;
let nameDraft='';
let editingName=true,submitting=false;
let scoreConfig:Record<string,unknown>={},serverClearRequired=true;
function playerStorage(){try{return localStorage;}catch{return null;}}
function needsPassword(){return clearPasswordRequired(location.hostname,scope,scoreConfig,serverClearRequired);}
function fitEntry(){if(dialog.open)fitScoreDialog(dialog);}
window.addEventListener('resize',fitEntry);window.visualViewport?.addEventListener('resize',fitEntry);window.visualViewport?.addEventListener('scroll',fitEntry);
export function scoresOpen(){return dialog.open;}
// Prevent Phaser's window listeners from capturing letters while a dialog is open.
for(const type of ['keydown','keyup'])document.addEventListener(type,event=>{
  if(dialog.open&&!(event.target instanceof Element&&event.target.closest('dialog')))event.stopPropagation();
},true);
for(const type of ['keydown','keyup'])dialog.addEventListener(type,event=>event.stopPropagation());
function message(text:string){dialog.querySelector('[role="status"]')!.textContent=text;}
let revision=0;
let serverEnabled=false,apiBase='';
const configReady=fetch(new URL('./game-config.json',document.baseURI),{cache:'no-store'})
  .then(response=>{if(!response.ok)throw Error();return response.json();})
  .then(async config=>{
   scoreConfig=config;serverEnabled=config.serverHighScores===true;apiBase=typeof config.scoreApiUrl==='string'?config.scoreApiUrl.replace(/\/$/,''):'';
   const emulator=import.meta.env.DEV&&import.meta.env.VITE_SCORE_EMULATOR==='1';
   if(config.onlineScores?.enabled===true||emulator){
    const {FirebaseScores}=await import('./firebase-scores');
    let storage:Storage|undefined;try{storage=localStorage;}catch{}
    online=new OnlineScores({storage,transport:new FirebaseScores(config.onlineScores.firebase,emulator)});
    online.subscribe(()=>{if(dialog.open)void syncOnlinePanel();});
    await online.start();scope=online.localOnly?'local':'online';serverEnabled=false;
   }
  })
  .catch(()=>{serverEnabled=false;notice='Online scores unavailable. This device scores remain safe.';});
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
window.addEventListener('online',()=>{if(online)void online.retry();else void configReady.then(()=>syncLocalScores()).catch(()=>{});});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&online)void online.kick();});
async function request(path='',body?:unknown){
  if(!apiBase)throw new Error('Server leaderboard is not configured. This device scores remain separate.');
  const response=await fetch(apiBase+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000),cache:'no-store'});
  const result=await response.json();if(typeof result.clearPasswordRequired==='boolean')serverClearRequired=result.clearPasswordRequired;if(!response.ok)throw new Error(result.error||'Leaderboard unavailable.');return result;
}
function render(){
  const current=++revision;
  const draft=dialog.querySelector('[name="player"]') as HTMLInputElement|null;
  if(draft)nameDraft=draft.value;
  dialog.dataset.entry=String(!!pending);
  dialog.innerHTML=`<div class="score-heading"><span class="score-eyebrow">THE ROOFTOP RECORD BOOK</span><h2 id="scores-title">${pending?'Save your score':'HIGH SCORES'}</h2></div>${serverEnabled||online?'':'<!--'}<div class="score-actions">${online?`<button id="online-scores" aria-pressed="${scope==='online'}">Online</button><button id="historical-scores" aria-pressed="${scope==='historical'}">Historical</button>`:`<button id="server-scores" aria-pressed="${scope==='server'}">Server High Scores</button>`}<button id="local-scores" aria-pressed="${scope==='local'}">This device High Scores</button></div>${serverEnabled||online?'':'-->'}<p>${scope==='online'?'Shared online, casual player-reported scores.':scope==='historical'?'Imported historical scores; dates/totals are not independently verified.':scope==='server'?'Shared by this deployment.':'Saved only in this browser on this device.'} Ties favor the earliest run. First five CHEATER runs sit below every legitimate score.</p>
  <p id="score-music" aria-live="polite"></p><form id="score-entry" ${pending?'':'hidden'}><div class="saved-name" ${editingName?'hidden':''}><span id="save-as"></span> <button type="button" id="change-name">Change name</button></div><label class="entry-fields" ${editingName?'':'hidden'}>Name <input name="player" maxlength="16" required autocomplete="off" autocorrect="off" spellcheck="false" autocapitalize="words" enterkeyhint="done" aria-label="Name or initials"></label><button id="save-score">Save score</button>${online&&!online.localOnly?'<small>Nickname and score will be public online.</small>':''}<button type="button" id="skip-score">Skip saving</button></form>
  <p role="status" aria-live="polite"></p>${online?`<section id="online-panel" ${pending?'hidden':''}><p id="online-sync" role="status"></p><div id="migration-offer" hidden><p>Import existing scores to the public Historical leaderboard? Nicknames and scores become public. Originals stay on this device.</p><button id="migration-yes" type="button">Import old scores</button><button id="migration-later" type="button">Not now</button></div><small>Online mode records an anonymous installation ID and migration status privately; no device fingerprinting. <a href="./docs/online-scores-privacy.html" target="_blank" rel="noopener">Privacy &amp; migration</a></small><div class="score-actions"><button id="sync-retry" type="button">Retry sync</button><button id="local-only" type="button"></button><button id="review-import" type="button">Review old-score import</button></div></section>`:''}<div class="score-list"></div>
  <div class="score-actions"><button id="all-scores">${scope==='online'||scope==='historical'?'Show more':all?'Show top 10':'Show all scores'}</button><button id="clear-scores" ${(scope==='online'||scope==='historical')?'hidden':''}>Clear high scores</button><button id="close-scores">Close</button></div>
  <form id="clear-form" hidden><label id="clear-password-label">Clear password <input name="password" type="password" autocomplete="off"></label><label><input name="confirm" type="checkbox" required> Permanently delete all ${scope==='server'?'server':'this browser’s'} scores</label>${online?'<p>Online scores and pending online submissions are separate; pending submissions will still sync.</p>':''}<button>Confirm clear</button><button type="button" id="cancel-clear">Cancel</button></form>`;
  (dialog.querySelector('#save-as') as HTMLElement).textContent=`Save as ${nameDraft}`;
  syncClearPassword();
  updateScoreMusic();
  dialog.setAttribute('aria-labelledby','scores-title');
  (dialog.querySelector('[name="player"]') as HTMLInputElement).value=nameDraft;
  message(notice||'Loading scores…');
  void (pending?Promise.resolve({scores:[]}):scope==='online'||scope==='historical'?onlineResults(current):scope==='server'?request():Promise.resolve().then(()=>({scores:readScores(localStorage)}))).then(result=>{
    if(current!==revision)return;
    message(notice);
    syncClearPassword();
    void syncOnlinePanel();
    const scores=scope==='online'||scope==='historical'?result.scores:rankScores(result.scores);
    const list=dialog.querySelector('.score-list')!;
    if(!scores.length)list.textContent='No scores yet. Make the first beer run!';
    else{
      const table=document.createElement('table');
      table.innerHTML='<thead><tr><th>Rank</th><th>Name</th><th>Score</th><th>Run details</th></tr></thead>';
      const body=table.createTBody();
      ((all||scope==='online'||scope==='historical')?scores:[...scores.filter((s:any)=>!s.cheater).slice(0,10),...scores.filter((s:any)=>s.cheater)]).forEach((s:any,i:number)=>{
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
          ['TIME BONUS',s.cheater?'Shortcut: fixed score':s.bonus===undefined?'Unknown (historical)':'+'+s.bonus.toLocaleString()]
        ];
        for(const [label,value] of facts){const fact=document.createElement('div'),title=document.createElement('span'),text=document.createElement('strong');title.textContent=label;text.textContent=value;fact.append(title,text);details.append(fact);}
      });
      list.append(table);
    }
  }).catch(error=>{if(current===revision)message([notice,error.message||'Could not load scores.'].filter(Boolean).join(' '));});
  dialog.querySelector('#score-entry')!.addEventListener('submit',async event=>{
    event.preventDefault();if(!pending||submitting)return;
    const form=event.currentTarget as HTMLFormElement;
    const name=String(new FormData(form).get('player')??'').trim();
    if(!name){message('Enter a name or initials.');return;}
    const button=form.querySelector('#save-score') as HTMLButtonElement;button.disabled=true;submitting=true;
    const result={...pending,name};const outcomes:string[]=[];let localOK=false,serverOK=!serverEnabled,nameSaved=false;

    try{const saved=saveScore(localStorage,result);localOK=true;nameSaved=saved.some((s:any)=>s.id===result.id);outcomes.push(saved.some((s:any)=>s.id===result.id)?'This device: saved.':'This device: five CHEATER slots already filled.');}
    catch{outcomes.push('This device: could not save; existing records unchanged.');}
    if(online&&!online.localOnly)try{await online.enqueue(result);serverOK=true;outcomes.push('Online: queued; confirmation appears after sync.');}catch{serverOK=false;outcomes.push('Online: could not queue. This result remains available to retry.');}

    if(serverEnabled)try{const saved=await request('',result);serverOK=true;nameSaved ||= saved.accepted===true;outcomes.push(saved.accepted?'Server: saved.':'Server: five CHEATER slots already filled.');}
    catch(error){outcomes.push('Server: '+(error instanceof Error?error.message:'could not save.'));}
    if(nameSaved)rememberPlayerName(playerStorage(),name);
    if(pending?.id!==result.id)return;
    submitting=false;
    if(localOK&&serverOK){pending=null;nameDraft='';}
    notice=outcomes.join(' ');render();

  });
  dialog.querySelector('#change-name')!.addEventListener('click',()=>{editingName=true;render();(dialog.querySelector('[name=player]') as HTMLInputElement).focus();fitEntry();});
  dialog.querySelector('#skip-score')!.addEventListener('click',()=>{if(submitting)return;pending=null;nameDraft='';render();});
  dialog.querySelector('#cancel-clear')!.addEventListener('click',()=>{(dialog.querySelector('#clear-form') as HTMLFormElement).reset();(dialog.querySelector('#clear-form') as HTMLFormElement).hidden=true;});
  dialog.querySelector('#server-scores')?.addEventListener('click',()=>{scope='server';notice='';render();});
  for(const [id,next] of [['online-scores','online'],['historical-scores','historical']] as const)dialog.querySelector(`#${id}`)?.addEventListener('click',()=>{scope=next;onlineBoard='';onlinePage=null;onlineRows=[];notice='';render();});
  bindOnlinePanel();
  dialog.querySelector('#local-scores')?.addEventListener('click',()=>{scope='local';notice='';render();});
  dialog.querySelector('#all-scores')!.addEventListener('click',()=>{if(scope==='online'||scope==='historical'){if(onlineMore)render();}else{all=!all;render();}});
  dialog.querySelector('#close-scores')!.addEventListener('click',()=>dialog.close());
  dialog.querySelector('#clear-scores')!.addEventListener('click',()=>{
    (dialog.querySelector('#clear-form') as HTMLFormElement).hidden=false;
    (dialog.querySelector(needsPassword()?'[name="password"]':'[name="confirm"]') as HTMLInputElement).focus();
  });
  dialog.querySelector('#clear-form')!.addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget as HTMLFormElement;
    if(!form.reportValidity())return;
    if(scope==='online'||scope==='historical')return;
    const clearScope=scope,required=needsPassword();
    const password=form.querySelector('[name="password"]') as HTMLInputElement;
    const value=password.value;password.value='';
    const button=form.querySelector('button')!;button.disabled=true;
    try{
      if(clearScope==='server')await request('/clear',{password:value,confirm:true});
      else{readScores(localStorage);if(required&&!await verifyClearPassword(value))throw new Error('Incorrect password. Scores were not cleared.');localStorage.removeItem(SCORE_KEY);}
      notice=clearScope==='server'?'Server high scores cleared.':'This device high scores cleared.';render();
    }catch(error){message(error instanceof Error?error.message:'Could not clear shared scores.');}
    finally{button.disabled=false;}
  });
}
async function openScores(){
  returnFocus=document.activeElement as HTMLElement;
  await configReady;if(!serverEnabled&&!online)scope='local';
  if(online){await online.recover().catch(()=>{});onlineBoard='';onlinePage=null;onlineRows=[];if(!online.localOnly)void online.kick();}
  if(serverEnabled){try{await syncLocalScores();}catch{notice='Some local scores could not sync. They remain on this device; retry by reopening High Scores.';}}
  render();
  if(!dialog.open)dialog.showModal();
  fitEntry();
  if(pending)(dialog.querySelector(editingName?'[name=player]':'#save-score') as HTMLElement).focus({preventScroll:true});
}
export function offerScore(result:Result){notice='';nameDraft=savedPlayerName(playerStorage());editingName=!nameDraft;pending={...result,id:crypto.randomUUID(),date:new Date().toISOString()};openScores();}
export function resetScoreEntry(){nameDraft='';pending=null;submitting=false;if(dialog.open)dialog.close();}
document.getElementById('high-scores')!.addEventListener('click',openScores);
dialog.addEventListener('close',()=>returnFocus?.focus());

function syncClearPassword(){
 const needed=needsPassword();const label=dialog.querySelector('#clear-password-label') as HTMLElement|null;const input=dialog.querySelector('[name=password]') as HTMLInputElement|null;
 if(label)label.hidden=!needed;if(input){input.required=needed;if(!needed)input.value='';}
}
function updateScoreMusic(){const label=dialog.querySelector('#score-music');if(label)label.textContent=gameAudio.music.outcome?`Music: ${gameAudio.music.track.title} · ${gameAudio.music.status}`:'';}
gameAudio.music.subscribe(updateScoreMusic);

async function onlineResults(requestRevision:number){
 if(!online||online.localOnly)return {scores:[]};
 const board=scope==='historical'?'historical':'live';
 try{
  const page=await online.list(board,onlineBoard===board?onlinePage:undefined);
  if(requestRevision!==revision)return {scores:[]};
  if(onlineBoard!==board)onlineRows=[];
  onlineBoard=board;onlinePage=page.cursor;onlineMore=page.more;
  onlineRows=[...onlineRows,...page.normal.filter((row:any)=>!onlineRows.some(old=>old.id===row.id))];
  return {scores:[...onlineRows,...page.cheaters]};
 }catch(error){
  if(requestRevision!==revision)return {scores:[]};
  // Re-render the actual device tab so labels/clear actions cannot imply shared data.
  const fallback=deviceFallback(()=>readScores(localStorage));
  scope='local';notice=fallback.notice;onlineBoard='';onlinePage=null;onlineRows=[];onlineMore=false;
  render();return {scores:[]};
 }
}
async function syncOnlinePanel(){
 if(!online||!dialog.open)return;
 const summary=await online.summary().catch(()=>null);
 const label=dialog.querySelector('#online-sync');if(label)label.textContent=[online.localOnly?'Local-only mode.':online.status,summary&&summary.eligible?`Historical: ${summary.imported} imported, ${summary.duplicates} already online, ${summary.pending} pending, ${summary.invalid+summary.conflicts} need review.`:'',online.baseline?.status==='corrupt'?'Existing storage is unreadable; nothing was changed.':''].filter(Boolean).join(' ');
 const offer=dialog.querySelector('#migration-offer') as HTMLElement|null;if(offer)offer.hidden=online.localOnly||online.consent!=='ask'||!online.migrationAvailable;
 const toggle=dialog.querySelector('#local-only');if(toggle)toggle.textContent=online.localOnly?'Enable online scores':'Use local only';
 const more=dialog.querySelector('#all-scores') as HTMLButtonElement|null;if(more&&(scope==='online'||scope==='historical'))more.disabled=!onlineMore;
}
function bindOnlinePanel(){
 if(!online)return;
 dialog.querySelector('#migration-yes')?.addEventListener('click',()=>{void online!.setConsent('yes').then(()=>syncOnlinePanel()).catch(()=>message('Could not prepare import. Originals are unchanged.'));});
 dialog.querySelector('#migration-later')?.addEventListener('click',()=>{void online!.setConsent('later').then(()=>syncOnlinePanel());});
 dialog.querySelector('#review-import')?.addEventListener('click',()=>{void online!.setConsent('ask').then(()=>syncOnlinePanel());});
 dialog.querySelector('#sync-retry')?.addEventListener('click',()=>{void online!.retry().catch(()=>message('Retry unavailable; existing scores remain safe.'));});
 dialog.querySelector('#local-only')?.addEventListener('click',()=>{void online!.setLocalOnly(!online!.localOnly).then(()=>{scope=online!.localOnly?'local':'online';onlineBoard='';onlinePage=null;onlineRows=[];render();});});
 void syncOnlinePanel();
}
