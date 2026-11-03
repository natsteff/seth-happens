import {initializeApp,getApps,deleteApp} from 'firebase/app';
import {getAuth,signInAnonymously,connectAuthEmulator,setPersistence,indexedDBLocalPersistence} from 'firebase/auth';
import {initializeFirestore,connectFirestoreEmulator,doc,collection,runTransaction,serverTimestamp,getDocsFromServer,query,where,orderBy,limit,startAfter,documentId,getDocFromServer,setDoc,terminate} from 'firebase/firestore';
import {BOOK_PATH,runDigest,updateBook,bookPage} from './record-book.mjs';
import {rankScores} from './scores.mjs';
import {sameRun,displayScore,mergeOnlineRows,qualifiesForTop25} from './online-score-model.mjs';

export class FirebaseScores{
 private reads=new Map<string,Promise<any>>();private submissions=new Map<string,Promise<any>>();
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
  const operation=this.submitOnce(job).finally(()=>this.submissions.delete(job.key));
  this.submissions.set(job.key,operation);return operation;
 }
 private async submitOnce(job:any){
  const uid=await this.uid(),digest=await runDigest(job.payload);
  const bookRef=doc(this.db,BOOK_PATH),seenRef=doc(this.db,`${this.base}/seen-runs/${job.key}`),budgetRef=doc(this.db,`${this.base}/budgets-v2/${uid}`);
  return runTransaction(this.db,async tx=>{
   const seen=await tx.get(seenRef);
   if(seen.exists())return seen.data().digest===digest?'duplicate':'conflict';
   const snapshot=await tx.get(bookRef);
   if(!snapshot.exists())throw Object.assign(Error('Online record book upgrade is not active yet.'),{code:'upgrade-pending'});
   const book=updateBook(snapshot.data(),job);if(!book)return 'below-cutoff';
   const previous=(await tx.get(budgetRef)).data();
   const now=Date.now(),reset=!previous||now-previous.windowStartedAt.toMillis()>=86400000;
   const board=job.payload.source==='new'?'live':'historical';
   const live=(reset?0:previous?.liveCount??0)+(board==='live'?1:0),historical=(reset?0:previous?.historicalCount??0)+(board==='historical'?1:0);
   if(live>60||historical>100)throw Object.assign(Error('Daily submission limit.'),{code:'daily-limit'});
   if(previous&&now-previous.lastAt.toMillis()<1100)throw Object.assign(Error('Waiting for next submission.'),{code:'pacing'});
   tx.set(bookRef,{...book,updatedAt:serverTimestamp(),lastKey:job.key,lastDigest:digest,lastPayload:job.payload,lastFirstSeenMs:job.firstSeenMs??job.payload.dateMs,lastPosition:job.payload.cheater?book.cheaters.findIndex((row:any)=>row.nameKey===job.payload.name.trim().toLowerCase()):book.normal.findIndex((row:any)=>row.key===job.key)});
   tx.set(seenRef,{digest,source:job.payload.source,receivedAt:serverTimestamp()});
   tx.set(budgetRef,{windowStartedAt:reset?serverTimestamp():previous!.windowStartedAt,liveCount:live,historicalCount:historical,lastAt:serverTimestamp(),lastRunKey:job.key,board});
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
  const key=board+':'+JSON.stringify(cursor?.book?{revision:cursor.book.revision,offset:cursor.offset}:cursor?{live:cursor.live?.id,historical:cursor.historical?.id,id:cursor.id}:null);
  const current=this.reads.get(key);if(current)return current;
  const operation=this.listOnce(board,cursor).finally(()=>this.reads.delete(key));this.reads.set(key,operation);return operation;
 }
 private async listOnce(board:'live'|'historical'|'all',cursor?:any){
  if(board==='all'){
   if(cursor?.book)return bookPage(cursor.book,cursor.offset);
   await this.uid();const snapshot=await getDocFromServer(doc(this.db,BOOK_PATH));
   if(snapshot.exists())return bookPage(snapshot.data());
   // Read compatibility until the owner activates the backed-up upgrade.
  }
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
