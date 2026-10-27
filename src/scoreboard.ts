import { readScores, saveScore, rankScores, verifyClearPassword, SCORE_KEY } from './scores.mjs';
type Result={score:number;falls:number;squishes:number;bumps:number;photos:number;latePhotos:number;beer:boolean;elapsedMs?:number;bonus?:number;cheater?:boolean};
const dialog=document.createElement('dialog');
dialog.className='score-dialog';
document.getElementById('game')!.append(dialog);
let pending:(Result&{id:string;date:string})|null=null;
let all=false;
let returnFocus:HTMLElement|null=null;
let nameDraft='';
export function scoresOpen(){return dialog.open;}
// Prevent Phaser's window listeners from capturing letters while a dialog is open.
for(const type of ['keydown','keyup'])document.addEventListener(type,event=>{
  if(dialog.open)event.stopPropagation();
},true);
function message(text:string){dialog.querySelector('[role="status"]')!.textContent=text;}
function render(){
  const draft=dialog.querySelector('[name="player"]') as HTMLInputElement|null;
  if(draft)nameDraft=draft.value;
  dialog.innerHTML=`<div class="score-heading"><span class="score-eyebrow">THE ROOFTOP RECORD BOOK</span><h2 id="scores-title">HIGH SCORES</h2></div><p>Saved in this browser. Ties favor the earliest run. First five CHEATER runs sit below every legitimate score.</p>
  <form id="score-entry" ${pending?'':'hidden'}><label>Name or initials <input name="player" maxlength="16" required autocomplete="off"></label><button>Save score</button></form>
  <p role="status" aria-live="polite"></p><div class="score-list"></div>
  <div class="score-actions"><button id="all-scores">${all?'Show top 10':'Show all scores'}</button><button id="clear-scores">Clear high scores</button><button id="close-scores">Close</button></div>
  <form id="clear-form" hidden><label>Clear password <input name="password" type="password" required autocomplete="off"></label><label><input name="confirm" type="checkbox" required> Permanently delete all scores in this browser</label><button>Confirm clear</button></form>`;
  dialog.setAttribute('aria-labelledby','scores-title');
  (dialog.querySelector('[name="player"]') as HTMLInputElement).value=nameDraft;
  try{
    const scores=rankScores(readScores(localStorage));
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
          ['TIME',s.elapsedMs===undefined?'Legacy run':(s.elapsedMs/1000).toFixed(1)+'s'],
          ['PHOTOS',`${s.photos}/2${s.latePhotos?' · '+s.latePhotos+' recovered':''}`],
          ['SIX-PACK',s.beer?'Delivered':'Not delivered'],
          ['MISHAPS',`${s.falls} falls · ${s.squishes} squishes · ${s.bumps} bumps`],
          ['TIME BONUS',s.cheater?'Shortcut: fixed score':'+'+(s.bonus??0).toLocaleString()]
        ];
        for(const [label,value] of facts){const fact=document.createElement('div'),title=document.createElement('span'),text=document.createElement('strong');title.textContent=label;text.textContent=value;fact.append(title,text);details.append(fact);}
      });
      list.append(table);
    }
  }catch{message('Could not read saved scores. Existing data has not been changed.');}
  dialog.querySelector('#score-entry')!.addEventListener('submit',event=>{
    event.preventDefault();if(!pending)return;
    const form=event.currentTarget as HTMLFormElement;
    const name=String(new FormData(form).get('player')??'').trim();
    if(!name){message('Enter a name or initials.');return;}
    try{const id=pending.id;const saved=saveScore(localStorage,{...pending,name});pending=null;nameDraft='';render();message(saved.some((s:any)=>s.id===id)?'Score saved!':'First five CHEATER slots are already filled. This run was not added.');}
    catch{message('Could not save. Browser storage may be unavailable or full. Your result is still available; try again.');}
  });
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
      if(!await verifyClearPassword(value)){message('Incorrect password. Scores were not cleared.');return;}
      localStorage.removeItem(SCORE_KEY);render();message('High scores cleared.');
    }catch{message('Could not clear scores. Browser storage or password verification is unavailable.');}
    finally{button.disabled=false;}
  });
}
function openScores(){
  returnFocus=document.activeElement as HTMLElement;render();
  if(!dialog.open)dialog.showModal();
}
export function offerScore(result:Result){nameDraft='';pending={...result,id:crypto.randomUUID(),date:new Date().toISOString()};openScores();}
export function resetScoreEntry(){nameDraft='';pending=null;if(dialog.open)dialog.close();}
document.getElementById('high-scores')!.addEventListener('click',openScores);
dialog.addEventListener('close',()=>returnFocus?.focus());
