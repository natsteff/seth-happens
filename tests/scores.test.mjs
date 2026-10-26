import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readScores,saveScore,rankScores,verifyClearPassword} from '../src/scores.mjs';
import {fallingAssignments} from '../src/mission.mjs';
const entry=(id,score,date='2026-10-26T12:00:00Z')=>({id,score,date,name:'ABC',falls:0,squishes:0,bumps:0,photos:2,latePhotos:0,beer:true});
test('all four falling objects are guaranteed in every route',()=>{
  assert.deepEqual(new Set(fallingAssignments.map(([,kind])=>kind)),new Set(['anvil','ac','cooler','piano']));
  assert.equal(new Set(fallingAssignments.map(([floor])=>floor)).size,4);
});
test('scores persist, retain history, deduplicate results, and rank ties by earliest run',()=>{
  let data=null;const storage={getItem:()=>data,setItem:(_key,value)=>{data=value;}};
  assert.deepEqual(readScores(storage),[]);
  for(let i=0;i<12;i++)saveScore(storage,entry(String(i),1000+i));
  saveScore(storage,entry('0',1000));
  assert.equal(readScores(storage).length,12);
  assert.equal(readScores(storage)[0].score,1011);
  assert.deepEqual(rankScores([entry('later',2000,'2026-10-27T12:00:00Z'),entry('earlier',2000)]).map(s=>s.id),['earlier','later']);
});
test('storage failures and corrupt records do not overwrite previous data',()=>{
  const storage={getItem:()=>'{broken',setItem:()=>{assert.fail('must not overwrite');}};
  assert.throws(()=>saveScore(storage,entry('1',2000)));
  assert.throws(()=>saveScore({...storage,getItem:()=>JSON.stringify([{bad:true}])},entry('1',2000)));
  assert.throws(()=>saveScore({getItem:()=>null,setItem:()=>{throw Error('quota');}},entry('1',2000)),/quota/);
});
test('wrong clear password is rejected',async()=>{
  assert.equal(await verifyClearPassword('incorrect'),false);
});
