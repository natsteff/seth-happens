export const SCORE_KEY = 'seth-happens-scores-v1';
export function validScores(value) {
  if(!Array.isArray(value))throw new Error('Saved scores are unreadable; nothing was changed.');
  const records=value.filter(s=>s&&typeof s.id==='string'&&typeof s.name==='string'&&s.name.length<=16&&Number.isInteger(s.score)&&(s.cheater===true?s.score===-10000:s.score>=0&&s.score<=14000)&&Number.isFinite(Date.parse(s.date))&&['falls','squishes','bumps','photos','latePhotos'].every(k=>Number.isInteger(s[k])&&s[k]>=0)&&s.photos<=2&&s.latePhotos<=s.photos&&typeof s.beer==='boolean');
  if(records.length!==value.length)throw new Error('Saved scores contain invalid entries; nothing was changed.');
  return records;
}
export function rankScores(scores) {
  const normal=scores.filter(s=>!s.cheater).sort((a,b)=>b.score-a.score||Date.parse(a.date)-Date.parse(b.date));
  const cheaters=scores.filter(s=>s.cheater).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)).slice(0,5);
  return [...normal,...cheaters];
}
export function readScores(storage) {
  const raw=storage.getItem(SCORE_KEY);
  return raw===null?[]:validScores(JSON.parse(raw));
}
export function saveScore(storage, score) {
  const existing=readScores(storage);
  if(existing.some(s=>s.id===score.id))return existing;
  if(score.cheater&&existing.filter(s=>s.cheater).length>=5)return rankScores(existing);
  const next=rankScores([...existing,...validScores([score])]);
  storage.setItem(SCORE_KEY,JSON.stringify(next));
  return next;
}
export async function verifyClearPassword(password) {
  const encoder=new TextEncoder();
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode('seth-scores-clear-v1'),iterations:210000,hash:'SHA-256'},key,256);
  return Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join('')==='d939ba1eb4631df18cb465976aae86da2aa4ba83eef6f15307b306a51072649a';
}
