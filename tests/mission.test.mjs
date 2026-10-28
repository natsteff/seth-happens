import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScore, recordMishap, missedPhotos, photoIndicator, photoStops, floors, LEVEL_WIDTH, ROUTE_OFFSET, ROAD } from '../src/mission.mjs';
test('optional objectives and distinct mishaps determine the final score', () => {
  let mishaps={falls:0,squishes:0,bumps:0};
  assert.equal(runScore(false,new Set(),mishaps),1000);
  assert.equal(runScore(true,new Set([0,1]),mishaps),2000);
  assert.equal(runScore(false,new Set([0]),mishaps),1250);
  assert.equal(runScore(false,new Set([6,7]),mishaps),1000);
  mishaps=recordMishap(mishaps,'squish');
  assert.deepEqual(mishaps,{falls:0,squishes:1,bumps:0});
  mishaps=recordMishap(mishaps,'fall');
  mishaps=recordMishap(mishaps,'person');
  mishaps=recordMishap(mishaps,'object');
  assert.deepEqual(mishaps,{falls:1,squishes:1,bumps:2});
  assert.equal(runScore(true,new Set([0,1]),mishaps),1960);
  assert.equal(runScore(false,new Set(),{falls:101,squishes:0,bumps:0}),0);
});
test('missing a photo is persistent until captured, even after a later photo', () => {
  const x = photoStops[1].x + 116;
  assert.deepEqual(missedPhotos(photoStops[0].x + 115, new Set()), []);
  assert.deepEqual(missedPhotos(x, new Set([1])), [0]);
  assert.match(photoIndicator(x, new Set([1])), /MISSED Soccer/);
  assert.deepEqual(missedPhotos(x, new Set([0,1])), []);
  assert.doesNotMatch(photoIndicator(x, new Set([0,1])), /MISSED/);
});
test('exactly 26 numbered roofs start at the former first-roof height and remain reachable', () => {
  assert.equal(floors.slice(1).length,26);
  assert.equal(floors[1].x,200);
  assert.equal(ROAD.width,LEVEL_WIDTH);
  assert.equal(ROAD.y-floors[1].y,76);
  assert.equal(floors[0].floor, 0); assert.equal(floors.at(-1).floor, 26);
  for(let i=2;i<floors.length;i++) {
    assert.ok(floors[i-1].y-floors[i].y <= 80);
    assert.ok(floors[i].x-(floors[i-1].x+floors[i-1].width) <= 45);
  }
  assert.equal(floors.at(-1).x + floors.at(-1).width, LEVEL_WIDTH);
});

test('non-person impacts select both supplied reactions', async () => {
  const { objectImpactReaction } = await import('../src/mission.mjs');
  assert.equal(objectImpactReaction(0.1), 'ouch');
  assert.equal(objectImpactReaction(0.9), 'ahh');
});

test('lower rooftops are safe; only missing roofs toward road triggers a fall', async () => {
  const {fallDecision,roadLandingIsFall,GROUND_Y}=await import('../src/mission.mjs');
  assert.deepEqual(fallDecision(1,ROAD.y,450),{scream:false,retry:false});
  for(let floor=2;floor<=26;floor++){
    assert.deepEqual(fallDecision(floor,floors[floor-1].y,450,floors[floor-1].x+100),{scream:false,retry:false});
    assert.equal(fallDecision(floor,GROUND_Y+13,450).scream,true);
    assert.equal(fallDecision(floor,GROUND_Y+61,450).retry,true);
    assert.equal(roadLandingIsFall(floor),true);
  }
});

test('only photos recovered after the summit are worth half', () => {
  const clean={falls:0,squishes:0,bumps:0};
  assert.equal(runScore(true,new Set([0,1]),clean,new Set([1])),1875);
  assert.equal(runScore(true,new Set([0,1]),clean,new Set([0,1])),1750);
  assert.equal(runScore(false,new Set([0]),clean,new Set([1])),1250);
  assert.equal(runScore(false,new Set([1]),clean,new Set([1])),1125);
});

test('120-second deadline, unchanged whole-second bonus, and shortcut override',async()=>{
  const {timeBonus,runExpired,finalScore}=await import('../src/mission.mjs');
  assert.equal(timeBonus(90000),3000);
  assert.equal(timeBonus(90001),2900);
  assert.equal(timeBonus(119000),100);
  assert.equal(timeBonus(120000),0);
  assert.equal(timeBonus(150000),0);
  assert.equal(runExpired(119999),false);
  assert.equal(runExpired(120000),true);
  assert.equal(finalScore(true,new Set([0,1]),{falls:0,squishes:0,bumps:0},new Set(),45000),9500);
  assert.equal(finalScore(true,new Set([0,1]),{falls:0,squishes:0,bumps:0},new Set(),1000,true),-10000);
});
test('all four drop rhythms are distinct, warn, land, and rearm',async()=>{
  const {dropProfiles,fallingStep}=await import('../src/mission.mjs');
  assert.equal(new Set(Object.values(dropProfiles).map(p=>p.warning+p.fall+p.landed+p.pause)).size,4);
  for(const kind of Object.keys(dropProfiles)){
    const p=dropProfiles[kind],ready={startedAt:-Infinity,readyAt:0,serial:0};
    assert.equal(fallingStep(ready,1000,false,kind).serial,0);
    const start=fallingStep(ready,1000,true,kind);
    assert.equal(start.warning,true);
    assert.equal(fallingStep(start,1000+p.warning,true,kind).dropping,true);
    assert.equal(fallingStep(start,1000+p.warning+p.fall,true,kind).landed,true);
    assert.equal(fallingStep(start,start.readyAt-1,true,kind).serial,1);
    assert.equal(fallingStep(start,start.readyAt,true,kind).serial,2);
  }
});
test('patrols sweep both ends and stay inside every platform',async()=>{
  const {patrolX}=await import('../src/mission.mjs');
  for(const floor of floors.slice(1)){
    const span=floor.width-48;
    assert.equal(patrolX(floor,0,0),floor.x+24);
    assert.equal(patrolX(floor,span/85*1000,0),floor.x+floor.width-24);
    for(let ms=0;ms<10000;ms+=113)assert.ok(patrolX(floor,ms,0)>=floor.x+24&&patrolX(floor,ms,0)<=floor.x+floor.width-24);
  }
});

test('second tap upgrades rising jump within 300ms without adding a full second jump',async()=>{
  const {megaJumpVelocity,REGULAR_JUMP_SPEED,MEGA_JUMP_SPEED}=await import('../src/mission.mjs');
  assert.equal(megaJumpVelocity(0,-490),null);
  assert.equal(megaJumpVelocity(301,-175),null);
  assert.equal(megaJumpVelocity(200,10),null);
  assert.equal(megaJumpVelocity(1,-490),-650);
  const v=-REGULAR_JUMP_SPEED+1050*.3;
  const height=REGULAR_JUMP_SPEED*.3-1050*.3**2/2;
  assert.ok(Math.abs(height+megaJumpVelocity(300,v)**2/(2*1050)-MEGA_JUMP_SPEED**2/(2*1050))<.001);
  assert.ok(REGULAR_JUMP_SPEED**2/(2*1050)>76);
});
test('countdown displays seconds only, including the last partial second and timeout',async()=>{
  const {countdownLabel}=await import('../src/mission.mjs');
  assert.equal(countdownLabel(0),'120s');
  assert.equal(countdownLabel(42000),'78s');
  assert.equal(countdownLabel(119200),'1s');
  assert.equal(countdownLabel(120000),'0s');
});

test('fall audio starts high up only after reachable roofs are missed',async()=>{
  const {fallDecision,fallingPose,SPRINT_SPEED}=await import('../src/mission.mjs');
  for(const floor of [2,12,25]){
    const roof=floors[floor],lower=floors[floor-1];
    assert.equal(fallDecision(floor,roof.y+30,250,lower.x+100).scream,false);
    assert.equal(fallDecision(floor,roof.y+30,250,roof.x+roof.width+30).scream,true);
    assert.equal(fallDecision(floor,roof.y+30,250,roof.x+roof.width+30).retry,false);
    assert.equal(fallingPose(floor,roof.y+30,250),true);
    assert.equal(fallingPose(floor,roof.y-20,250),false);
    assert.equal(fallingPose(floor,roof.y+30,-250),false);
  }
  assert.equal(fallDecision(1,floors[1].y+30,250,500).scream,false);
});
test('timer beeps every red-countdown second and never outside it',async()=>{
  const {timerWarningSecond}=await import('../src/mission.mjs');
  for(let seconds=30;seconds>=1;seconds--)assert.equal(timerWarningSecond((120-seconds)*1000),seconds);
  for(const seconds of [120,31,0])assert.equal(timerWarningSecond((120-seconds)*1000),null);
});

test('falling objects only hurt in descent, never warning/landed/cooldown',async()=>{
  const {fallingObjectHurts,fallingStep,dropProfiles}=await import('../src/mission.mjs');
  for(const kind of ['piano','anvil','ac','cooler']){
    const p=dropProfiles[kind],state={startedAt:0,readyAt:Infinity,serial:1};
    assert.equal(fallingObjectHurts(fallingStep(state,p.warning-1,false,kind)),false);
    assert.equal(fallingObjectHurts(fallingStep(state,p.warning+1,false,kind)),true);
    assert.equal(fallingObjectHurts(fallingStep(state,p.warning+p.fall+1,false,kind)),false);
  }
});

test('landed falling objects are solid only while landed, with no contact damage',async()=>{
  const {fallingObjectSolid,fallingObjectHurts,fallingStep,dropProfiles}=await import('../src/mission.mjs');
  assert.equal(fallingObjectSolid(undefined),false);
  for(const kind of ['piano','anvil','ac','cooler']){
    const p=dropProfiles[kind],state={startedAt:0,readyAt:Infinity,serial:1};
    for(const [time,solid,hurt] of [[p.warning-1,false,false],[p.warning+1,false,true],[p.warning+p.fall+1,true,false],[p.warning+p.fall+p.landed+1,false,false]]){
      const motion=fallingStep(state,time,false,kind);
      assert.equal(fallingObjectSolid(motion),solid,kind+' at '+time);
      assert.equal(fallingObjectHurts(motion),hurt,kind+' at '+time);
    }
  }
});

test('score time presentation keeps historical elapsed time in seconds without changing scores',async()=>{
 const {formatRunSeconds,finalScore}=await import('../src/mission.mjs');
 assert.equal(formatRunSeconds(60000),'60.0 seconds');assert.equal(formatRunSeconds(83456),'83.5 seconds');assert.equal(formatRunSeconds(150000),'150.0 seconds');
 assert.equal(finalScore(true,new Set([0,1]),{falls:0,squishes:0,bumps:0},new Set(),60000),8000);
});
