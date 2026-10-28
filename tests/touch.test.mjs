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
test('one captured thumb reverses through neutral without lifting; edges sprint with hysteresis',async()=>{
 const {SlidingMovement}=await import('../src/touch.mjs');const stick=new SlidingMovement();
 assert.equal(stick.start(1,-.5),true);assert.equal(stick.direction,-1);assert.equal(stick.sprint,false);
 assert.equal(stick.start(2,1),false);stick.move(2,1);assert.equal(stick.direction,-1);
 stick.move(1,0);assert.equal(stick.direction,0);
 stick.move(1,.5);assert.equal(stick.direction,1);assert.equal(stick.sprint,false);
 stick.move(1,.85);assert.equal(stick.sprint,true);stick.move(1,.7);assert.equal(stick.sprint,true);
 stick.move(1,.6);assert.equal(stick.sprint,false);stick.move(1,-1);assert.equal(stick.direction,-1);assert.equal(stick.sprint,true);
 stick.release(2);assert.equal(stick.direction,-1);stick.release(1);assert.equal(stick.direction,0);assert.equal(stick.sprint,false);
 stick.start(3,1);stick.clear();assert.equal(stick.pointer,null);assert.equal(stick.axis,0);
});
test('sliding movement remains independent of jump presses and clears when blocked',()=>{
 const input=new TouchInput();input.enabled=true;input.movement.start(4,-1);input.held.set(5,'jump');input.edges.add('jump');
 assert.equal(input.sample().jump,true);const held=input.sample();assert.equal(held.move,-1);assert.equal(held.sprint,true);assert.equal(held.jump,false);
 input.movement.move(4,.4);assert.equal(input.sample().move,1);assert.equal(input.sample().sprint,false);
 input.sample(true);assert.equal(input.movement.pointer,null);assert.equal(input.sample().move,0);
});
test('slider DOM captures one finger, tracks it across directions, and resets on cancellation',()=>{
 const slider={listeners:{},dataset:{},attrs:{},style:{setProperty(){}},addEventListener(name,fn){this.listeners[name]=fn;},getBoundingClientRect(){return {left:0,width:136};},setPointerCapture(id){this.captured=id;},setAttribute(key,value){this.attrs[key]=value;}};
 document.getElementById=()=>slider;
 const input=new TouchInput();input.enabled=true;
 const event=(id,x)=>({pointerId:id,clientX:x,preventDefault(){}});
 slider.listeners.pointerdown(event(8,68));assert.equal(slider.captured,8);assert.equal(input.sample().move,0);
 slider.listeners.pointermove(event(8,125));assert.equal(input.sample().move,1);assert.equal(input.sample().sprint,true);
 slider.listeners.pointerdown(event(9,10));assert.equal(slider.captured,8);
 slider.listeners.pointermove(event(8,10));assert.equal(input.sample().move,-1);assert.equal(slider.attrs['aria-valuetext'],'Sprinting left');
 slider.listeners.pointercancel(event(8,10));assert.equal(input.sample().move,0);assert.equal(slider.attrs['aria-valuenow'],'0');
 delete document.getElementById;
});
test('Default arrows walk without sprint even at full input; style changes clear held movement',()=>{
 const input=new TouchInput();input.enabled=true;input.style='default';input.held.set(1,'right');input.held.set(2,'sprint');input.movement.start(3,-1);
 assert.equal(input.sample().move,1);assert.equal(input.sample().sprint,false);
 input.clear();assert.equal(input.sample().move,0);assert.equal(input.sample().sprint,false);
});
test('Game Stick clamps diagonal travel radially and vertical alone never moves or jumps',()=>{
 const slider={listeners:{},dataset:{},style:{setProperty(){}},addEventListener(name,fn){this.listeners[name]=fn;},getBoundingClientRect(){return {left:0,top:0,width:108,height:108};},setPointerCapture(){},setAttribute(){}};
 document.getElementById=()=>slider;const input=new TouchInput();input.enabled=true;input.style='stick';
 const e=(id,x,y)=>({pointerId:id,clientX:x,clientY:y,preventDefault(){}});
 slider.listeners.pointerdown(e(1,54,0));assert.equal(input.sample().move,0);assert.equal(input.sample().jump,false);assert.equal(input.vertical,-1);
 slider.listeners.pointermove(e(1,108,0));assert.ok(Math.abs(Math.hypot(input.movement.axis,input.vertical)-1)<.001);assert.equal(input.sample().sprint,false);
 slider.listeners.pointermove(e(2,0,54));assert.equal(input.sample().move,1);
 slider.listeners.pointermove(e(1,108,54));assert.equal(input.sample().sprint,true);
 slider.listeners.pointercancel(e(1,108,54));assert.equal(input.vertical,0);assert.equal(input.sample().move,0);
 delete document.getElementById;
});
test('quick sprint requires a released short same-arrow double-tap; release requires a fresh pair',async()=>{
 const {QuickSprint}=await import('../src/touch.mjs');const sprint=new QuickSprint();
 sprint.press(1,'right',0);assert.equal(sprint.active,false);sprint.release(1,60);
 sprint.press(2,'right',200);assert.equal(sprint.active,true);sprint.release(2,500);
 sprint.press(3,'right',550);assert.equal(sprint.active,false);sprint.release(3,590);
 sprint.press(4,'right',700);assert.equal(sprint.active,true);sprint.clear();assert.equal(sprint.active,false);
});
test('slow taps, long first holds, alternating arrows and overlapping fingers cannot trigger sprint',async()=>{
 const {QuickSprint}=await import('../src/touch.mjs');
 for(const [firstRelease,secondTime,direction] of [[50,251,'right'],[210,240,'right'],[50,150,'left']]){
  const sprint=new QuickSprint();sprint.press(1,'right',0);sprint.release(1,firstRelease);sprint.press(2,direction,secondTime);assert.equal(sprint.active,false);
 }
 const sprint=new QuickSprint();sprint.press(1,'right',0);sprint.press(2,'right',100);assert.equal(sprint.active,false);sprint.release(1,120);sprint.release(2,130);assert.equal(sprint.lastTap,null);
 sprint.press(3,'right',200);sprint.release(3,220,true);sprint.press(4,'right',230);assert.equal(sprint.active,false);
});
test('Default quick sprint is opt-in, Jump independent, and reverse/dialog cancellation removes active sprint',()=>{
 const make=action=>({dataset:{touch:action},listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},setPointerCapture(){},removeAttribute(){}});
 const right=make('right'),left=make('left'),jump=make('jump');buttons.push(right,left,jump);const input=new TouchInput();input.style='default';input.enabled=true;
 const down=(button,id,time)=>button.listeners.pointerdown({pointerId:id,timeStamp:time,preventDefault(){}});
 const up=(button,id,time)=>button.listeners.pointerup({pointerId:id,timeStamp:time,type:'pointerup'});
 down(right,1,0);up(right,1,40);down(right,2,100);assert.equal(input.sample().sprint,false);up(right,2,130);
 input.clear();input.quickSprintEnabled=true;down(right,3,200);up(right,3,230);down(right,4,300);assert.equal(input.sample().sprint,true);
 down(jump,5,320);assert.equal(input.sample().jump,true);assert.equal(input.sample().sprint,true);up(jump,5,330);
 down(left,6,350);assert.equal(input.sample().sprint,false);up(right,4,360);assert.equal(input.sample().move,-1);assert.equal(input.sample().sprint,false);
 input.sample(true);assert.equal(input.quickSprint.active,false);assert.equal(input.quickSprint.lastTap,null);buttons.length=0;
});
