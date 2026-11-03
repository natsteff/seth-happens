import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {ScoreOutbox} from '../src/online-score-store.mjs';
import {OnlineScores} from '../src/online-scores.mjs';
import {submission,scanLegacy,migrationSummary,scorePayload} from '../src/online-score-model.mjs';
const run=(id='one',extra={})=>({id,name:'Nate S',date:'2026-11-02T12:00:00Z',score:8000,elapsedMs:60000,bonus:6000,beer:true,photos:2,latePhotos:0,falls:0,squishes:0,bumps:0,...extra});
const storage=raw=>({getItem:()=>raw,setItem:()=>assert.fail('legacy scores must not be changed')});
const make=()=>new ScoreOutbox(new IDBFactory());
test('mixed legacy arrays classify independently without changing unknown timing or raw data',()=>{
 const untimed=run('legacy',{elapsedMs:undefined,bonus:undefined,beer:false,score:1000});const raw=JSON.stringify([untimed,{bad:true},run()]);const s=scanLegacy(raw);
 assert.equal(s.candidates.length,2);assert.equal(s.invalid,1);assert.equal(s.total,3);assert.equal(scorePayload(untimed,'historical').elapsedMs,-1);assert.equal(scorePayload(untimed,'historical').bonus,-1);
 const collision=scanLegacy(JSON.stringify([run('same'),run('same',{name:'Other'})]));assert.equal(collision.candidates.length,0);assert.equal(collision.invalid,2);
 assert.equal(scanLegacy('{bad').status,'corrupt');assert.equal(scanLegacy(null).status,'empty');assert.throws(()=>scorePayload(untimed,'new'));assert.throws(()=>scorePayload(run('one',{score:9000}),'new'));
});
test('stable run IDs/payload fingerprints deduplicate retries, preserving conflicts',async()=>{
 const s=make(),job=await submission(run());await s.enqueue(job);await s.update(job.key,{state:'accepted'});assert.equal((await s.enqueue(await submission(run()))).state,'accepted');
 const collision=await s.enqueue(await submission(run('one',{name:'Other'})));assert.equal(collision.collision,true);assert.equal((await s.jobs())[0].payload.name,'Nate S');assert.equal((await s.jobs()).length,1);
 const reopen=new ScoreOutbox(s.indexedDB);assert.equal((await reopen.jobs())[0].state,'accepted');
});
test('exclusive expiring lease and atomic new-run markers survive multiple tabs',async()=>{
 const s=make(),other=new ScoreOutbox(s.indexedDB);assert.equal(await s.claim('a',100),true);assert.equal(await other.claim('b',101),false);assert.equal(await other.claim('b',30200),true);await s.release('a');assert.equal(await s.claim('a',30201),false);await other.release('b');assert.equal(await s.claim('a',30202),true);
 await Promise.all([s.rememberRun(run('a')),other.rememberRun(run('b'))]);assert.equal((await s.get('new-runs')).length,2);
});
test('migration starts automatically, rescan recovers interrupted imports, local array untouched',async()=>{
 const s=make(),api={submit:async()=> 'accepted',report:async()=>{}},o=new OnlineScores({store:s,storage:storage(JSON.stringify([run('old')])),transport:api,visible:()=>false});await o.start();assert.equal((await s.jobs()).length,1);
 assert.equal(o.consent,'yes');assert.equal((await s.jobs()).length,1);assert.equal((await s.jobs())[0].payload.source,'historical');
 await o.enqueue(run('new'));await o.recover();assert.equal((await s.jobs()).length,2);assert.equal((await s.jobs()).find(j=>j.payload.id==='new').payload.source,'new');o.dispose();
});
test('network failure retains pending outbox, acknowledgment loss replays as duplicate, counts once',async()=>{
 const s=make();let phase=0,visible=false;const o=new OnlineScores({store:s,storage:storage(null),visible:()=>visible,transport:{submit:async()=>{if(phase++===0)throw Error('offline');return 'duplicate';},report:async()=>{throw Error('metrics outage');}}});await o.start();await o.enqueue(run());visible=true;await o.kick();
 // start/enqueue may have scheduled a kick; finish it before explicit retry.
 while(o.working)await new Promise(r=>setTimeout(r,5));
 const [job]=await s.jobs();assert.equal(job.state,'pending');assert.equal(job.attempts,1);await s.update(job.key,{nextAttempt:0});await o.kick();assert.equal((await s.jobs())[0].state,'duplicate');o.dispose();
});
test('local-only setting prevents service calls; queued results resume after opting online',async()=>{
 const s=make();await s.set('local-only',true);let writes=0;const o=new OnlineScores({store:s,storage:storage(null),visible:()=>true,transport:{submit:async()=>{writes++;return 'accepted';},report:async()=>{}}});await o.start();await o.enqueue(run());assert.equal(writes,0);await o.setLocalOnly(false);while(o.working)await new Promise(r=>setTimeout(r,5));assert.equal(writes,1);o.dispose();
});
test('unavailable persistent storage cannot falsely claim a durable queue',async()=>{
 const s=new ScoreOutbox(null);await assert.rejects(()=>s.enqueue({key:'one'}));const o=new OnlineScores({store:s,storage:storage(null),visible:()=>false});await o.start();assert.match(o.status,/unavailable/);await assert.rejects(()=>o.enqueue(run()));await o.setLocalOnly(true);assert.equal(o.localOnly,true);o.dispose();
});
test('migration report distinguishes imports/duplicates/failed/pending and never counts new runs as history',async()=>{
 const jobs=await Promise.all(['a','b','c'].map(id=>submission(run(id),'historical')));jobs[0].state='accepted';jobs[1].state='duplicate';const fresh=await submission(run('new'));const summary=migrationSummary([...jobs,fresh],{total:4,invalid:1});assert.deepEqual(summary,{total:4,invalid:1,eligible:3,imported:1,duplicates:1,pending:1,rejected:0,conflicts:0});
});

test('blocked local score storage is unknown, never miscounted as a new empty installation',async()=>{
 const o=new OnlineScores({store:make(),storage:{getItem(){throw Error('blocked');}},visible:()=>false});await o.start();assert.equal(o.baseline.status,'unavailable');assert.equal(o.scan.status,'unavailable');o.dispose();
});

test('automatic startup supersedes old Not now and never deletes local records',async()=>{
 const s=make();await s.set('migration-consent','later');const o=new OnlineScores({store:s,storage:storage(JSON.stringify([run('old')])),visible:()=>false});await o.start();assert.equal((await s.jobs()).length,1);assert.equal(o.consent,'yes');o.dispose();
});

test('unchanged recovery skips enqueue across reloads; changed legacy storage processes only changed rows',async()=>{
 const store=make();let raw=JSON.stringify([run('old')]),calls=0;
 const enqueue=store.enqueue.bind(store);store.enqueue=async job=>{calls++;return enqueue(job);};
 const options={store,storage:{getItem:()=>raw},visible:()=>false};
 const first=new OnlineScores(options);await first.start();const [job]=await store.jobs();await store.update(job.key,{state:'accepted'});assert.equal(calls,1);
 await first.recover();assert.equal(calls,1);first.dispose();
 const next=new OnlineScores(options);await next.start();assert.equal(calls,1);
 raw=JSON.stringify([run('old'),run('added')]);await next.recover();assert.equal(calls,2);
 assert.equal((await store.jobs()).find(j=>j.key===job.key).state,'accepted');next.dispose();
});
test('interrupted checkpoint write safely replays without resetting confirmed acknowledgments',async()=>{
 const store=make(),set=store.set.bind(store);let fail=true;
 store.set=async(key,value)=>{if(key==='recovery-v2'&&fail)throw Error('interrupted');return set(key,value);};
 const o=new OnlineScores({store,storage:storage(JSON.stringify([run('old')])),visible:()=>false});await o.start();
 const [job]=await store.jobs();await store.update(job.key,{state:'accepted'});fail=false;await o.recover();
 assert.equal((await store.jobs()).length,1);assert.equal((await store.jobs())[0].state,'accepted');assert.ok(await store.get('recovery-v2'));o.dispose();
});
test('a stuck submission times out to pending, releases lease, and retries the same ID',async()=>{
 const store=make();let stuck=true;const ids=[];
 const o=new OnlineScores({store,storage:storage(null),visible:()=>false,waitMs:15,transport:{submit:async job=>{ids.push(job.key);if(stuck)return new Promise(()=>{});return 'duplicate';},report:async()=>{}}});
 await o.start();await o.enqueue(run());o.visible=()=>true;await o.kick();
 const [job]=await store.jobs();assert.equal(job.state,'pending');assert.equal(job.error,'deadline');assert.equal(o.working,false);assert.equal(await store.claim('other'),true);await store.release('other');
 stuck=false;await store.update(job.key,{nextAttempt:0});await o.kick();assert.equal((await store.jobs())[0].state,'duplicate');assert.deepEqual(ids,[job.key,job.key]);o.dispose();
});
test('stalled private reporting never blocks the next submission or duplicates reports',async()=>{
 const store=make();let writes=0,reports=0;
 const o=new OnlineScores({store,storage:storage(null),visible:()=>false,transport:{submit:async()=>{writes++;return 'accepted';},report:()=>{reports++;return new Promise(()=>{});}}});
 await o.start();await o.enqueue(run('a'));await o.enqueue(run('b'));o.visible=()=>true;await o.kick();await o.kick();
 assert.equal(writes,2);assert.equal(reports,1);assert.equal(o.working,false);o.dispose();
});
test('online reads return without waiting for cache writes and stop waiting on network stalls',async()=>{
 const store=make(),set=store.set.bind(store),page={normal:[],cheaters:[],more:false};
 store.set=(key,value)=>key.startsWith('board-cache:')?new Promise(()=>{}):set(key,value);
 const o=new OnlineScores({store,visible:()=>false,waitMs:15,transport:{list:async()=>page}});
 assert.equal(await o.list('all'),page);
 o.transport.list=()=>new Promise(()=>{});await assert.rejects(()=>o.list('all'),error=>error.code==='deadline');o.dispose();
});
test('below-cutoff decisions stay terminal across recovery and later sync attempts',async()=>{
 const store=make();let writes=0;
 const o=new OnlineScores({store,storage:storage(JSON.stringify([run('low')])),visible:()=>false,transport:{submit:async()=>{writes++;return 'below-cutoff';},report:async()=>{}}});
 await o.start();o.visible=()=>true;await o.kick();await o.recover();await o.kick();assert.equal(writes,1);assert.equal((await store.jobs())[0].state,'below-cutoff');o.dispose();
});
