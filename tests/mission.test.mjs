import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScore, recordMishap, missedPhotos, photoIndicator, photoStops, floors, LEVEL_WIDTH, ROUTE_OFFSET, ROAD, pianoStep, PIANO_DROP_MS, PIANO_PAUSE_MS } from '../src/mission.mjs';
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
test('triple-length climb plus a road approach has reachable steps to floor 26', () => {
  assert.equal(LEVEL_WIDTH, 2510 * 3 + ROUTE_OFFSET);
  assert.equal(floors[0].x,200);
  assert.equal(ROAD.width,LEVEL_WIDTH);
  assert.equal(ROAD.y-floors[0].y,76);
  assert.equal(floors[0].floor, 0); assert.equal(floors.at(-1).floor, 26);
  for(let i=1;i<floors.length;i++) {
    assert.ok(floors[i-1].y-floors[i].y <= 80);
    assert.ok(floors[i].x-(floors[i-1].x+floors[i-1].width) <= 45);
  }
  assert.equal(floors.at(-1).x + floors.at(-1).width, LEVEL_WIDTH);
});

test('piano waits out of range, drops on approach, then pauses and rearms', () => {
  const ready={startedAt:-Infinity,readyAt:0,serial:0};
  assert.equal(pianoStep(ready,5000,false).serial,0);
  const triggered=pianoStep(ready,5000,true);
  assert.equal(triggered.dropping,true);assert.equal(triggered.offset,-230);
  assert.equal(triggered.serial,1);
  const falling=pianoStep(triggered,5090,true);
  assert.ok(falling.offset>triggered.offset);assert.equal(falling.serial,1);
  const paused=pianoStep(falling,5000+PIANO_DROP_MS,true);
  assert.equal(paused.dropping,false);assert.equal(paused.serial,1);
  assert.equal(pianoStep(paused,paused.readyAt-1,true).serial,1);
  assert.equal(pianoStep(paused,5000+PIANO_DROP_MS+PIANO_PAUSE_MS,true).serial,2);
  assert.equal(pianoStep(paused,paused.readyAt,false).dropping,false);
});

test('non-person impacts select both supplied reactions', async () => {
  const { objectImpactReaction } = await import('../src/mission.mjs');
  assert.equal(objectImpactReaction(0.1), 'ouch');
  assert.equal(objectImpactReaction(0.9), 'ahh');
});

test('stepping down one rooftop is safe; dropping past it is a true fall', async () => {
  const { isTrueFall, FLOOR_RISE } = await import('../src/mission.mjs');
  assert.equal(isTrueFall(1000 + FLOOR_RISE,1000,400),false);
  assert.equal(isTrueFall(1000 + FLOOR_RISE + 20,1000,450),false);
  assert.equal(isTrueFall(1120,1000,-200),false);
  assert.equal(isTrueFall(1120,1000,450),true);
});

test('only photos recovered after the summit are worth half', () => {
  const clean={falls:0,squishes:0,bumps:0};
  assert.equal(runScore(true,new Set([0,1]),clean,new Set([1])),1875);
  assert.equal(runScore(true,new Set([0,1]),clean,new Set([0,1])),1750);
  assert.equal(runScore(false,new Set([0]),clean,new Set([1])),1250);
  assert.equal(runScore(false,new Set([1]),clean,new Set([1])),1125);
});
