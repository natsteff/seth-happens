import test,{after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,query,limit,writeBatch,serverTimestamp,Timestamp,deleteDoc} from 'firebase/firestore';
import {submission} from '../src/online-score-model.mjs';
const env=await initializeTestEnvironment({projectId:'demo-seth-happens',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync(new URL('../firebase/firestore.rules',import.meta.url),'utf8')}});
after(()=>env.cleanup());beforeEach(()=>env.clearFirestore());
const base='games/beer-run';
const run=(id='run',extra={})=>({id,name:'Nate S',date:'2026-11-02T12:00:00Z',score:8000,elapsedMs:60000,bonus:6000,beer:true,photos:2,latePhotos:0,falls:0,squishes:0,bumps:0,...extra});
async function prepare(uid='alice',extra={},source='new'){
 const db=env.authenticatedContext(uid).firestore(),job=await submission(run('run',extra),source),board=source==='new'?'live':'historical';
 return {db,job,board,uid};
}
function batchFor(x,{payload=x.job.payload,budget={},receipt={},slot,omitBudget=false,omitReceipt=false}={}){
 const b=writeBatch(x.db),key=x.job.key,board=x.board;
 b.set(doc(x.db,`${base}/boards/${board}/scores/${key}`),{payload,receivedAt:serverTimestamp(),slot:slot??(board==='live'&&payload.cheater?1:0)});
 if(!omitReceipt)b.set(doc(x.db,`${base}/receipts/${key}`),{uid:x.uid,board,digest:x.job.digest,receivedAt:serverTimestamp(),...receipt});
 if(!omitBudget)b.set(doc(x.db,`${base}/budgets/${x.uid}`),{windowStartedAt:serverTimestamp(),lastAt:serverTimestamp(),lastRunKey:key,board,liveCount:board==='live'?1:0,historicalCount:board==='historical'?1:0,...budget});
 if(board==='live'&&payload.cheater)b.set(doc(x.db,`${base}/slots/live`),{count:slot??1,lastRunKey:key});
 return b;
}
test('valid atomic live save, bounded public query; anonymous unauthenticated writes/reads denied',async()=>{
 const x=await prepare();await assertSucceeds(batchFor(x).commit());
 await assertSucceeds(getDocs(query(collection(x.db,`${base}/boards/live/scores`),limit(10))));
 await assertFails(getDocs(collection(x.db,`${base}/boards/live/scores`)));
 const db=env.unauthenticatedContext().firestore();await assertFails(getDoc(doc(db,`${base}/boards/live/scores/${x.job.key}`)));
 await assertFails(setDoc(doc(db,`${base}/boards/live/scores/bad`),{}));
});
test('rejects forged total/bonus, missing beer, expired duration, controls and unexpected fields',async()=>{
 const changes=[{score:14000},{bonus:0},{beer:false},{elapsedMs:120000},{name:'bad\nname'},{name:'                 '},{privateData:'leak'},{photos:3},{latePhotos:3},{falls:-1},{gameId:'v2'},{source:'historical'}];
 for(const change of changes){const x=await prepare();await assertFails(batchFor(x,{payload:{...x.job.payload,...change}}).commit());}
});
test('requires own atomic receipt/budget; no public edits/deletes or private report/receipt leakage',async()=>{
 const x=await prepare();await assertFails(batchFor(x,{omitBudget:true}).commit());await assertFails(batchFor(x,{omitReceipt:true}).commit());await assertFails(batchFor(x,{receipt:{uid:'bob'}}).commit());
 await assertSucceeds(batchFor(x).commit());await assertFails(setDoc(doc(x.db,`${base}/boards/live/scores/${x.job.key}`),{payload:x.job.payload}));await assertFails(deleteDoc(doc(x.db,`${base}/boards/live/scores/${x.job.key}`)));
 const db=env.authenticatedContext('bob').firestore();await assertFails(getDoc(doc(db,`${base}/receipts/${x.job.key}`)));await assertFails(getDocs(collection(db,`${base}/receipts`)));await assertFails(getDocs(collection(db,`${base}/installations`)));
});
test('historical untimed/no-beer records allowed without invented timer; wrong historical total bounds rejected',async()=>{
 const x=await prepare('alice',{elapsedMs:undefined,bonus:undefined,beer:false,score:1250},'historical');await assertSucceeds(batchFor(x).commit());assert.equal(x.job.payload.elapsedMs,-1);
 const y=await prepare('bob',{id:'other',elapsedMs:150000,score:2000},'historical');await assertSucceeds(batchFor(y).commit());
 const z=await prepare('eve',{id:'third',elapsedMs:undefined,score:1000},'historical');await assertFails(batchFor(z,{payload:{...z.job.payload,score:15000}}).commit());
});
test('pacing and daily budgets cannot be reset or bypassed with extra batch writes',async()=>{
 const x=await prepare();await assertSucceeds(batchFor(x).commit());
 const y={...await prepare('alice',{id:'two'})};await assertFails(batchFor(y).commit());
 await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),`${base}/budgets/alice`),{windowStartedAt:Timestamp.fromMillis(Date.now()-10000),lastAt:Timestamp.fromMillis(Date.now()-5000),lastRunKey:x.job.key,board:'live',liveCount:60,historicalCount:0});});
 await assertFails(batchFor(y).commit());await assertFails(batchFor(y,{budget:{liveCount:61}}).commit());
 // One budget cannot authorize two score creates in the same commit.
 const fresh=await prepare('fresh');const b=batchFor(fresh);const second=await submission(run('second'));b.set(doc(fresh.db,`${base}/boards/live/scores/${second.key}`),{payload:second.payload,receivedAt:serverTimestamp(),slot:0});await assertFails(b.commit());
});
test('live shortcut slots are capped centrally, immutable and linked to actual shortcut score',async()=>{
 const x=await prepare('one',{score:-10000,cheater:true,beer:false,bonus:0});await assertSucceeds(batchFor(x).commit());
 const y=await prepare('two',{id:'two',score:-10000,cheater:true,bonus:0});await assertFails(batchFor(y,{slot:1}).commit());await assertSucceeds(batchFor(y,{slot:2}).commit());
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),`${base}/slots/live`),{count:5,lastRunKey:y.job.key}));
 const z=await prepare('three',{id:'three',score:-10000,cheater:true,bonus:0});await assertFails(batchFor(z,{slot:6}).commit());
});
async function boundedClient(){
 const {emptyBook,BOOK_PATH}=await import('../src/record-book.mjs');
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),BOOK_PATH),emptyBook()));
 const {FirebaseScores}=await import('../src/firebase-scores.ts');
 return new FirebaseScores({apiKey:'demo-key',authDomain:'demo-seth-happens.firebaseapp.com',projectId:'demo-seth-happens'},true);
}
test('bounded client saves atomically, acknowledges duplicate IDs and refuses private access',async()=>{
 const client=await boundedClient();
 try{
  const job=await submission(run('adapter'));
  assert.deepEqual(await Promise.all([client.submit(job),client.submit(job)]),['accepted','accepted']);
  assert.equal(await client.submit(job),'duplicate');
  assert.equal(await client.submit(await submission(run('adapter'),'historical')),'duplicate');
  assert.equal(await client.submit(await submission(run('adapter',{name:'Other'}))),'conflict');
  const page=await client.list('all');assert.equal(page.normal.length,1);assert.equal(page.normal[0].runId,'adapter');
  const stranger=env.authenticatedContext('stranger').firestore();
  await assertFails(getDocs(collection(stranger,`${base}/seen-runs`)));
  await assertFails(setDoc(doc(stranger,`${base}/record-book/current`),{normal:[],cheaters:[],schema:2,revision:100}));
  await assertFails(deleteDoc(doc(stranger,`${base}/record-book/current`)));
  // Legacy clients cannot create another unbounded record after activation.
  const legacy=await prepare('old-client',{id:'old'});await assertFails(batchFor(legacy).commit());
 }finally{await client.dispose();}
});
test('full normal book replaces only its cutoff and permanently remembers dropped submissions',async()=>{
 const client=await boundedClient();
 try{
  const {BOOK_PATH,emptyBook,updateBook,runDigest}=await import('../src/record-book.mjs');
  let book=emptyBook();const jobs=[];
  for(let i=0;i<25;i++){const job=await submission(run('seed'+i,{score:8000+i}),'historical');jobs.push(job);book=updateBook(book,job);}
  await env.withSecurityRulesDisabled(async c=>{const db=c.firestore(),b=writeBatch(db);b.set(doc(db,BOOK_PATH),book);for(const job of jobs)b.set(doc(db,`${base}/seen-runs/${job.key}`),{digest:await runDigest(job.payload),receivedAt:Timestamp.now()});await b.commit();});
  assert.equal(await client.submit(await submission(run('low',{score:1000}),'historical')),'below-cutoff');
  const high=await submission(run('high',{score:13000}),'historical');assert.equal(await client.submit(high),'accepted');
  assert.equal(await client.submit(jobs[0]),'duplicate');
  const page=await client.list('all');assert.equal(page.normal[0].score,13000);assert.equal(page.normal.length,10);
  const last=await client.list('all',{offset:20,book:(await getDoc(doc(env.authenticatedContext('reader').firestore(),BOOK_PATH))).data()});assert.equal(last.normal.length,5);assert.equal(last.more,false);
  assert.equal((await getDoc(doc(env.authenticatedContext('reader').firestore(),BOOK_PATH))).data().normal.length,25);
 }finally{await client.dispose();}
});
test('shortcut name improves inside full book; forged replacement, clear and budget reset denied',async()=>{
 const client=await boundedClient();
 try{
  const {BOOK_PATH,emptyBook,updateBook}=await import('../src/record-book.mjs');let book=emptyBook();
  for(let i=0;i<5;i++)book=updateBook(book,await submission(run('seed'+i,{name:'Name'+i,score:-10000,cheater:true,bonus:0,date:new Date(Date.UTC(2026,10,2,12,i)).toISOString()})));
  await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),BOOK_PATH),book));
  assert.equal(await client.submit(await submission(run('sixth',{name:'Sixth',score:-10000,cheater:true,bonus:0,date:'2026-11-02T13:00:00Z'}))),'below-cutoff');
  const better=await submission(run('better',{name:' NAME0 ',score:-10000,cheater:true,bonus:0,elapsedMs:10000,date:'2026-11-02T14:00:00Z'}));
  assert.equal(await client.submit(better),'accepted');
  const db=env.authenticatedContext('attacker').firestore(),ref=doc(db,BOOK_PATH),saved=(await getDoc(ref)).data();
  assert.equal(saved.cheaters.length,5);assert.equal(saved.cheaters[0].payload.id,'better');assert.equal(saved.cheaters[0].firstSeenMs,Date.parse('2026-11-02T12:00:00Z'));
  await assertFails(setDoc(ref,{...saved,revision:saved.revision+1,updatedAt:serverTimestamp(),cheaters:[]}));
  await assertFails(setDoc(doc(db,`${base}/budgets-v2/attacker`),{windowStartedAt:serverTimestamp(),lastAt:serverTimestamp(),lastRunKey:better.key,board:'live',liveCount:0,historicalCount:0}));
  // Another run cannot rewrite a receipt or resurrect the original winner.
  await assertFails(setDoc(doc(db,`${base}/seen-runs/${better.key}`),{digest:'0'.repeat(64),receivedAt:serverTimestamp()}));
 }finally{await client.dispose();}
});
async function forgedBookBatch(db,job,book){
 const {BOOK_PATH,runDigest}=await import('../src/record-book.mjs'),uid='forger',digest=await runDigest(job.payload),b=writeBatch(db);
 b.set(doc(db,BOOK_PATH),{...book,updatedAt:serverTimestamp(),lastKey:job.key,lastDigest:digest,lastPayload:job.payload,lastFirstSeenMs:job.payload.dateMs,lastPosition:book.normal.findIndex(row=>row.key===job.key)});
 b.set(doc(db,`${base}/seen-runs/${job.key}`),{digest,source:job.payload.source,receivedAt:serverTimestamp()});
 b.set(doc(db,`${base}/budgets-v2/${uid}`),{windowStartedAt:serverTimestamp(),lastAt:serverTimestamp(),lastRunKey:job.key,board:'historical',liveCount:0,historicalCount:1});
 return b;
}
test('bounded rules reject low-cutoff swaps, dropped rows and reordered survivors even with valid atomic receipts',async()=>{
 const {BOOK_PATH,emptyBook,updateBook}=await import('../src/record-book.mjs');let book=emptyBook();
 for(let i=0;i<25;i++)book=updateBook(book,await submission(run('old'+i,{score:9000+i}),'historical'));
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),BOOK_PATH),book));
 const db=env.authenticatedContext('forger').firestore(),low=await submission(run('low'),'historical');
 const lowRow={key:low.key,payload:low.payload,firstSeenMs:low.payload.dateMs,nameKey:''};
 await assertFails((await forgedBookBatch(db,low,{...book,revision:book.revision+1,normal:[...book.normal.slice(0,24),lowRow]})).commit());
 const high=await submission(run('high',{score:13000}),'historical'),valid=updateBook(book,high);
 await assertFails((await forgedBookBatch(db,high,{...valid,normal:valid.normal.slice(0,24)})).commit());
 const reordered=[...valid.normal];[reordered[10],reordered[11]]=[reordered[11],reordered[10]];
 await assertFails((await forgedBookBatch(db,high,{...valid,normal:reordered})).commit());
 await assertSucceeds((await forgedBookBatch(db,high,valid)).commit());
});
