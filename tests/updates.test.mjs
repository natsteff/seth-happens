import test from 'node:test';
import assert from 'node:assert/strict';
import {checkForUpdate,newerVersion} from '../src/updates.mjs';
import {readPreferences,savePreferences} from '../src/preferences.mjs';
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};
const reply=version=>async()=>({ok:true,json:async()=>({version})});
test('versions compare numerically and never downgrade or accept malformed values',()=>{
 assert.equal(newerVersion('0.3.10','0.3.9'),true);
 for(const next of ['0.3.8','0.3.7','unknown','https://example.com'])assert.equal(newerVersion(next,'0.3.8'),false);
});
test('confirmed newer online version reloads with cache busting, retaining path and without deleting storage',async()=>{
 let destination,request;const storage=memory();storage.setItem('scores','keep');
 const result=await checkForUpdate({current:'0.3.7',url:'https://example.com/seth-happens/?other=1',storage,now:()=>123,fetcher:async(url,options)=>{request={url,options};return (await reply('0.3.8')());},navigate:url=>destination=url});
 assert.equal(result,'updating');assert.equal(request.options.cache,'no-store');assert.match(request.url,/seth-happens\/version.json\?_check=123/);
 const target=new URL(destination);assert.equal(target.pathname,'/seth-happens/');assert.equal(target.searchParams.get('_gameVersion'),'0.3.8');assert.equal(target.searchParams.get('_refresh'),'123');assert.equal(target.searchParams.get('other'),'1');assert.equal(storage.getItem('scores'),'keep');
});
test('unchanged version and failed checks never navigate',async()=>{
 for(const fetcher of [reply('0.3.8'),reply('garbage'),async()=>{throw Error('offline');},async()=>({ok:false})]){
  let navigated=false;await checkForUpdate({current:'0.3.8',url:'https://example.com/game/',fetcher,navigate:()=>navigated=true});assert.equal(navigated,false);
 }
});
test('stale cached pages cannot loop automatically; explicit retry is available',async()=>{
 const storage=memory();let navigations=0;
 const options={current:'0.3.7',url:'https://example.com/game/',storage,fetcher:reply('0.3.8'),navigate:()=>navigations++};
 assert.equal(await checkForUpdate(options),'updating');assert.equal(await checkForUpdate(options),'stale');
 assert.equal(await checkForUpdate({...options,manual:true}),'updating');assert.equal(navigations,2);
 assert.equal(await checkForUpdate({...options,storage:undefined,url:options.url+'?_gameVersion=0.3.8'}),'stale');
});
test('auto updates default enabled and saved opt-out survives unrelated preference changes',()=>{
 const storage=memory();assert.equal(readPreferences(storage).autoUpdate,true);
 savePreferences(storage,{autoUpdate:false});savePreferences(storage,{volume:.4});assert.equal(readPreferences(storage).autoUpdate,false);
});
