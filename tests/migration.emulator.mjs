import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {submission} from '../src/online-score-model.mjs';
import {BOOK_PATH} from '../src/record-book.mjs';
if(!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:'))throw Error('Emulator only');
process.env.METADATA_SERVER_DETECTION='none';
const db=getFirestore(initializeApp({projectId:'demo-seth-happens'}));
test('owner migration backs up all originals, bounds active book, tombstones pruned IDs and restores without overwrite',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'seth-book-migration-')),backup=join(dir,'backup.json');
 try{
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-seth-happens/databases/(default)/documents',{method:'DELETE'});
  const batch=db.batch();
  for(let i=0;i<48;i++){
   const cheater=i>=40,record={id:'migrate'+i,name:cheater?'Name'+Math.floor((i-40)/2):'Normal',score:cheater?-10000:8000+i,date:new Date(Date.UTC(2026,10,2,12,i)).toISOString(),elapsedMs:cheater?60000-i:60000,bonus:cheater?0:6000,beer:true,photos:2,latePhotos:0,falls:0,squishes:0,bumps:0,cheater};
   const job=await submission(record,'historical');batch.set(db.doc(`games/beer-run/boards/historical/scores/${job.key}`),{payload:job.payload,slot:0,receivedAt:Timestamp.now()});
  }
  await batch.commit();
  const execute=args=>JSON.parse(execFileSync(process.execPath,['scripts/migrate-record-book.mjs',...args],{encoding:'utf8',env:process.env}).trim().split('\n').at(-1));
  const result=execute(['--backup',backup,'--apply']);assert.equal(result.activated,true);assert.equal(result.legacyRemaining,0);
  const data=JSON.parse(readFileSync(backup,'utf8'));assert.equal(data.rows.length,48);
  const book=(await db.doc(BOOK_PATH).get()).data();assert.equal(book.normal.length,25);assert.equal(book.cheaters.length,4);assert.equal((await db.collection('games/beer-run/seen-runs').get()).size,48);
  const restore=execute(['--restore',backup,'--apply']);assert.equal(restore.activeBookUnchanged,true);assert.equal((await db.collection('games/beer-run/boards/historical/scores').get()).size,48);
  assert.ok((await db.collection('games/beer-run/boards/historical/scores').limit(1).get()).docs[0].data().receivedAt instanceof Timestamp);
  const again=execute(['--restore',backup,'--apply']);assert.equal(again.records,48);
 }finally{await db.terminate();rmSync(dir,{recursive:true,force:true});}
});
