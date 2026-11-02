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
test('real Firebase client saves, acknowledges duplicates across history, queries and reports privately',async()=>{
 const {FirebaseScores}=await import('../src/firebase-scores.ts');
 const transport=new FirebaseScores({apiKey:'demo-key',authDomain:'demo-seth-happens.firebaseapp.com',projectId:'demo-seth-happens'},true);
 const job=await submission(run('adapter-run'));
 assert.equal(await transport.submit(job),'accepted');assert.equal(await transport.submit(job),'duplicate');
 assert.equal(await transport.submit(await submission(run('adapter-run'),'historical')),'duplicate');
 assert.equal(await transport.submit(await submission(run('adapter-run',{name:'Imposter'}),'historical')),'conflict');
 const page=await transport.list('live');assert.equal(page.normal.length,1);assert.equal(page.normal[0].name,'Nate S');
 const id=crypto.randomUUID();await transport.report(id,{baselineStatus:'valid',hadExisting:true,consent:'yes',boardUsed:true,total:1,invalid:0,eligible:1,imported:1,duplicates:0,pending:0,rejected:0,conflicts:0,everFailed:false,failedPending:0,newSubmitted:true,lastError:''});
 const stranger=env.authenticatedContext('stranger').firestore();await assertFails(getDoc(doc(stranger,`${base}/installations/${id}`)));await transport.dispose();
});
