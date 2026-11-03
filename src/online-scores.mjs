import {SCORE_KEY} from './scores.mjs';
import {submission,scanLegacy,migrationSummary,retryDelay,sha256} from './online-score-model.mjs';
import {rememberPlayerName} from './score-options.mjs';
import {ScoreOutbox} from './online-score-store.mjs';
import {withDeadline} from './score-waits.mjs';
export class OnlineScores{
 /** @param {any} options */
 constructor({store=new ScoreOutbox(),storage,transport,visible=()=>!document.hidden,now=Date.now,waitMs=8000}={}){
  this.waitMs=waitMs;this.store=store;this.storage=storage;this.transport=transport;this.visible=visible;this.now=now;this.owner=crypto.randomUUID();this.listeners=new Set();this.status='';this.working=false;this.timer=undefined;this.revision=0;
 }
 subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
 changed(){for(const fn of this.listeners)fn();}
 async start(){
  try{
   let install=await this.store.get('installation');if(!install){install=crypto.randomUUID();await this.store.set('installation',install);}this.installationId=install;
   let baseline=await this.store.get('baseline');
   if(!baseline){let raw;try{if(!this.storage)throw Error('Storage unavailable');raw=this.storage.getItem(SCORE_KEY);}catch{raw=undefined;}
    baseline=raw===undefined?{status:'unavailable',total:0,invalid:0}:scanLegacy(raw);delete baseline.candidates;await this.store.set('baseline',baseline);
   }
   this.baseline=baseline;this.consent='yes';await this.store.set('migration-consent','yes');this.localOnly=await this.store.get('local-only')===true;
   await this.recover();this.changed();if(!this.localOnly)void this.kick();
  }catch{this.status='Online queue unavailable. This device scores are unchanged.';this.changed();}
 }
 async recover(){
  if(this.recovering)return this.recovering;
  this.recovering=this.recoverChanged().finally(()=>{this.recovering=null;});
  return this.recovering;
 }
 async recoverChanged(){
  const markers=await this.store.get('new-runs')||[];
  let raw;try{if(!this.storage)throw Error('Storage unavailable');raw=this.storage.getItem(SCORE_KEY);}catch{raw=undefined;}
  const fingerprint=await sha256(JSON.stringify([this.consent,raw===undefined?'unavailable':raw,markers]));
  const checkpoint=await this.store.get('recovery-v2');
  if(checkpoint?.fingerprint===fingerprint){this.scan=checkpoint.scan;return;}
  // Acknowledgments remain in the outbox. Only changed records need hashing/enqueue.
  const recovered={...checkpoint?.records};
  const recover=async(record,source)=>{
   const key=source+':'+record.id,value=JSON.stringify(record);
   if(recovered[key]===value)return;
   const job=await this.store.enqueue(await submission(record,source));
   if(job.collision)this.status='A saved run has conflicting data; the original is preserved.';
   recovered[key]=value;
  };
  for(const record of markers)await recover(record,'new');
  const scan=raw===undefined?{status:'unavailable',candidates:[],total:0,invalid:0}:scanLegacy(raw);
  const fresh=new Set(markers.map(r=>r.id));this.scan={...scan,candidates:undefined};
  this.migrationAvailable=(scan.candidates||[]).some(record=>!fresh.has(record.id));
  if(this.consent==='yes')for(const record of scan.candidates||[])if(!fresh.has(record.id))await recover(record,'historical');
  // Written last: interruptions replay safely through the existing idempotent outbox.
  await this.store.set('recovery-v2',{fingerprint,records:recovered,scan:this.scan});
 }
 async setConsent(value){this.consent=value;await this.store.set('migration-consent',value);if(value==='yes')await this.recover();this.changed();void this.kick();}
 async setLocalOnly(value){
  this.localOnly=value;
  try{await this.store.set('local-only',value);}catch{this.status='Preference could not be saved; this choice applies for this visit.';}
  if(value)clearTimeout(this.timer);else void this.kick();this.changed();
 }
 async enqueue(record){
  // Serialize marker appends across tabs in the same metadata transaction.
  await this.store.rememberRun(record);
  const job=await this.store.enqueue(await submission(record,'new'));
  if(job.collision)throw Error('Conflicting run ID; existing submission preserved.');
  this.status='Saved for online submission.';this.changed();if(!this.localOnly)void this.kick();return job;
 }
 async summary(){return migrationSummary(await this.store.jobs(),this.scan||this.baseline);}
 async kick(){
  clearTimeout(this.timer);if(this.working){this.again=true;return;}if(this.localOnly||!this.visible()||!this.installationId)return;
  this.working=true;let claimed=false;
  try{
   claimed=await this.store.claim(this.owner,this.now());if(!claimed){this.timer=setTimeout(()=>void this.kick(),5000);return;}
   if(this.transport.uid){const uid=await withDeadline(this.transport.uid(),this.waitMs),old=await this.store.get('uid');if(old&&old!==uid){this.installationId=crypto.randomUUID();await this.store.set('installation',this.installationId);}if(old!==uid)await this.store.set('uid',uid);}
   const jobs=await this.store.jobs(),job=jobs.filter(j=>j.state==='pending'&&j.nextAttempt<=this.now()).sort((a,b)=>(a.payload.source==='new'?0:1)-(b.payload.source==='new'?0:1))[0];
   if(job){
    try{const state=await withDeadline(this.transport.submit(job),this.waitMs);await this.store.update(job.key,{state,finishedAt:this.now()});this.revision++;if(job.payload.source==='new'&&['accepted','duplicate'].includes(state))rememberPlayerName(this.storage,job.payload.name);this.status=state==='accepted'?'Saved online.':state==='duplicate'?'Already saved online.':state==='below-cutoff'?'Saved on this device; outside the online top 25.':state==='rejected'?'Online shortcut list is full. This device score is unchanged.':'Conflicting run data; this device score is unchanged.';}
    catch(error){await this.store.set('ever-failed',true);const code=String(error?.code||'unavailable');const delay=code==='daily-limit'?86400000:retryDelay(job.attempts+1);await this.store.update(job.key,{attempts:job.attempts+1,nextAttempt:this.now()+delay,error:code});this.status='Online sync pending. Scores remain on this device.';}
   }
   const summary=await this.summary();const remaining=(await this.store.jobs()).filter(j=>j.state==='pending');
   // A stalled best-effort report must never hold the submission lease/next job.
   if(!this.reporting){
    const state={baselineStatus:this.baseline?.status||'unavailable',hadExisting:(this.baseline?.total||0)>0,consent:this.consent,boardUsed:await this.store.get('board-used')===true,...summary,everFailed:await this.store.get('ever-failed')===true,failedPending:remaining.filter(j=>!!j.error).length,newSubmitted:(await this.store.jobs()).some(j=>j.payload.source==='new'&&['accepted','duplicate'].includes(j.state)),lastError:remaining.find(j=>j.error)?.error||''};
    this.reporting=Promise.resolve().then(()=>this.transport.report(this.installationId,state)).catch(()=>{}).finally(()=>{this.reporting=null;});
   }
   if(remaining.length&&this.visible())this.timer=setTimeout(()=>void this.kick(),Math.max(1500,Math.min(...remaining.map(j=>j.nextAttempt))-this.now()));
  }catch{this.status='Online unavailable. This device scores remain safe.';if(this.visible())this.timer=setTimeout(()=>void this.kick(),5000);}
  finally{if(claimed)await this.store.release(this.owner).catch(()=>{});this.working=false;this.changed();if(this.again){this.again=false;this.timer=setTimeout(()=>void this.kick(),0);}}
 }
 async retry(){for(const job of await this.store.jobs())if(job.state==='pending')await this.store.update(job.key,{nextAttempt:0});void this.kick();}
 async list(board,cursor){
  const result=await withDeadline(this.transport.list(board,cursor),this.waitMs);
  // First-page cache only; Firestore snapshots/cursors are not portable cache data.
  void (async()=>{if(!cursor)await this.store.set(`board-cache:${board}`,{normal:result.normal,cheaters:result.cheaters,more:result.more,cachedAt:this.now()});await this.store.set('board-used',true);})().catch(()=>{});
  return result;
 }
 async cached(board){return this.store.get(`board-cache:${board}`);}
 dispose(){clearTimeout(this.timer);this.listeners.clear();}
}
