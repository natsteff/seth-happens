import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PREFERENCES_KEY,readPreferences,savePreferences} from '../src/preferences.mjs';
function store(){const data=new Map([['high-scores','preserve']]);return{data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};}
test('preferences default to 75%, persist all options independently, leave scores untouched',()=>{
 const s=store();assert.equal(readPreferences(s).volume,.75);
 assert.equal(savePreferences(s,{track:4,countdownTrack:1,championTrack:1,volume:0,musicEnabled:false,muted:true}),true);
 assert.deepEqual(readPreferences(s),{track:4,countdownTrack:0,championTrack:0,volume:0,musicEnabled:false,muted:true,autoUpdate:true});
 savePreferences(s,{volume:.4});assert.equal(readPreferences(s).track,4);assert.equal(readPreferences(s).volume,.4);assert.equal(s.data.get('high-scores'),'preserve');
});
test('invalid values fall back safely, unavailable/corrupt storage does not break or overwrite',()=>{
 const s=store();s.data.set(PREFERENCES_KEY,JSON.stringify({track:99,volume:-1,championTrack:1,muted:'yes'}));
 assert.equal(readPreferences(s).track,0);assert.equal(readPreferences(s).volume,.75);assert.equal(readPreferences(s).championTrack,0);assert.equal(readPreferences(s).muted,false);
 s.data.set(PREFERENCES_KEY,'corrupt');assert.equal(savePreferences(s,{volume:.1}),false);assert.equal(s.data.get(PREFERENCES_KEY),'corrupt');assert.equal(readPreferences(null).volume,.75);assert.equal(savePreferences(null,{}),false);
});

test('legacy jump-clue setting is ignored without disturbing other saved options',()=>{
 const s=store();s.data.set(PREFERENCES_KEY,JSON.stringify({jumpClues:true,volume:.2,track:3}));const prefs=readPreferences(s);assert.equal('jumpClues' in prefs,false);assert.equal(prefs.volume,.2);assert.equal(prefs.track,3);savePreferences(s,{musicEnabled:false});assert.equal(JSON.parse(s.data.get(PREFERENCES_KEY)).jumpClues,undefined);
});
