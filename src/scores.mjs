export const SCORE_KEY = 'seth-happens-scores-v1';
export function validScores(value) {
  if(!Array.isArray(value))throw new Error('Saved scores are unreadable; nothing was changed.');
  const records=value.filter(s=>s&&typeof s.id==='string'&&typeof s.name==='string'&&s.name.length<=16&&Number.isInteger(s.score)&&(s.cheater===true?s.score===-10000:s.score>=0&&s.score<=14000)&&Number.isFinite(Date.parse(s.date))&&['falls','squishes','bumps','photos','latePhotos'].every(k=>Number.isInteger(s[k])&&s[k]>=0)&&s.photos<=2&&s.latePhotos<=s.photos&&typeof s.beer==='boolean'&&(s.cheaterFirstSeenMs===undefined||Number.isInteger(s.cheaterFirstSeenMs)&&s.cheaterFirstSeenMs>=0&&s.cheaterFirstSeenMs<=Date.parse(s.date)));
  if(records.length!==value.length)throw new Error('Saved scores contain invalid entries; nothing was changed.');
  return records;
}
export const SCORE_BACKUP_KEY=SCORE_KEY+'-before-retention-v2';
export const nicknameKey=name=>name.trim().toLowerCase();
export function compareText(a,b){const aa=Array.from(a),bb=Array.from(b);for(let i=0;i<Math.min(aa.length,bb.length);i++){const difference=aa[i].codePointAt(0)-bb[i].codePointAt(0);if(difference)return difference;}return aa.length-bb.length;}
const dateMs=s=>Date.parse(s.date);
export function compareNormal(a,b){return b.score-a.score||dateMs(a)-dateMs(b)||compareText(a.id,b.id);}
export function compareShortcut(a,b){
 const time=s=>Number.isFinite(s.elapsedMs)&&s.elapsedMs>=0?s.elapsedMs:Infinity;
 return time(a)-time(b)||a.falls+a.squishes+a.bumps-b.falls-b.squishes-b.bumps||dateMs(a)-dateMs(b)||compareText(a.id,b.id);
}
export function rankScores(scores) {
  const unique=[...new Map(scores.map(s=>[s.id,s])).values()];
  const normal=unique.filter(s=>!s.cheater).sort(compareNormal).slice(0,25);
  const groups=new Map();
  for(const row of unique.filter(s=>s.cheater)){
   const key=nicknameKey(row.name),old=groups.get(key);
   const first=Number.isFinite(row.cheaterFirstSeenMs)?Math.min(row.cheaterFirstSeenMs,dateMs(row)):dateMs(row);
   const winner=old&&compareShortcut(old,row)<=0?old:row;
   groups.set(key,{...winner,cheaterFirstSeenMs:Math.min(first,old?.cheaterFirstSeenMs??Infinity)});
  }
  const cheaters=[...groups.values()].sort((a,b)=>a.cheaterFirstSeenMs-b.cheaterFirstSeenMs||compareText(nicknameKey(a.name),nicknameKey(b.name))).slice(0,5);
  return [...normal,...cheaters];
}
export function readScores(storage) {
  const raw=storage.getItem(SCORE_KEY);
  return raw===null?[]:validScores(JSON.parse(raw));
}
export function compactScores(storage){
 const raw=storage.getItem(SCORE_KEY);if(raw===null)return [];
 const existing=validScores(JSON.parse(raw));
 const ids=new Map();for(const row of existing){const value=JSON.stringify(row);if(ids.has(row.id)&&ids.get(row.id)!==value)throw Error('Conflicting saved run IDs; nothing was changed.');ids.set(row.id,value);}
 const next=rankScores(existing);
 if(JSON.stringify(existing)!==JSON.stringify(next)){
  // Refuse pruning if the original cannot first be preserved byte-for-byte.
  if(storage.getItem(SCORE_BACKUP_KEY)===null)storage.setItem(SCORE_BACKUP_KEY,raw);
  storage.setItem(SCORE_KEY,JSON.stringify(next));
 }
 return next;
}
export function saveScore(storage, score) {
  validScores([score]);
  const existing=compactScores(storage);
  if(existing.some(s=>s.id===score.id))return existing;
  const next=rankScores([...existing,score]);
  storage.setItem(SCORE_KEY,JSON.stringify(next));
  return next;
}
export async function verifyClearPassword(password) {
  const encoder=new TextEncoder();
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode('seth-scores-clear-v1'),iterations:210000,hash:'SHA-256'},key,256);
  return Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join('')==='d939ba1eb4631df18cb465976aae86da2aa4ba83eef6f15307b306a51072649a';
}
