/** Persistent outbox/receipts. Never modifies the legacy localStorage score array. */
export class ScoreOutbox{
 constructor(indexedDB=globalThis.indexedDB,name='seth-happens.online.v1'){this.indexedDB=indexedDB;this.name=name;}
 async db(){
  if(!this.opening)this.opening=new Promise((resolve,reject)=>{
   if(!this.indexedDB)return reject(Error('Persistent online queue is unavailable.'));
   const request=this.indexedDB.open(this.name,1);
   request.onupgradeneeded=()=>{request.result.createObjectStore('jobs',{keyPath:'key'});request.result.createObjectStore('meta');};
   request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();this.opening=undefined;};resolve(request.result);};request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Close other game tabs and retry.'));
  }).catch(error=>{this.opening=undefined;throw error;});return this.opening;
 }
 async run(store,mode,action){
  const db=await this.db();return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode);let result;try{const req=action(tx.objectStore(store));req.onsuccess=()=>{result=req.result;};}catch(error){tx.abort();reject(error);return;}tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Queue transaction aborted.'));});
 }
 get(key){return this.run('meta','readonly',store=>store.get(key));}
 set(key,value){return this.run('meta','readwrite',store=>store.put(value,key));}
 jobs(){return this.run('jobs','readonly',store=>store.getAll());}
 async enqueue(job){
  const db=await this.db();return new Promise((resolve,reject)=>{const tx=db.transaction('jobs','readwrite'),store=tx.objectStore('jobs'),req=store.get(job.key);let result;
   req.onsuccess=()=>{const old=req.result;if(old&&old.digest!==job.digest){result={...old,collision:true,conflictDigests:[...new Set([...(old.conflictDigests||[]),job.digest])]};store.put(result);return;}result=old||job;if(!old)store.add(job);};
   tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(tx.error||Error('Could not save submission.'));
  });
 }
 async update(key,changes){
  const db=await this.db();return new Promise((resolve,reject)=>{const tx=db.transaction('jobs','readwrite'),store=tx.objectStore('jobs'),req=store.get(key);req.onsuccess=()=>{if(req.result)store.put({...req.result,...changes,key});};tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error);});
 }
 async rememberRun(record){const db=await this.db();return new Promise((resolve,reject)=>{const tx=db.transaction('meta','readwrite'),store=tx.objectStore('meta'),req=store.get('new-runs');req.onsuccess=()=>{const rows=req.result||[];if(!rows.some(row=>row.id===record.id))store.put([...rows,record],'new-runs');};tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error);});}
 async claim(owner,now=Date.now()){
  const db=await this.db();return new Promise((resolve,reject)=>{const tx=db.transaction('meta','readwrite'),store=tx.objectStore('meta'),req=store.get('lease');let yes=false;req.onsuccess=()=>{const lease=req.result;if(!lease||lease.until<now||lease.owner===owner){store.put({owner,until:now+30000},'lease');yes=true;}};tx.oncomplete=()=>resolve(yes);tx.onabort=tx.onerror=()=>reject(tx.error);});
 }
 async release(owner){const db=await this.db();return new Promise((resolve,reject)=>{const tx=db.transaction('meta','readwrite'),store=tx.objectStore('meta'),req=store.get('lease');req.onsuccess=()=>{if(req.result?.owner===owner)store.delete('lease');};tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error);});}
}
