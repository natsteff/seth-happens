import {test} from 'node:test';
import assert from 'node:assert/strict';
import {radioTracks,DEFAULT_RADIO_TRACK,nextRadioTrack,radioShortcut} from '../src/radio-playlist.mjs';
import {existsSync} from 'node:fs';
test('five playable local tracks have the owner-approved order and default',()=>{
 assert.deepEqual(radioTracks.map(t=>t.title),['Arcade Staircase','The Beer of Destiny','Twenty-Six Floors of Celts','Go Seth Go','The Haunted Happy Hour']);
 assert.equal(DEFAULT_RADIO_TRACK,0);
 for(const t of radioTracks)assert.ok(existsSync(new URL('../public/audio/music/'+t.file,import.meta.url)));
});
test('previous and next radio selection wrap in both directions',()=>{
 assert.equal(nextRadioTrack(0,-1),4);assert.equal(nextRadioTrack(4,1),0);
 assert.equal(nextRadioTrack(2,1),3);assert.equal(nextRadioTrack(2,-1),1);
});
test('radio shortcuts select 1–5, zero means off, Tab stays available for focus',()=>{
 for(let i=1;i<=5;i++){assert.equal(radioShortcut('Digit'+i).track,i-1);assert.equal(radioShortcut('Numpad'+i).track,i-1);}
 assert.equal(radioShortcut('Digit0').off,true);assert.equal(radioShortcut('Numpad0').off,true);
 assert.equal(radioShortcut('BracketLeft').step,-1);assert.equal(radioShortcut('BracketRight').step,1);
 assert.equal(radioShortcut('Backslash'),null);assert.equal(radioShortcut('Slash'),null);
 for(const key of ['Tab','Digit6','KeyP','KeyF','KeyS','KeyV'])assert.equal(radioShortcut(key),null);
});
