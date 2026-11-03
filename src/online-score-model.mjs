import {validScores} from './scores.mjs';
import {finalScore,timeBonus} from './mission.mjs';
export const ONLINE_GAME='beer-run';
export function scorePayload(record,source='new'){
 validScores([record]);
 if(!['new','historical'].includes(source)||!record.id.trim()||record.id.length>128||/[\u0000-\u001f\u007f]/.test(record.id))throw Error('Invalid run identifier.');
 const name=record.name.trim();if(!name||name.length>16||/[\u0000-\u001f\u007f]/.test(name))throw Error('Invalid player name.');
 const timed=record.elapsedMs!==undefined;
 if(timed&&(!Number.isFinite(record.elapsedMs)||record.elapsedMs<0||record.elapsedMs>=(source==='new'?120000:180000)))throw Error('Invalid elapsed time.');
 if(['falls','squishes','bumps'].some(key=>record[key]>100000)||Date.parse(record.date)<0||Date.parse(record.date)>Date.now()+86400000)throw Error('Historical fields are outside supported bounds.');
 const cheater=record.cheater===true;
 if(source==='new'&&(!timed||(!cheater&&!record.beer)))throw Error('A completed beer delivery is required.');
 const p={schema:1,gameId:ONLINE_GAME,levelId:'rooftop',rulesetId:source==='new'?'current-120-v1':'legacy',source,id:record.id,name,score:record.score,dateMs:Date.parse(record.date),elapsedMs:timed?record.elapsedMs:-1,bonus:typeof record.bonus==='number'&&Number.isFinite(record.bonus)?record.bonus:-1,falls:record.falls,squishes:record.squishes,bumps:record.bumps,photos:record.photos,latePhotos:record.latePhotos,beer:record.beer,cheater};
 if(p.bonus < -1 || p.bonus>12000)throw Error('Invalid time bonus.');
 if(source==='new'){
  const expected=finalScore(p.beer,new Set(Array.from({length:p.photos},(_,i)=>i)),p,new Set(Array.from({length:p.latePhotos},(_,i)=>i)),p.elapsedMs,p.cheater);
  if(p.score!==expected)throw Error('Score components do not match the total.');
  p.bonus=cheater?0:timeBonus(p.elapsedMs);
 }
 return p;
}
export function canonicalPayload(payload){return JSON.stringify(Object.fromEntries(Object.keys(payload).sort().map(key=>[key,payload[key]])));}
export async function sha256(text){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),n=>n.toString(16).padStart(2,'0')).join('');}
export async function submission(record,source='new'){
 const payload=scorePayload(record,source);return {key:await sha256(`${ONLINE_GAME}/rooftop/${record.id}`),digest:await sha256(canonicalPayload(payload)),payload,firstSeenMs:record.cheaterFirstSeenMs??payload.dateMs,state:'pending',attempts:0,nextAttempt:0};
}
export function scanLegacy(raw){
 if(raw===null)return {status:'empty',candidates:[],invalid:0,total:0};
 let value;try{value=JSON.parse(raw);}catch{return {status:'corrupt',candidates:[],invalid:0,total:0};}
 if(!Array.isArray(value))return {status:'corrupt',candidates:[],invalid:0,total:0};
 const candidates=[];let invalid=0;const seen=new Map(),conflicts=new Set();
 for(const record of value){try{const p=scorePayload(record,'historical'),previous=seen.get(p.id);if(conflicts.has(p.id)){invalid++;continue;}if(previous&&previous!==canonicalPayload(p)){invalid+=2;const index=candidates.findIndex(row=>row.id===p.id);if(index>=0)candidates.splice(index,1);conflicts.add(p.id);continue;}if(!previous){candidates.push(record);seen.set(p.id,canonicalPayload(p));}}catch{invalid++;}}
 return {status:invalid?'partial':value.length?'valid':'empty',candidates,invalid,total:value.length};
}
export function retryDelay(attempts){return Math.min(300000,1000*2**Math.min(8,attempts));}
export function migrationSummary(jobs,scan={total:0,invalid:0}){
 const historical=jobs.filter(j=>(j.payload?.source??j.source)==='historical');const count=state=>historical.filter(j=>j.state===state).length;
 return {total:scan.total,invalid:scan.invalid,eligible:historical.length,imported:count('accepted'),duplicates:count('duplicate'),pending:count('pending'),rejected:count('rejected')+count('below-cutoff'),conflicts:count('conflict')+historical.reduce((n,j)=>n+(j.conflictDigests?.length||0),0)};
}
export function displayScore(data,key){return {...data,runId:data.id,id:key,date:new Date(data.dateMs).toISOString(),...(data.elapsedMs===-1?{elapsedMs:undefined}:{elapsedMs:data.elapsedMs}),...(data.bonus===-1?{bonus:undefined}:{bonus:data.bonus})};}

export function sameRun(a,b){
 const ignored=new Set(['source','rulesetId']);
 return Object.keys(a).filter(key=>!ignored.has(key)).every(key=>['bonus','elapsedMs'].includes(key)&&(a[key]===-1||b[key]===-1)||a[key]===b[key]);
}

/** Merge ordered board streams without skipping unconsumed rows on later pages. */
export function mergeOnlineRows(live,historical,size=10){
 const pool=[...live.map(row=>({...row,board:'live'})),...historical.map(row=>({...row,board:'historical'}))].sort((a,b)=>b.score-a.score||Date.parse(a.date)-Date.parse(b.date)||a.id.localeCompare(b.id)||a.board.localeCompare(b.board));
 const selected=[],seen=new Set();
 /** @type {{live:any,historical:any}} */
 const consumed={live:undefined,historical:undefined};
 for(const row of pool){if(selected.length>=size)break;consumed[row.board]=row; if(!seen.has(row.id)){seen.add(row.id);selected.push(row);}}
 return {selected,consumed,more:pool.length>selected.length};
}

/** Candidate admission hint only; confirmed or deliberately skipped jobs stay terminal. */
export function qualifiesForTop25(payload,key,rows){
 const last=rows[24];
 return payload.cheater||rows.some(row=>row.key===key)||!last||payload.score>last.score||payload.score===last.score&&(payload.dateMs<last.dateMs||payload.dateMs===last.dateMs&&key.localeCompare(last.key)<0);
}
