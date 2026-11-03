import test from 'node:test';
import assert from 'node:assert/strict';
import {rankScores,saveScore,compactScores,SCORE_KEY,SCORE_BACKUP_KEY} from '../src/scores.mjs';
import {submission,displayScore} from '../src/online-score-model.mjs';
import {emptyBook,updateBook,bookPage,isSavedRun} from '../src/record-book.mjs';
const run=(id,extra={})=>({id,name:'Nate S',date:'2026-11-02T12:00:00Z',score:8000,elapsedMs:60000,bonus:6000,beer:true,photos:2,latePhotos:0,falls:0,squishes:0,bumps:0,...extra});
const shortcut=(id,name='Nate S',extra={})=>run(id,{name,cheater:true,score:-10000,bonus:0,...extra});
function storage(rows){const map=new Map([[SCORE_KEY,JSON.stringify(rows)]]);return {map,getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};}
test('local active scores compact to 25+5 and preserve byte-exact backup before pruning',()=>{
 const s=storage(Array.from({length:40},(_,i)=>run('n'+i,{score:8000+i})));const raw=s.getItem(SCORE_KEY);
 compactScores(s);assert.equal(JSON.parse(s.getItem(SCORE_KEY)).length,25);assert.equal(s.getItem(SCORE_BACKUP_KEY),raw);
 saveScore(s,run('low',{score:1000}));assert.equal(JSON.parse(s.getItem(SCORE_KEY)).length,25);assert.equal(s.getItem(SCORE_BACKUP_KEY),raw);
 const denied={getItem:key=>key===SCORE_KEY?raw:null,setItem(){throw Error('quota');}};assert.throws(()=>compactScores(denied),/quota/);
});
test('distinct shortcut names keep fastest then cleanest then oldest and preserve first admission',()=>{
 const rows=[shortcut('old',' Nate ',{elapsedMs:50000}),shortcut('best','nate',{elapsedMs:40000,bumps:2,date:'2026-11-02T13:00:00Z'}),shortcut('clean','NATE',{elapsedMs:40000,date:'2026-11-02T14:00:00Z'}),shortcut('later','Nate',{elapsedMs:40000,date:'2026-11-02T15:00:00Z'})];
 const [winner]=rankScores(rows);assert.equal(winner.id,'clean');assert.equal(winner.cheaterFirstSeenMs,Date.parse(rows[0].date));
 const s=storage([...rows,...Array.from({length:5},(_,i)=>shortcut('c'+i,'Other'+i,{date:'2026-11-02T16:00:00Z'}))]);compactScores(s);
 assert.equal(JSON.parse(s.getItem(SCORE_KEY)).length,5);const improved=shortcut('improved','nAtE',{elapsedMs:30000,date:'2026-11-02T17:00:00Z'});assert.equal(saveScore(s,improved)[0].id,'improved');
 const timed=rankScores([shortcut('unknown','same',{elapsedMs:undefined}),shortcut('known','SAME',{elapsedMs:90000})]);assert.equal(timed[0].id,'known');
});
test('bounded shared book rejects lows, replaces cutoff atomically and pages only 25 normal rows',async()=>{
 let book=emptyBook();for(let i=0;i<30;i++){const job=await submission(run('n'+i,{score:8000+i}),'historical');book=updateBook(book,job)??book;}
 assert.equal(book.normal.length,25);assert.equal(updateBook(book,await submission(run('low',{score:1000}),'historical')),null);
 assert.equal(bookPage(book).normal.length,10);assert.equal(bookPage(book,20).normal.length,5);assert.equal(bookPage(book,20).more,false);
});
test('shared duplicate-name improvement preserves admission and highlight matches exact original ID',async()=>{
 let book=emptyBook();for(let i=0;i<6;i++)book=updateBook(book,await submission(shortcut('c'+i,'name'+i,{date:new Date(Date.UTC(2026,10,2,12,i)).toISOString()})))??book;
 assert.equal(book.cheaters.length,5);const improvement=await submission(shortcut('better','NAME0',{elapsedMs:10000,date:'2026-11-02T13:00:00Z'}));book=updateBook(book,improvement);
 assert.equal(book.cheaters.length,5);assert.equal(book.cheaters[0].key,improvement.key);assert.equal(book.cheaters[0].firstSeenMs,Date.parse('2026-11-02T12:00:00Z'));
 const row=displayScore(improvement.payload,improvement.key);assert.equal(isSavedRun(row,'better'),true);assert.equal(isSavedRun(row,'c0'),false);assert.equal(isSavedRun({...row,id:'same-name',runId:'other'},'better'),false);
 assert.equal(isSavedRun({id:'better'},'better'),true);
});
test('conflicting IDs or invalid admission metadata refuse cleanup without touching originals',()=>{
 for(const rows of [[run('same'),run('same',{name:'Different'})],[shortcut('bad','name',{cheaterFirstSeenMs:1.5})]]){
  const s=storage(rows),raw=s.getItem(SCORE_KEY);assert.throws(()=>compactScores(s));assert.equal(s.getItem(SCORE_KEY),raw);assert.equal(s.getItem(SCORE_BACKUP_KEY),null);
 }
});
