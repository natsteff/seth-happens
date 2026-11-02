// Owner-only local summary. Uses existing ADC credentials; never bundle in game.
// Authenticate locally with `gcloud auth application-default login` if desired.
import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
const emulator=process.env.FIRESTORE_EMULATOR_HOST;
if(emulator&&!/^127\.0\.0\.1:\d+$/.test(emulator))throw Error('Only a loopback emulator is supported.');
if(emulator)process.env.METADATA_SERVER_DETECTION='none';
initializeApp({projectId:emulator?'demo-seth-happens':'seth-happens',...(emulator?{}:{credential:applicationDefault()})});
const db=getFirestore(),root=db.doc('games/beer-run');
const rows=(await root.collection('installations').get()).docs.map(s=>s.data());
const historical=await root.collection('boards').doc('historical').collection('scores').count().get();
const live=await root.collection('boards').doc('live').collection('scores').count().get();
const receipts=(await root.collection('receipts').get()).docs.map(s=>s.data());
const importedFor=uid=>receipts.filter(r=>r.uid===uid&&r.board==='historical').length;
const matching=fn=>rows.filter(fn).length;
const eligible=s=>s.eligible>0,complete=s=>eligible(s)&&s.pending===0&&s.conflicts===0&&s.rejected===0;
console.log(JSON.stringify({observedInstallations:rows.length,withExistingRecords:matching(s=>s.hadExisting),storageUnreadableOrUnavailable:matching(s=>['corrupt','unavailable'].includes(s.baselineStatus)),migratedWithAtLeastOneImport:matching(s=>complete(s)&&importedFor(s.uid)>0),completedDuplicateOnly:matching(s=>complete(s)&&importedFor(s.uid)===0&&s.duplicates>0),pendingMigrations:matching(s=>eligible(s)&&s.pending>0),currentlyFailedMigrations:matching(s=>s.hadExisting&&(s.failedPending>0||s.conflicts>0||s.rejected>0)),everFailedOnlineSync:matching(s=>s.everFailed),uniqueHistoricalRecordsImported:historical.data().count,reportedDistinctDuplicateCandidates:rows.reduce((sum,s)=>sum+(s.duplicates||0),0),declinedOrDeferred:matching(s=>s.consent==='later'),newToObservedScoresOnlineReaders:matching(s=>s.baselineStatus==='empty'&&s.boardUsed),newToObservedScoresOnlineSubmitters:matching(s=>s.baselineStatus==='empty'&&s.newSubmitted),onlineScores:live.data().count,limits:'Observed browser installations, not unique people; status telemetry is client-reported. Imported score count comes from stored records. No never-returning/offline-unreported clients counted.'},null,2));
await db.terminate();
