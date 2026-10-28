import test from 'node:test';
import assert from 'node:assert/strict';
const buttons=[];
globalThis.document={querySelectorAll:()=>buttons,addEventListener(){}};
globalThis.window={addEventListener(){}};
const {TouchInput}=await import('../src/touch.mjs');
test('touch permits simultaneous movement/sprint with one jump per tap and clears on suppression',()=>{
 const input=new TouchInput();input.enabled=true;
 input.held.set(1,'right');input.held.set(2,'sprint');input.held.set(3,'jump');input.edges.add('jump');
 let state=input.sample();assert.equal(state.move,1);assert.equal(state.sprint,true);assert.equal(state.jump,true);
 assert.equal(input.sample().jump,false);
 input.edges.add('jump');assert.equal(input.sample().jump,true);
 input.sample(true);assert.equal(input.held.size,0);assert.equal(input.sample().move,0);
 input.enabled=false;input.edges.add('interact');assert.equal(input.sample().interact,false);
});
test('opposing directions cancel and releasing one finger preserves the other',()=>{
 const input=new TouchInput();input.enabled=true;input.held.set(1,'left');input.held.set(2,'right');
 assert.equal(input.sample().move,0);input.held.delete(2);assert.equal(input.sample().move,-1);
 input.clear();assert.equal(input.sample().move,0);
});
test('pointer handlers capture independent fingers and release on cancellation or capture loss',()=>{
 const make=(action)=>({dataset:{touch:action},listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},setPointerCapture(id){this.captured=id;},removeAttribute(){delete this.dataset.held;}});
 const right=make('right'),sprint=make('sprint'),jump=make('jump');buttons.push(right,sprint,jump);
 const input=new TouchInput();input.enabled=true;
 const press=(button,id)=>button.listeners.pointerdown({pointerId:id,preventDefault(){}});
 press(right,1);press(sprint,2);press(jump,3);
 assert.equal(right.captured,1);assert.deepEqual(input.sample(),{move:1,sprint:true,jump:true,interact:false,recall:false,pause:false,restart:false});
 jump.listeners.pointerup({pointerId:3});press(jump,4);assert.equal(input.sample().jump,true);
 right.listeners.pointercancel({pointerId:1});assert.equal(input.sample().move,0);assert.equal(input.sample().sprint,true);
 sprint.listeners.lostpointercapture({pointerId:2});assert.equal(input.sample().sprint,false);
 input.clear();assert.equal(jump.dataset.held,undefined);buttons.length=0;
});
