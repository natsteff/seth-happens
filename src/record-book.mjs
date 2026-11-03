import {rankScores,nicknameKey} from './scores.mjs';
import {displayScore,canonicalPayload,sha256} from './online-score-model.mjs';
export const BOOK_PATH='games/beer-run/record-book/current';
export const emptyBook=()=>({schema:2,revision:0,normal:[],cheaters:[]});
export async function runDigest(payload){
 const {source,rulesetId,...run}=payload;return sha256(canonicalPayload(run));
}
export function retainBook(entries){
 const ranked=rankScores(entries.map(entry=>({...displayScore(entry.payload,entry.key),cheaterFirstSeenMs:entry.firstSeenMs,entry})));
 return ranked.map(row=>({...row.entry,firstSeenMs:row.cheater?row.cheaterFirstSeenMs:row.entry.payload.dateMs,nameKey:row.cheater?nicknameKey(row.name):''}));
}
export function updateBook(book,job){
 const candidate={key:job.key,payload:job.payload,firstSeenMs:job.payload.cheater?(job.firstSeenMs??job.payload.dateMs):job.payload.dateMs,nameKey:job.payload.cheater?nicknameKey(job.payload.name):''};
 const rows=retainBook([...book.normal,...book.cheaters,candidate]);
 const normal=rows.filter(row=>!row.payload.cheater),cheaters=rows.filter(row=>row.payload.cheater);
 if(JSON.stringify([normal,cheaters])===JSON.stringify([book.normal,book.cheaters]))return null;
 if(!rows.some(row=>row.key===job.key)&&!cheaters.some(row=>row.nameKey===candidate.nameKey&&row.firstSeenMs===candidate.firstSeenMs))return null;
 return {...book,normal,cheaters,revision:book.revision+1};
}
export function bookPage(book,offset=0){
 return {normal:book.normal.slice(offset,offset+10).map(row=>displayScore(row.payload,row.key)),cheaters:book.cheaters.map(row=>displayScore(row.payload,row.key)),cursor:{offset:offset+10,book},more:offset+10<book.normal.length};
}
export function isSavedRun(row,runId){return !!runId&&(row.runId??row.id)===runId;}
