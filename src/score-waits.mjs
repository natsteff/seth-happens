/** Bound a foreground wait without claiming the underlying operation was cancelled. */
export function withDeadline(promise,ms=8000){
 let timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('Online scores are taking too long.'),{code:'deadline'})),ms);});
 return Promise.race([promise,timeout]).finally(()=>clearTimeout(timer));
}
