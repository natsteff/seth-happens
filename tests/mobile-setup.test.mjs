import test from 'node:test';
import assert from 'node:assert/strict';
import {MOBILE_SETUP_KEY,standaloneLaunch,readMobileSetup,saveMobileSetup,mobileStartup} from '../src/mobile-setup.mjs';
const store=()=>{const data=new Map([['scores','unchanged']]);return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
test('first touch visit offers setup; accepted touch and keyboard choices survive reload without affecting scores',()=>{
 const s=store();assert.deepEqual(mobileStartup({touchCapable:true,setup:readMobileSetup(s)}),{showOffer:true,touchEnabled:false});
 for(const mode of ['touch','keyboard']){assert.equal(saveMobileSetup(s,mode),true);assert.deepEqual(mobileStartup({touchCapable:true,setup:readMobileSetup(s)}),{showOffer:false,touchEnabled:mode==='touch'});}
 assert.equal(s.data.get('scores'),'unchanged');
 assert.deepEqual(mobileStartup({touchCapable:false,setup:readMobileSetup(s)}),{showOffer:false,touchEnabled:false});
});
test('legacy explicit customization migrates, unrelated preferences and scores do not prove setup',()=>{
 const s=store();s.data.set('seth-happens.preferences.v1','{"volume":0.5}');assert.equal(readMobileSetup(s),null);
 s.data.set('seth-touch-controls','{"style":"stick","spacing":4}');assert.deepEqual(readMobileSetup(s),{mode:'touch',legacy:true});
 saveMobileSetup(s,'keyboard');assert.equal(readMobileSetup(s).mode,'keyboard','explicit new keyboard choice wins over legacy touch');
});
test('corrupt/unavailable storage safely offers setup and refuses corrupt-record overwrite',()=>{
 const s=store();s.data.set(MOBILE_SETUP_KEY,'broken');assert.equal(readMobileSetup(s),null);assert.equal(saveMobileSetup(s,'touch'),false);assert.equal(s.data.get(MOBILE_SETUP_KEY),'broken');
 for(const value of ['null','[]','{"version":2,"mode":"touch"}','{"version":1,"mode":"bad"}']){s.data.set(MOBILE_SETUP_KEY,value);assert.equal(readMobileSetup(s),null);assert.equal(saveMobileSetup(s,'touch'),false);}
 assert.equal(readMobileSetup(null),null);assert.equal(saveMobileSetup(null,'touch'),false);
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};assert.equal(readMobileSetup(blocked),null);assert.equal(saveMobileSetup(blocked,'touch'),false);
});
test('Home Screen detection supports display-mode and iOS fallback without assuming installation in browser tabs',()=>{
 assert.equal(standaloneLaunch({navigator:{standalone:true}}),true);
 assert.equal(standaloneLaunch({navigator:{},matchMedia:q=>({matches:q==='(display-mode: standalone)'})}),true);
 assert.equal(standaloneLaunch({navigator:{standalone:false},matchMedia:()=>({matches:false})}),false);
});
