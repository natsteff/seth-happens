import {initializeApp,getApps,deleteApp} from 'firebase/app';
import {getAuth,signInAnonymously,connectAuthEmulator,setPersistence,indexedDBLocalPersistence} from 'firebase/auth';
import {initializeFirestore,connectFirestoreEmulator,doc,collection,runTransaction,serverTimestamp,getDocsFromServer,query,where,orderBy,limit,startAfter,documentId,getDocFromServer,setDoc,terminate} from 'firebase/firestore';
import {sameRun,displayScore} from './online-score-model.mjs';

export class FirebaseScores{
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
  const uid=await this.uid(),board=job.payload.source==='new'?'live':'historical';
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
 async list(board:'live'|'historical',cursor?:any){
  await this.uid();const root=collection(this.db,`${this.base}/boards/${board}/scores`);
  const constraints:any[]=[where('payload.cheater','==',false),orderBy('payload.score','desc'),orderBy('payload.dateMs','asc'),orderBy(documentId(),'asc')];
  if(cursor)constraints.push(startAfter(cursor));constraints.push(limit(10));
  const normal=await getDocsFromServer(query(root,...constraints));
  const shortcut=await getDocsFromServer(query(root,where('payload.cheater','==',true),orderBy(board==='live'?'slot':'payload.dateMs','asc'),orderBy(documentId(),'asc'),limit(5)));
  return {normal:normal.docs.map(s=>displayScore(s.data().payload,s.id)),cheaters:shortcut.docs.map(s=>displayScore(s.data().payload,s.id)),cursor:normal.docs.at(-1),more:normal.size===10};
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
