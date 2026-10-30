import test from 'node:test';import assert from 'node:assert/strict';
import {refreshMeasuredScale,installLayoutSettlement} from '../src/layout-settlement.mjs';
test('scale remeasures changed parent before refresh so stale orientation size is not reused',()=>{
 const scale={parent:390,cached:844,getParentBounds(){this.cached=this.parent;},refresh(){this.display=this.cached;}};refreshMeasuredScale(scale);assert.equal(scale.display,390);
});
test('orientation/layout repair reruns after async parent settlement and cancels timers on disposal',()=>{
 const events=new Map(),tasks=new Map();let id=0,width=844;const samples=[];
 const win={addEventListener:(k,fn)=>events.set(k,fn),removeEventListener:k=>events.delete(k),requestAnimationFrame:fn=>{tasks.set(++id,fn);return id;},cancelAnimationFrame:n=>tasks.delete(n),setTimeout:fn=>{tasks.set(++id,fn);return id;},clearTimeout:n=>tasks.delete(n)};
 const repair=installLayoutSettlement(()=>samples.push(width),{win});events.get('orientationchange')();width=390;
 while(tasks.size){const [n,fn]=tasks.entries().next().value;tasks.delete(n);fn();}
 assert.ok(samples.length>=3);assert.ok(samples.every(v=>v===390));repair.schedule();repair.dispose();assert.equal(tasks.size,0);assert.equal(events.size,0);
});
