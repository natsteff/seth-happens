// Owner-only, one-time upgrade. Never imported by the browser game.
import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getFirestore,Timestamp,FieldValue} from 'firebase-admin/firestore';
import {createRequire} from 'node:module';
import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {BOOK_PATH,emptyBook,retainBook,runDigest} from '../src/record-book.mjs';
import {scorePayload,sameRun} from '../src/online-score-model.mjs';
const args=process.argv.slice(2),apply=args.includes('--apply'),emulator=process.env.FIRESTORE_EMULATOR_HOST;
if(emulator&&!/^127\.0\.0\.1:\d+$/.test(emulator))throw Error('Only loopback emulator supported.');
const restoreIndex=args.indexOf('--restore'),restore=restoreIndex>=0?resolve(args[restoreIndex+1]):null;
const outputIndex=args.indexOf('--backup'),output=outputIndex>=0?resolve(args[outputIndex+1]):null;
if(apply&&!output&&!restore)throw Error('--apply requires --backup /absolute/private/path.json.');
if(emulator)process.env.METADATA_SERVER_DETECTION='none';
let credential,cliClient;
if(!emulator&&args.includes('--firebase-cli')){
 const require=createRequire(import.meta.url),auth=require('firebase-tools/lib/auth');
 const account=auth.getGlobalDefaultAccount();if(!account)throw Error('Sign in with ./firebase-tool.sh login first.');
 await require('firebase-tools/lib/requireAuth').requireAuth({project:'seth-happens',...account});
 const adminRequire=createRequire(require.resolve('firebase-admin/firestore'));const {Firestore}=adminRequire('@google-cloud/firestore');const cloudRequire=createRequire(adminRequire.resolve('@google-cloud/firestore'));const {OAuth2Client}=cloudRequire('google-auth-library');const t=await auth.getAccessToken(account.tokens.refresh_token,[]);const oauth=new OAuth2Client();oauth.setCredentials({access_token:t.access_token,expiry_date:t.expires_at??Date.now()+3600000});cliClient=new Firestore({projectId:'seth-happens',authClient:oauth});
}else if(!emulator)credential=applicationDefault();
initializeApp({projectId:emulator?'demo-seth-happens':'seth-happens',...(credential?{credential}:{})});
const db=cliClient??getFirestore(),bookRef=db.doc(BOOK_PATH),root=db.doc('games/beer-run');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const snapshotRows=async reader=>{
 const snapshots=await Promise.all(['live','historical'].map(board=>reader(root.collection('boards').doc(board).collection('scores'))));
 return snapshots.flatMap(snapshot=>snapshot.docs.map(doc=>({path:doc.ref.path,data:doc.data()}))).sort((a,b)=>a.path.localeCompare(b.path));
};
try{
 if(restore){
  const backup=JSON.parse(readFileSync(restore,'utf8'));
  if(backup.schema!==1||backup.project!==(emulator?'demo-seth-happens':'seth-happens')||!Array.isArray(backup.rows))throw Error('Wrong backup/project.');
  for(const row of backup.rows){
   if(!/^games\/beer-run\/boards\/(live|historical)\/scores\/[a-f0-9]{64}$/.test(row.path))throw Error('Invalid backup path.');
   const old=await db.doc(row.path).get();if(old.exists&&hash(old.data())!==hash(row.data))throw Error('Existing record differs; restore refuses overwrite.');
   if(apply&&!old.exists){const data={...row.data};if(data.receivedAt){const seconds=data.receivedAt.seconds??data.receivedAt._seconds,nanos=data.receivedAt.nanoseconds??data.receivedAt._nanoseconds;if(typeof seconds==='number')data.receivedAt=new Timestamp(seconds,nanos);}await db.doc(row.path).create(data);}
  }
  console.log(JSON.stringify({restore:true,apply,records:backup.rows.length,activeBookUnchanged:true}));
 }else{
 if((await bookRef.get()).exists)throw Error('Book already activated; refuse a second migration or overwrite.');
 const rows=await snapshotRows(query=>query.get()),byKey=new Map();
 for(const row of rows){
  const key=row.path.split('/').at(-1),p=row.data.payload;
  if(!/^[a-f0-9]{64}$/.test(key))throw Error('Invalid legacy key; no cleanup performed.');
  // Validate imported records without inventing missing legacy timing.
  scorePayload({...p,date:new Date(p.dateMs).toISOString(),elapsedMs:p.elapsedMs===-1?undefined:p.elapsedMs,bonus:p.bonus===-1?undefined:p.bonus},p.source);
  const previous=byKey.get(key);if(previous&&!sameRun(previous.payload,p))throw Error('Conflicting legacy run; no cleanup performed.');
  byKey.set(key,{key,payload:p,firstSeenMs:p.dateMs,nameKey:''});
 }
 const entries=retainBook([...byKey.values()]),book={...emptyBook(),normal:entries.filter(e=>!e.payload.cheater),cheaters:entries.filter(e=>e.payload.cheater)};
 const backup={schema:1,project:emulator?'demo-seth-happens':'seth-happens',createdAt:new Date().toISOString(),rows,book};
 if(output){mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(backup,null,2)+'\n',{mode:0o600,flag:'wx',flush:true});const saved=JSON.parse(readFileSync(output,'utf8'));if(hash(saved.rows)!==hash(rows))throw Error('Backup verification failed.');}
 console.log(JSON.stringify({apply,legacyRecords:rows.length,normal:book.normal.length,shortcutNames:book.cheaters.length,backupWritten:!!output}));
 if(!apply)process.exitCode=0;
 else{
  // Receipts retain no score payload; seed all original IDs, including pruned runs.
  for(const entry of byKey.values()){
   const ref=root.collection('seen-runs').doc(entry.key),digest=await runDigest(entry.payload),old=await ref.get();
   if(old.exists){if(old.data().digest!==digest)throw Error('Existing receipt conflict; cleanup stopped.');}
   else await ref.create({digest,source:entry.payload.source,receivedAt:FieldValue.serverTimestamp()});
  }
  // Query reads and creation share a transaction. Abort if records changed after backup.
  await db.runTransaction(async tx=>{
   if((await tx.get(bookRef)).exists)throw Error('Concurrent migration; stopped.');
   const current=await snapshotRows(query=>tx.get(query));
   if(hash(current)!==hash(rows))throw Error('Scores changed after backup; rerun with a new backup.');
   tx.create(bookRef,{...book,updatedAt:FieldValue.serverTimestamp()});
  });
  // New rules freeze legacy writes as soon as the bounded book exists.
  for(const row of rows)await db.doc(row.path).delete();
  console.log(JSON.stringify({activated:true,normal:book.normal.length,shortcutNames:book.cheaters.length,legacyRemaining:(await snapshotRows(query=>query.get())).length}));
 }
}
}finally{await db.terminate();}
