import test from 'node:test';import assert from 'node:assert/strict';
import {missionAction,FORGOT_BEER,summitSignals} from '../src/mission-actions.mjs';
const base={beerInReach:false,photoInReach:false,home:false,beer:true,missed:false,heroPlaying:false};
test('photo and beer actions outrank recall; finish choice never offers completion without beer',()=>{
 assert.equal(missionAction({...base,missed:true}),'recall');
 assert.equal(missionAction({...base,missed:true,photoInReach:true}),'photo');
 assert.equal(missionAction({...base,missed:true,beerInReach:true}),'beer');
 assert.equal(missionAction({...base,home:true,beer:false,missed:true}),'missing-beer');
 assert.equal(missionAction({...base,home:true,missed:true}),'finish-choice');
 assert.equal(missionAction({...base,home:true}),'finish');
 assert.equal(missionAction({...base,home:true,heroPlaying:true}),'wait');
 assert.equal(FORGOT_BEER,'You forgot the beer! Allison is very disappointed in you, go back.');
});
test('earliest missed target is Soccer then Concert, preserving route revisit eligibility',async()=>{
 const {missedPhotos,photoStops}=await import('../src/mission.mjs');
 assert.deepEqual(missedPhotos(Infinity,new Set()),[0,1]);assert.equal(photoStops[0].floor,6);
 assert.deepEqual(missedPhotos(Infinity,new Set([0])),[1]);assert.equal(photoStops[1].floor,17);
 assert.deepEqual(missedPhotos(photoStops[0].x,new Set([0])),[]);
});

test('empty-handed summit marks late-photo arrival but does not consume hero eligibility',()=>{
 const first=summitSignals({home:true,beer:false,reached:false,heroHeard:false});assert.deepEqual(first,{reached:true,playHero:false});
 assert.deepEqual(summitSignals({home:false,beer:true,reached:first.reached,heroHeard:false}),{reached:true,playHero:false});
 assert.equal(summitSignals({home:true,beer:true,reached:true,heroHeard:false}).playHero,true);
 assert.equal(summitSignals({home:true,beer:true,reached:true,heroHeard:true}).playHero,false);
});
