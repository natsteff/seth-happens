import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const url=name=>new URL(`../src/${name}`,import.meta.url).href;
const data=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const music=data(stripTypeScriptTypes(readFileSync(new URL('../src/music.ts',import.meta.url),'utf8')).replace("'./radio-playlist.mjs'",JSON.stringify(url('radio-playlist.mjs'))).replace("'./preferences.mjs'",JSON.stringify(url('preferences.mjs'))));
const clips=data(stripTypeScriptTypes(readFileSync(new URL('../src/voice-clips.ts',import.meta.url),'utf8')).replace('import.meta.env.BASE_URL',JSON.stringify('/')));
const source=stripTypeScriptTypes(readFileSync(new URL('../src/audio.ts',import.meta.url),'utf8')).replace("'./music'",JSON.stringify(music)).replace("'./voice-clips'",JSON.stringify(clips)).replace("'./preferences.mjs'",JSON.stringify(url('preferences.mjs')));
const gains=[];let starts=0;
const param=()=>({value:0,writes:[],setValueAtTime(v){this.value=v;this.writes.push(v);},setTargetAtTime(v){this.value=v;this.writes.push(v);},linearRampToValueAtTime(v){this.writes.push(v);},exponentialRampToValueAtTime(v){this.writes.push(v);},cancelScheduledValues(){}});
const node=()=>({connect(){},disconnect(){},start(){starts++;},stop(){}});
globalThis.window={};globalThis.document={baseURI:'http://localhost/',getElementById:()=>null,createElement:()=>({paused:true,currentTime:0,addEventListener(){},pause(){this.paused=true;},play(){this.paused=false;return Promise.resolve();}})};
globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)});
globalThis.AudioContext=class{
 state='running';currentTime=0;sampleRate=44100;destination={};
 createGain(){const result={...node(),gain:param()};gains.push(result);return result;}
 createBuffer(){return {getChannelData:()=>new Float32Array(6615)};}
 createMediaElementSource(){return node();}createBufferSource(){return {...node(),playbackRate:{value:1}};}
 createOscillator(){return {...node(),frequency:param()};}
 async decodeAudioData(){return {duration:1};}async resume(){this.state='running';}async suspend(){this.state='suspended';}
};
test('real effect/voice/location paths never automate music or master gain or pause its playback',async()=>{
 const {gameAudio}=await import(data(source));await gameAudio.unlock();gameAudio.music.setVolume(.67);gameAudio.music.startRun();await Promise.resolve();
 const master=gains[0].gain,musicGain=gains[1].gain,snapshot=[master.value,musicGain.value,master.writes.length,musicGain.writes.length];
 for(const cue of ['jump','photo','pickup','impact','miss','piano','clown','timer'])gameAudio.play(cue);
 gameAudio.speak('Test','fall');gameAudio.playLocation('soccer');
 assert.ok(starts>8);assert.equal(gameAudio.music.audio.paused,false);
 assert.deepEqual([master.value,musicGain.value,master.writes.length,musicGain.writes.length],snapshot);
 assert.equal(musicGain.value,.67);
});

test('Mega Jump yields to collision reactions, including the former jump grunt, and respects mute/pause',async()=>{
 const {gameAudio}=await import(data(source));gameAudio.beginRun();await gameAudio.unlock();
 const beforeGains=gains.length,masterBefore=[gains[0].gain.value,gains[0].gain.writes.length];
 gameAudio.speak('Mega jump','mega');assert.equal(gameAudio.lastSpoken,'Mega jump');
 assert.equal(gains.length,beforeGains+1);assert.equal(gains.at(-1).gain.value,.6);
 assert.deepEqual([gains[0].gain.value,gains[0].gain.writes.length],masterBefore);
 const megaGains=gains.length;
 assert.ok(gameAudio.playedKinds.has('mega'));
 gameAudio.speak('Grunt!','grunt');assert.equal(gameAudio.lastSpoken,'Grunt!');assert.equal(gains.length,megaGains,'collision uses unchanged voice path');
 gameAudio.speak('Mega jump','mega');assert.equal(gameAudio.lastSpoken,'Grunt!','jump cannot interrupt collision');
 await gameAudio.setPaused(true);assert.equal(gameAudio.state,'suspended');
 await gameAudio.setPaused(false);assert.equal(gameAudio.state,'running');
 gameAudio.toggle();const before=starts;gameAudio.speak('Mega jump','mega');gameAudio.speak('Grunt!','grunt');
 assert.equal(starts,before,'muted reactions start no audio');gameAudio.toggle();
});
