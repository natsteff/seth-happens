import test from 'node:test';
import assert from 'node:assert/strict';
import {mobileTrackLabel} from '../src/mobile-track.mjs';
test('mobile radio shows numbered stations, unnumbered special tracks and actual off/paused state',()=>{
 const radio={selected:2,track:{title:'Twenty-Six Floors of Celts'},enabled:true,volume:.75,status:'Playing',audio:{paused:false}};
 assert.equal(mobileTrackLabel(radio),'3 · Twenty-Six Floors of Celts');
 radio.enabled=false;assert.match(mobileTrackLabel(radio),/Music off$/);radio.enabled=true;
 radio.status='Paused';assert.match(mobileTrackLabel(radio),/Paused$/);radio.status='Playing';
 radio.countdown=true;radio.track.title='The Final Warning';assert.equal(mobileTrackLabel(radio),'Countdown · The Final Warning');
 radio.countdown=false;radio.outcome='success';radio.track.title='26 Floors of Glory';assert.equal(mobileTrackLabel(radio),'Champion · 26 Floors of Glory');
 radio.muted=true;assert.match(mobileTrackLabel(radio),/Muted$/);
});
