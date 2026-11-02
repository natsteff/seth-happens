import test from 'node:test';
import assert from 'node:assert/strict';
import {deviceFallback} from '../src/score-fallback.mjs';
import {readScores,SCORE_KEY} from '../src/scores.mjs';
test('offline/auth/quota failure falls back to unchanged device scores with a truthful notice',()=>{
 const rows=[{id:'old',name:'Nate S',score:2000,date:'2026-10-26T12:00:00Z',falls:0,squishes:0,bumps:0,photos:2,latePhotos:0,beer:true}];const raw=JSON.stringify(rows);
 const storage={getItem:key=>{assert.equal(key,SCORE_KEY);return raw;},setItem:()=>assert.fail('must not overwrite history')};
 const result=deviceFallback(()=>readScores(storage));assert.deepEqual(result.scores,rows);assert.match(result.notice,/This device/);assert.match(result.notice,/retry/);
});
test('unreadable device history is not replaced by empty or stale online records',()=>{
 assert.throws(()=>deviceFallback(()=>readScores({getItem:()=>'{broken'})));
});
