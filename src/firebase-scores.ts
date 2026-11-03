import {initializeApp,getApps,deleteApp} from 'firebase/app';
import {getAuth,signInAnonymously,connectAuthEmulator,setPersistence,indexedDBLocalPersistence} from 'firebase/auth';
import {initializeFirestore,connectFirestoreEmulator,doc,collection,runTransaction,serverTimestamp,getDocsFromServer,query,where,orderBy,limit,startAfter,documentId,getDocFromServer,setDoc,terminate} from 'firebase/firestore';
import {rankScores} from './scores.mjs';
import {sameRun,displayScore,mergeOnlineRows,qualifiesForTop25} from './online-score-model.mjs';

export class FirebaseScores{
 private reads=new Map<string,Promise<any>>();private submissions=new Map<string,Promise<any>>();
 private cutoff?:{at:number;rows:any[]};private cutoffRead?:Promise<any[]>;
 private auth;private db;private login?:Promise<string>;private base='games/beer-run';
 constructor(config:Record<string,string>,emulator=false){
  const name=emulator?'beer-run-emulator':'beer-run-online';const app=getApps().find(app=>app.name===name)||initializeApp(emulator?{...config,projectId:'demo-seth-happens'}:config,name);
  this.auth=getAuth(app);this.db=initializeFirestore(app,{ignoreUndefinedProperties:true});
  if(emulator){connectAuthEmulator(this.auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFirestoreEmulator(this.db,'127.0.0.1',8080);}
 }
 async uid(){
  if(!this.login)this.login=(async()=>{await setPersistence(this.auth,indexedDBLocalPersistence).catch(()=>{});await this.auth.authStateReady();return this.auth.currentUser?.uid||(await signInAnonymously(this.auth)).user.uid;})().catch(error=>{this.login=undefined;throw error;});return this.login;
 }
 async submit(job:any){
  const current=this.submissions.get(job.key);if(current)return current;
  const operation=this.submitOnce(job).then(state=>{
   if(this.cutoff&&!job.payload.cheater&&['accepted','duplicate'].includes(state)){
    this.cutoff.rows=[...this.cutoff.rows.filter(row=>row.key!==job.key),{...job.payload,key:job.key}].sort((a,b)=>b.score-a.score||a.dateMs-b.dateMs||a.key.localeCompare(b.key)).slice(0,25);
   }
   return state;
  }).finally(()=>this.submissions.delete(job.key));
  this.submissions.set(job.key,operation);return operation;
 }
 private async qualifies(job:any){
  if(job.payload.cheater)return true;
  if(!this.cutoff||Date.now()-this.cutoff.at>60000){
   if(!this.cutoffRead)this.cutoffRead=(async()=>{
    const pages=await Promise.all(['live','historical'].map(board=>getDocsFromServer(query(collection(this.db,`${this.base}/boards/${board}/scores`),where('payload.cheater','==',false),orderBy('payload.score','desc'),orderBy('payload.dateMs','asc'),orderBy(documentId(),'asc'),limit(25)))));
    const rows=[...new Map(pages.flatMap(page=>page.docs.map(s=>[s.id,{...s.data().payload,key:s.id}] as const))).values()].sort((a,b)=>b.score-a.score||a.dateMs-b.dateMs||a.key.localeCompare(b.key)).slice(0,25);
    this.cutoff={at:Date.now(),rows};return rows;
   })().finally(()=>{this.cutoffRead=undefined;});
   await this.cutoffRead;
  }
  return qualifiesForTop25(job.payload,job.key,this.cutoff!.rows);
 }
 private async submitOnce(job:any){
  const uid=await this.uid();if(!await this.qualifies(job))return 'below-cutoff';
  const board=job.payload.source==='new'?'live':'historical';
  const score=doc(this.db,`${this.base}/boards/${board}/scores/${job.key}`),receipt=doc(this.db,`${this.base}/receipts/${job.key}`),budget=doc(this.db,`${this.base}/budgets/${uid}`),slots=doc(this.db,`${this.base}/slots/live`);
  return runTransaction(this.db,async tx=>{
   const existing=await tx.get(score);
   const counterpart=await tx.get(doc(this.db,`${this.base}/boards/${board==='live'?'historical':'live'}/scores/${job.key}`));
   const found=existing.exists()?existing:counterpart;
   if(found.exists())return sameRun(found.data().payload,job.payload)?'duplicate':'conflict';
   // Receipts are private; only read a known receipt when not a public duplicate.
   const budgetSnap=await tx.get(budget);const previous=budgetSnap.data();
   const slotSnap=job.payload.source==='new'&&job.payload.cheater?await tx.get(slots):undefined;
   const count=slotSnap?.data()?.count??0;
   if(count>=5)return 'rejected';
   const now=Date.now(),reset=!previous||now-previous.windowStartedAt.toMillis()>=86400000;
   const live=(reset?0:previous?.liveCount??0)+(board==='live'?1:0),historical=(reset?0:previous?.historicalCount??0)+(board==='historical'?1:0);
   // The rules enforce these independently; the client errors just avoid waste.
   if(live>60||historical>100)throw Object.assign(Error('Daily submission limit; saved locally, retry tomorrow.'),{code:'daily-limit'});
   if(previous&&now-previous.lastAt.toMillis()<1100)throw Object.assign(Error('Waiting to sync the next score.'),{code:'pacing'});
   tx.set(score,{payload:job.payload,receivedAt:serverTimestamp(),slot:board==='live'&&job.payload.cheater?count+1:0});
   tx.set(receipt,{uid,board,digest:job.digest,receivedAt:serverTimestamp()});
   tx.set(budget,{windowStartedAt:reset?serverTimestamp():previous!.windowStartedAt,liveCount:live,historicalCount:historical,lastAt:serverTimestamp(),lastRunKey:job.key,board});
   if(board==='live'&&job.payload.cheater)tx.set(slots,{count:count+1,lastRunKey:job.key});
   return 'accepted';
  });
 }
 private async readBoard(board:'live'|'historical',cursor?:any){
  await this.uid();const root=collection(this.db,`${this.base}/boards/${board}/scores`);
  const constraints:any[]=[where('payload.cheater','==',false),orderBy('payload.score','desc'),orderBy('payload.dateMs','asc'),orderBy(documentId(),'asc')];
  if(cursor)constraints.push(startAfter(cursor));constraints.push(limit(10));
  const [normal,shortcut]=await Promise.all([getDocsFromServer(query(root,...constraints)),getDocsFromServer(query(root,where('payload.cheater','==',true),orderBy(board==='live'?'slot':'payload.dateMs','asc'),orderBy(documentId(),'asc'),limit(5)))]);
  return {normal,shortcut};
 }
 async list(board:'live'|'historical'|'all',cursor?:any){
  const key=board+':'+JSON.stringify(cursor?{live:cursor.live?.id,historical:cursor.historical?.id,id:cursor.id}:null);
  const current=this.reads.get(key);if(current)return current;
  const operation=this.listOnce(board,cursor).finally(()=>this.reads.delete(key));this.reads.set(key,operation);return operation;
 }
 private async listOnce(board:'live'|'historical'|'all',cursor?:any){
  if(board!=='all'){const {normal,shortcut}=await this.readBoard(board,cursor);return {normal:normal.docs.map(s=>displayScore(s.data().payload,s.id)),cheaters:shortcut.docs.map(s=>displayScore(s.data().payload,s.id)),cursor:normal.docs.at(-1),more:normal.size===10};}
  const [live,historical]=await Promise.all([this.readBoard('live',cursor?.live),this.readBoard('historical',cursor?.historical)]);
  const rows=(page:any)=>page.normal.docs.map((s:any)=>({...displayScore(s.data().payload,s.id),snapshot:s}));
  const merged=mergeOnlineRows(rows(live),rows(historical));
  const shortcuts=rankScores([...new Map([...live.shortcut.docs,...historical.shortcut.docs].map(s=>[s.id,displayScore(s.data().payload,s.id)])).values()]);
  return {normal:merged.selected.map(({snapshot,board,...row}:any)=>row),cheaters:shortcuts.filter((row:any,index:number,all:any[])=>all.findIndex(other=>other.id===row.id)===index).slice(0,5),cursor:{live:merged.consumed.live?.snapshot??cursor?.live,historical:merged.consumed.historical?.snapshot??cursor?.historical},more:merged.more||live.normal.size===10||historical.normal.size===10};
 }
 async dispose(){await terminate(this.db);await deleteApp(this.auth.app);}
 async report(installationId:string,state:any){
  const uid=await this.uid(),ref=doc(this.db,`${this.base}/installations/${installationId}`);
  const existing=await getDocFromServer(ref);
  const first=existing.data();
  // Consent/local-state fields are private, best-effort conversion telemetry.
  await setDoc(ref,{uid,firstSeen:first?.firstSeen??serverTimestamp(),updatedAt:serverTimestamp(),...state});
 }
}
