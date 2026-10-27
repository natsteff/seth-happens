import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {leaderboard} from '../server/app.mjs';
const entry=i=>({id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,name:'ABC',elapsedMs:90000,falls:1,squishes:0,bumps:0,photos:2,latePhotos:0,beer:true,score:999999});
test('shared server persists, recalculates, deduplicates, limits cheaters and protects clearing',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'seth-scores-'));const dbPath=join(dir,'scores.sqlite');
 let service=leaderboard({dbPath,origins:['https://game.example'],clearHash:'d939ba1eb4631df18cb465976aae86da2aa4ba83eef6f15307b306a51072649a'});
 async function start(){await new Promise(r=>service.server.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${service.server.address().port}/api/scores`;}
 let url=await start();
 const post=(body,path='',origin='https://game.example')=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
 try{
  let result=await (await post(entry(1))).json();assert.equal(result.scores[0].score,4990);
  assert.equal((await (await post(entry(1))).json()).scores.length,1);
  assert.equal((await post(entry(2),'','https://other.example')).status,403);
  assert.equal((await post({...entry(2),elapsedMs:180000})).status,400);
  for(let i=2;i<=7;i++)result=await (await post({...entry(i),cheater:true})).json();
  assert.equal(result.accepted,false);assert.equal(result.scores.filter(s=>s.cheater).length,5);
  assert.equal((await post({password:'wrong'},'/clear')).status,403);
  await new Promise(r=>service.server.close(r));service.close();
  service=leaderboard({dbPath,origins:['https://game.example']});url=await start();
  assert.equal((await (await fetch(url)).json()).scores.length,6);
  assert.equal((await post({password:'anything'},'/clear')).status,503);
 }finally{await new Promise(r=>service.server.close(r));service.close();rmSync(dir,{recursive:true});}
});
