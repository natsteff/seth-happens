import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {jukeboxTracks,DEFAULT_JUKEBOX_TRACK,afterpartyPhase,nextDance,DANCES,afterpartyCredits,AFTERPARTY_TIMES} from '../src/afterparty-model.mjs';

test('jukebox includes every shipped music resource exactly once, Eye of the Stairwell default',()=>{
 const files=readdirSync(new URL('../public/audio/music/',import.meta.url)).filter(file=>file.endsWith('.mp3')).sort();
 assert.deepEqual(jukeboxTracks.map(track=>track.file).sort(),files);
 assert.equal(new Set(jukeboxTracks.map(track=>track.file)).size,files.length);
 assert.equal(jukeboxTracks[DEFAULT_JUKEBOX_TRACK].title,'Eye of the Stairwell');
});
test('owner-approved timing keeps the crowd ten seconds after credits, then couple, spotlight, directly to tagged-logo jukebox (20-second credits)',()=>{
 assert.equal(AFTERPARTY_TIMES.credits,20000);
 for(const [time,phase] of [[0,'party'],[20000,'party'],[29999,'party'],[30000,'couple'],[39999,'couple'],[40000,'spotlight'],[49999,'spotlight'],[50000,'jukebox'],[54999,'jukebox'],[55000,'jukebox'],[3600000,'jukebox']])assert.equal(afterpartyPhase(time),phase);
 assert.match(afterpartyCredits.map(line=>line[1]).join('\n'),/Nate S.\nOpenAI Codex/);
 assert.match(afterpartyCredits.at(-1)[1],/No Seths were harmed/);
});
test('active realistic venue and all five complete-body atlases are valid PNGs with sprite alpha',()=>{
 const base=new URL('../public/assets/afterparty/',import.meta.url);
 const size=file=>{const data=readFileSync(new URL(file,base));assert.equal(data.subarray(1,4).toString(),'PNG');return {width:data.readUInt32BE(16),height:data.readUInt32BE(20),type:data[25]};};
 const venue=size('venue-dj-v2.png');assert.ok(venue.width>=1600&&venue.height>=900);
 for(const dance of DANCES){const image=size(`seth-${dance}-v1.png`);assert.equal(image.type,6);assert.ok(image.width>=1200&&image.height>=1200);}
});
test('standing lasts 1–2 seconds, moving dances last 3–5 seconds, and none immediately repeat',()=>{
 const names=new Set();
 for(const value of [0,.24,.49,.74,.999]){const dance=nextDance(9000,undefined,()=>value);names.add(dance.name);assert.ok(dance.name==='standing'?dance.until>=10000&&dance.until<=11000:dance.until>=12000&&dance.until<=14000);}
 let calls=0;assert.equal(nextDance(0,undefined,()=>calls++===0?.999:0).until,1000);
 calls=0;assert.equal(nextDance(0,undefined,()=>calls++===0?.999:1).until,2000);
 assert.deepEqual([...names].sort(),[...DANCES].sort());
 for(const name of DANCES)assert.notEqual(nextDance(0,name,()=>.5).name,name);
});

const source=stripTypeScriptTypes(readFileSync(new URL('../src/jukebox-audio.ts',import.meta.url),'utf8')).replace("'./afterparty-model.mjs'",JSON.stringify(new URL('../src/afterparty-model.mjs',import.meta.url).href));
const {JukeboxAudio}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function setup(){
 const contexts=[];
 globalThis.document={baseURI:'http://localhost/game/',hidden:false,createElement:()=>({paused:true,src:'',events:{},plays:0,loads:0,addEventListener(type,fn){this.events[type]=fn;},pause(){this.paused=true;},play(){this.paused=false;this.plays++;return Promise.resolve();},removeAttribute(){this.src='';},load(){this.loads++;}})};
 globalThis.AudioContext=class{
  state='suspended';sources=0;gain={value:1};
  constructor(){contexts.push(this);}
  createGain(){return {gain:this.gain,connect(){}};}
  createMediaElementSource(){this.sources++;return {connect(){}};}
  resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}
 };
 return {player:new JukeboxAudio(),contexts};
}
test('jukebox streams just the chosen song, has independent gain, stops/unloads on close and reuses one context on revisit',async()=>{
 const {player,contexts}=setup();player.open({enabled:true,muted:false,volume:.6});await Promise.resolve();
 assert.match(player.audio.src,/eye-of-the-stairwell.mp3$/);assert.equal(player.audio.loop,true);assert.equal(player.audio.paused,false);
 assert.equal(contexts.length,1);assert.equal(contexts[0].sources,1);assert.equal(contexts[0].gain.value,.6);
 player.setVolume(.3);assert.equal(contexts[0].gain.value,.3);player.select(0);await Promise.resolve();assert.match(player.audio.src,/arcade-staircase/);
 player.close();assert.equal(player.audio.paused,true);assert.equal(player.audio.src,'');assert.equal(contexts[0].state,'suspended');
 player.open({enabled:true,muted:false,volume:.75});await Promise.resolve();assert.equal(contexts.length,1);assert.equal(contexts[0].sources,1);assert.match(player.audio.src,/eye-of-the-stairwell/);
 player.close();
});
test('music off and master mute are honored, visibility pauses, and a late autoplay rejection cannot update a closed visit',async()=>{
 const {player,contexts}=setup();player.open({enabled:false,muted:false,volume:.75});assert.equal(player.audio.plays,0);
 player.enabled=true;player.muted=true;player.refresh();assert.equal(contexts.length,0);assert.equal(player.status,'Sound muted');
 player.muted=false;player.refresh();await Promise.resolve();document.hidden=true;player.refresh();assert.equal(player.audio.paused,true);
 document.hidden=false;let reject;player.audio.play=()=>new Promise((_,no)=>{reject=no;});player.refresh();player.close();reject(new Error('blocked'));await Promise.resolve();await Promise.resolve();assert.equal(player.error,'');assert.equal(player.audio.paused,true);
});
