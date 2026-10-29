import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// The class has only erasable TypeScript syntax; Node's strip API keeps tests on runtime behavior.
import {stripTypeScriptTypes} from 'node:module';
const source=stripTypeScriptTypes(readFileSync(new URL('../src/music.ts',import.meta.url),'utf8')).replace("'./radio-playlist.mjs'",JSON.stringify(new URL('../src/radio-playlist.mjs',import.meta.url).href)).replace("'./preferences.mjs'",JSON.stringify(new URL('../src/preferences.mjs',import.meta.url).href));
const {MusicRadio}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
globalThis.document={baseURI:'http://localhost/',createElement:()=>({paused:true,currentTime:0,events:{},plays:0,addEventListener(name,fn){(this.events[name]??=[]).push(fn);},pause(){this.paused=true;},play(){this.plays++;this.paused=false;return Promise.resolve();}})};
test('countdown switches once at 30, locks selection, retains mute/off, resets on restart',()=>{
 const m=new MusicRadio();m.beginRun();m.startRun();
 m.updateRemaining(31);assert.equal(m.countdown,false);
 m.updateRemaining(30);assert.equal(m.track.title,'The Final Warning');
 assert.match(m.audio.src,/the-final-warning/);assert.equal(m.status,'Hurry, wrap it up or die!');
 m.select(4);m.step(1);assert.equal(m.selected,0);assert.equal(m.countdownSelected,0);
 m.audio.currentTime=8;m.updateRemaining(29);assert.equal(m.audio.currentTime,8);
 m.off();assert.equal(m.enabled,false);m.beginRun();assert.equal(m.countdown,false);assert.equal(m.track.title,'Arcade Staircase');assert.match(m.audio.src,/arcade-staircase/);
});
test('music gain stays selected and pause holds stop playback independently',async()=>{
 const m=new MusicRadio();const values=[];
 m.attach({state:'running',currentTime:0,createGain:()=>({connect(){},gain:{cancelScheduledValues(){},setTargetAtTime(v){values.push(v);}}}),createMediaElementSource:()=>({connect(){}})},{});
 m.setVolume(.6);m.startRun();await Promise.resolve();assert.equal(m.audio.paused,false);assert.equal(values.at(-1),.6);
 m.setHold('pause',true);assert.equal(m.audio.paused,true);m.setHold('pause',false);assert.equal(m.audio.paused,false);
 assert.equal('setDucked' in m,false);
});

test('finish songs loop through score dialogs, cheater plays once, restart restores gameplay',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const m=new MusicRadio();m.beginRun();m.startRun();assert.equal(m.volume,.75);
 m.finishRun('success');assert.equal(m.track.title,'26 Floors of Glory');assert.equal(m.audio.loop,true);
 m.setHold('scores',true);assert.notEqual(m.status,'Paused');m.select(4);assert.equal(m.track.title,'26 Floors of Glory');
 m.finishRun('failure');assert.match(m.track.title,/Failure/);assert.equal(m.audio.loop,true);
 m.finishRun('cheater');assert.equal(m.track.title,'Big Stupid Cheater');assert.equal(m.audio.loop,false);
 m.beginRun();assert.equal(m.outcome,null);assert.equal(m.audio.loop,true);assert.equal(m.track.title,'Arcade Staircase');
});

test('finish playback keeps advancing through score hold; ended cheater never replays on refresh',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const m=new MusicRadio();m.attach({state:'running',currentTime:0,createGain:()=>({connect(){},gain:{cancelScheduledValues(){},setTargetAtTime(){}}}),createMediaElementSource:()=>({connect(){}})},{});
 m.startRun();m.setHold('scores',true);assert.equal(m.audio.paused,true);
 m.finishRun('success');await Promise.resolve();assert.equal(m.audio.paused,false);
 m.setHold('scores',true);assert.equal(m.audio.paused,false);
 m.setHold('pause',true);assert.equal(m.audio.paused,true);m.setHold('pause',false);assert.equal(m.audio.paused,false);
 m.finishRun('cheater');t.mock.timers.tick(2000);await Promise.resolve();m.audio.paused=true;for(const fn of m.audio.events.ended)fn();const plays=m.audio.plays;m.refresh();m.toggle();m.toggle();assert.equal(m.audio.plays,plays);assert.equal(m.status,'Finished');
});

test('cheater music waits two seconds, cannot bypass lead-in, and cancels on restart/end',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const m=new MusicRadio();m.attach({state:'running',currentTime:0,createGain:()=>({connect(){},gain:{cancelScheduledValues(){},setTargetAtTime(){}}}),createMediaElementSource:()=>({connect(){}})},{});
 m.finishRun('cheater');m.setHold('scores',true);m.setVolume(.5);m.refresh();assert.equal(m.audio.paused,true);assert.match(m.status,/Voice first/);
 t.mock.timers.tick(1999);assert.equal(m.audio.plays,0);t.mock.timers.tick(1);await Promise.resolve();assert.equal(m.audio.plays,1);assert.equal(m.audio.loop,false);
 m.finishRun('cheater');m.beginRun();const before=m.audio.plays;t.mock.timers.tick(2000);assert.equal(m.audio.plays,before);assert.equal(m.outcome,null);
 m.finishRun('cheater');m.endRun();t.mock.timers.tick(2000);assert.equal(m.audio.plays,before);
 m.finishRun('cheater');m.off();t.mock.timers.tick(2000);assert.equal(m.audio.plays,before);m.toggle();assert.equal(m.audio.plays,before+1);
});

test('countdown crossfade overlaps decks, preserves volume and freezes with score pause',async t=>{
 t.mock.timers.enable({apis:['setInterval']});
 const gains=[];const context={state:'running',currentTime:0,createGain(){const gain={value:1,cancelScheduledValues(){},setTargetAtTime(v){this.value=v;}};gains.push(gain);return{gain,connect(){}};},createMediaElementSource:()=>({connect(){}})};
 const m=new MusicRadio();m.attach(context,{});m.startRun();await Promise.resolve();const old=m.audio;
 m.updateRemaining(30);await Promise.resolve();assert.notEqual(m.audio,old);assert.equal(old.paused,false);assert.equal(m.audio.paused,false);assert.match(m.audio.src,/the-final-warning/);
 context.currentTime=.625;t.mock.timers.tick(16);assert.equal(gains[1].value,.5);assert.equal(gains[2].value,.5);
 m.setVolume(.4);assert.equal(gains[0].value,.4);assert.equal(gains[1].value,.5);
 m.setHold('scores',true);assert.equal(old.paused,true);assert.equal(m.audio.paused,true);context.currentTime=3;t.mock.timers.tick(16);assert.equal(gains[1].value,.5);
 m.setHold('scores',false);await Promise.resolve();context.currentTime=3.625;t.mock.timers.tick(16);assert.equal(old.paused,true);assert.equal(m.audio.paused,false);assert.equal(gains[2].value,1);assert.equal(gains[1].value,0);
 m.endRun();
});
test('restart, off and outcomes clean up both crossfade decks without late playback',async t=>{
 t.mock.timers.enable({apis:['setInterval']});
 const context={state:'running',currentTime:0,createGain:()=>({connect(){},gain:{value:1,cancelScheduledValues(){},setTargetAtTime(v){this.value=v;}}}),createMediaElementSource:()=>({connect(){}})};
 const m=new MusicRadio();m.attach(context,{});m.startRun();await Promise.resolve();let old=m.audio;
 m.updateRemaining(30);await Promise.resolve();assert.match(m.audio.src,/the-final-warning/);m.beginRun();assert.equal(old.paused,true);assert.equal(m.audio.paused,true);context.currentTime=5;t.mock.timers.tick(5000);assert.match(m.audio.src,/arcade-staircase/);assert.equal(m.audio.paused,true);
 m.startRun();await Promise.resolve();old=m.audio;m.updateRemaining(30);await Promise.resolve();m.off();assert.equal(old.paused,true);assert.equal(m.audio.paused,true);m.toggle();await Promise.resolve();assert.equal(m.audio.paused,false);m.finishRun('failure');assert.equal(old.paused,true);assert.match(m.audio.src,/failure-/);m.endRun();
});

test('120-second touch run switches default warning at 90 elapsed using the same media element',async()=>{
 const {RUN_LIMIT_MS}=await import('../src/mission.mjs');
 const m=new MusicRadio(true);const context={state:'running',currentTime:0,createGain:()=>({connect(){},gain:{value:1,cancelScheduledValues(){},setTargetAtTime(v){this.value=v;}}}),createMediaElementSource:()=>({connect(){}})};
 m.attach(context,{});m.beginRun();m.startRun();await Promise.resolve();const active=m.audio;
 m.updateRemaining(Math.ceil((RUN_LIMIT_MS-89999)/1000));assert.equal(m.countdown,false);
 m.updateRemaining(Math.ceil((RUN_LIMIT_MS-90000)/1000));await Promise.resolve();
 assert.equal(m.countdown,true);assert.equal(m.audio,active);assert.match(active.src,/the-final-warning/);assert.equal(active.paused,false);assert.equal(active.currentTime,0);
 const starts=active.plays;active.currentTime=12;m.updateRemaining(18);assert.equal(active.plays,starts);assert.equal(active.currentTime,12);
 m.setHold('pause',true);assert.equal(active.paused,true);m.setHold('pause',false);await Promise.resolve();assert.equal(active.paused,false);
 m.beginRun();assert.equal(m.countdown,false);assert.match(m.audio.src,/arcade-staircase/);m.endRun();
});
test('rejected second-deck playback falls back to the previously playing element',async t=>{
 t.mock.timers.enable({apis:['setInterval']});
 const context={state:'running',currentTime:0,createGain:()=>({connect(){},gain:{value:1,cancelScheduledValues(){},setTargetAtTime(){}}}),createMediaElementSource:()=>({connect(){}})};
 const m=new MusicRadio(false);m.attach(context,{});m.startRun();await Promise.resolve();const active=m.audio;
 m.elements.find(element=>element!==active).play=()=>Promise.reject(new Error('NotAllowedError'));
 m.updateRemaining(30);await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(m.audio,active);assert.match(active.src,/the-final-warning/);assert.equal(active.paused,false);m.endRun();
});

test('legacy alternate outcome settings cannot change fixed default tracks or gameplay station',()=>{
 const old=globalThis.localStorage;
 globalThis.localStorage={getItem:()=>JSON.stringify({countdownTrack:1,championTrack:1,track:3,volume:.4}),setItem(){}};
 try{const m=new MusicRadio();assert.equal(m.selected,3);assert.equal(m.volume,.4);m.beginRun();m.startRun();m.updateRemaining(30);assert.equal(m.track.title,'The Final Warning');m.finishRun('success');assert.equal(m.track.title,'26 Floors of Glory');m.endRun();}finally{globalThis.localStorage=old;}
});
