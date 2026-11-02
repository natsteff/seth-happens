import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeOnlineRows} from '../src/online-score-model.mjs';
const row=(id,score)=>({id,score,date:'2026-11-02T12:00:00Z'});
test('combined Online board ranks imported and new scores together',()=>{
 const page=mergeOnlineRows([row('new',4000)],[row('old',8000)]);
 assert.deepEqual(page.selected.map(r=>r.id),['old','new']);
});
test('pagination consumes only selected rows, so high scores from either board cannot be skipped',()=>{
 const live=Array.from({length:10},(_,i)=>row(`live${i}`,10000-i)),historical=[row('old',500)];
 const page=mergeOnlineRows(live,historical);assert.equal(page.selected.length,10);assert.equal(page.consumed.historical,undefined);assert.equal(page.consumed.live.id,'live9');assert.equal(page.more,true);
});
test('duplicate IDs are displayed once and ties retain the earliest finish',()=>{
 const a=row('same',1000),b={...row('earlier',1000),date:'2026-11-01T12:00:00Z'};
 const page=mergeOnlineRows([a],[a,b]);assert.deepEqual(page.selected.map(r=>r.id),['earlier','same']);
});
