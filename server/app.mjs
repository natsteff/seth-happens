import {createServer} from 'node:http';
import {pbkdf2Sync,timingSafeEqual} from 'node:crypto';
import {mkdirSync,existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validScores,rankScores} from '../src/scores.mjs';
import {finalScore,timeBonus,RUN_LIMIT_MS} from '../src/mission.mjs';
export function leaderboard({filePath='data/high-scores.json',origins=[],clearHash=process.env.CLEAR_PASSWORD_HASH,clearPasswordRequired=true}={}){
  mkdirSync(dirname(filePath),{recursive:true});
  let records=existsSync(filePath)?validScores(JSON.parse(readFileSync(filePath,'utf8'))):[];
  const list=()=>rankScores(records);
  const store=next=>{const temp=filePath+'.tmp';writeFileSync(temp,JSON.stringify(next,null,2)+'\n',{mode:0o600});renameSync(temp,filePath);records=next;};
  const attempts=new Map();
  const server=createServer(async(req,res)=>{
    const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    const origin=req.headers.origin;
    if(origin&&!origins.includes(origin))return send(403,{error:'Origin not allowed.'});
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
    if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
    const route=new URL(req.url,'http://localhost').pathname;
    if(route==='/api/scores'&&req.method==='GET')return send(200,{scores:list(),clearPasswordRequired});
    if(req.method!=='POST'||!['/api/scores','/api/scores/clear','/api/scores/import'].includes(route))return send(404,{error:'Not found.'});
    if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON required.'});
    const now=Date.now(),ip=req.socket.remoteAddress||'unknown';
    for(const [key,value] of attempts)if(now-value.start>60000)attempts.delete(key);
    const bucket=attempts.get(ip)||{start:now,count:0};bucket.count++;attempts.set(ip,bucket);
    if(bucket.count>20)return send(429,{error:'Too many attempts. Try again in a minute.'});
    try{
      let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>4096)return send(413,{error:'Request too large.'});}
      const input=JSON.parse(body);
      if(route.endsWith('/clear')){
        if(clearPasswordRequired){
        if(!clearHash||!/^[a-f0-9]{64}$/.test(clearHash))return send(503,{error:'Server clearing is not configured.'});
        if(typeof input.password!=='string'||input.password.length>256)return send(400,{error:'Invalid password.'});
        const hash=pbkdf2Sync(input.password,'seth-scores-clear-v1',210000,32,'sha256');
        if(!timingSafeEqual(hash,Buffer.from(clearHash,'hex')))return send(403,{error:'Incorrect password. Scores were not cleared.'});
        }else if(input.confirm!==true)return send(400,{error:'Confirmation required.'});
        store([]);return send(200,{scores:[]});
      }
      const importing=route.endsWith('/import');
      if(typeof input.id!=='string'||(importing?(!input.id.length||input.id.length>128||/[\x00-\x1f\x7f]/.test(input.id)):!/^[a-f0-9-]{36}$/i.test(input.id))||typeof input.name!=='string')throw Error();
      if((!importing||input.elapsedMs!==undefined)&&(!Number.isFinite(input.elapsedMs)||input.elapsedMs<0||input.elapsedMs>=(importing?180000:RUN_LIMIT_MS)))throw Error();
      const record={id:input.id,name:input.name.trim(),date:importing?input.date:new Date().toISOString(),...(input.elapsedMs===undefined?{}:{elapsedMs:input.elapsedMs}),
        falls:input.falls,squishes:input.squishes,bumps:input.bumps,photos:input.photos,latePhotos:input.latePhotos,beer:input.beer,cheater:input.cheater===true};
      if(!record.name||/[\x00-\x1f\x7f]/.test(record.name))throw Error();
      validScores([{...record,score:record.cheater?-10000:0}]);
      record.score=importing&&input.elapsedMs===undefined?input.score:finalScore(record.beer,new Set(Array.from({length:record.photos},(_,i)=>i)),{falls:record.falls,squishes:record.squishes,bumps:record.bumps},new Set(Array.from({length:record.latePhotos},(_,i)=>i)),record.elapsedMs,record.cheater);
      record.bonus=record.cheater||record.elapsedMs===undefined?0:timeBonus(record.elapsedMs);validScores([record]);
      const existing=list();const duplicate=existing.some(s=>s.id===record.id);
      const accepted=duplicate||!record.cheater||existing.filter(s=>s.cheater).length<5;
      if(accepted&&!duplicate)store(rankScores([...existing,record]));
      return send(200,{accepted,scores:list()});
    }catch{return send(400,{error:'Invalid score submission.'});}
  });
  return {server,close:()=>{}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const config=JSON.parse(readFileSync(new URL('./config.json',import.meta.url),'utf8'));
  const {server}=leaderboard({clearPasswordRequired:config.clearPasswordRequired!==false,filePath:process.env.SCORE_FILE||'data/high-scores.json',origins:(process.env.ALLOWED_ORIGINS||'').split(',').filter(Boolean)});
  server.listen(Number(process.env.PORT||8787),process.env.HOST||'127.0.0.1',()=>console.log('Leaderboard server ready.'));
}
