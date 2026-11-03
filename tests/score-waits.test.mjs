import test from 'node:test';
import assert from 'node:assert/strict';
import {withDeadline} from '../src/score-waits.mjs';
import {qualifiesForTop25} from '../src/online-score-model.mjs';
test('foreground timeout does not falsely cancel or acknowledge the underlying operation',async()=>{
 let resolve;const operation=new Promise(done=>{resolve=done;});
 await assert.rejects(()=>withDeadline(operation,10),error=>error.code==='deadline');
 resolve('accepted');assert.equal(await operation,'accepted');assert.equal(await withDeadline(Promise.resolve('ok'),10),'ok');
});
test('top-25 admission honors count, score, date, stable tie key and known IDs',()=>{
 const rows=Array.from({length:25},(_,i)=>({key:'key'+i,score:1000-i,dateMs:100}));
 const payload={score:975,dateMs:100};
 assert.equal(qualifiesForTop25(payload,'new',rows.slice(0,24)),true);
 assert.equal(qualifiesForTop25(payload,'new',rows),false);
 assert.equal(qualifiesForTop25({...payload,score:976,dateMs:99},'new',rows),true);
 assert.equal(qualifiesForTop25({...payload,score:976,dateMs:101},'new',rows),false);
 assert.equal(qualifiesForTop25({...payload,score:976},'a',rows),true);
 assert.equal(qualifiesForTop25({...payload,score:976},'z',rows),false);
 assert.equal(qualifiesForTop25(payload,'key24',rows),true);
 assert.equal(qualifiesForTop25({...payload,cheater:true},'new',rows),true);
});
