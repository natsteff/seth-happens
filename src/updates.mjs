// Version checks never clear scores, preferences, or other browser storage.
export function newerVersion(candidate,current){
 const parse=value=>typeof value==='string'&&/^\d+\.\d+\.\d+$/.test(value)?value.split('.').map(Number):null;
 const next=parse(candidate),old=parse(current);if(!next||!old)return false;
 for(let i=0;i<3;i++){if(next[i]!==old[i])return next[i]>old[i];}return false;
}
export async function checkForUpdate({current,url,fetcher=fetch,navigate,storage,now=Date.now,manual=false}){
 const endpoint=new URL('version.json',url);endpoint.searchParams.set('_check',String(now()));
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6000);
 try{
  const response=await fetcher(endpoint.href,{cache:'no-store',signal:controller.signal});
  if(!response.ok)throw new Error('Version check failed');
  const {version}=await response.json();
  if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Invalid version');
  if(!newerVersion(version,current))return 'current';
  const key=`seth-update:${current}:${version}`;
  // A stale intermediary must not trap the player in a navigation loop.
  try{if(!manual&&storage?.getItem(key))return 'stale';storage?.setItem(key,'attempted');}catch{/* URL below also prevents automatic loops without storage. */}
  const target=new URL(url);
  if(!manual&&target.searchParams.get('_gameVersion')===version)return 'stale';
  target.searchParams.set('_gameVersion',version);target.searchParams.set('_refresh',String(now()));
  navigate(target.href);return 'updating';
 }catch{return 'unavailable';}finally{clearTimeout(timeout);}
}
