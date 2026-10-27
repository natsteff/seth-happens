import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ControllerInput,keyboardOrControllerMove} from '../src/controller.mjs';
const pad=(held=[],axis=0,index=0)=>({index,id:'test-pad-'+index,connected:true,mapping:'standard',axes:[axis,0],buttons:Array.from({length:17},(_,i)=>({pressed:held.includes(i),value:held.includes(i)?1:0}))});
test('keyboard is independent/default, standard pad waits for neutral and ignores drift',()=>{
 const c=new ControllerInput();assert.equal(c.sample([]).move,0);
 assert.equal(c.sample([pad([0],.8)]).jump,false);
 assert.equal(c.sample([pad()]).jump,false);
 assert.equal(c.sample([pad([], .2)]).move,0);
 assert.equal(c.sample([pad([], -.9)]).move,-1);
 assert.equal(keyboardOrControllerMove(false,true,-1),1);
 assert.equal(keyboardOrControllerMove(true,true,1),0);
 assert.equal(keyboardOrControllerMove(false,false,-1),-1);
});
test('jump is press-edge only, so held buttons do not repeat or trigger Mega Jump',()=>{
 const c=new ControllerInput();c.sample([pad()]);
 assert.equal(c.sample([pad([0])]).jump,true);
 assert.equal(c.sample([pad([0])]).jump,false);
 c.sample([pad()]);assert.equal(c.sample([pad([0])]).jump,true);
});
test('standard Xbox/PS positions map actions, triggers and dpad',()=>{
 const c=new ControllerInput();c.sample([pad()]);
 const state=c.sample([pad([1,2,7,9,15])]);
 assert.equal(state.recall,true);assert.equal(state.interact,true);assert.equal(state.pause,true);assert.equal(state.sprint,true);assert.equal(state.move,1);
 assert.equal(c.sample([pad([9])]).pause,false);
});
test('disconnect, dialog/focus suppression and re-connect cannot leave held inputs active',()=>{
 const c=new ControllerInput();c.sample([pad()]);c.sample([pad([0,15])]);
 assert.equal(c.sample([]).disconnected,true);assert.equal(c.sample([]).disconnected,false);
 assert.equal(c.sample([pad([0,15])]).move,0);c.sample([pad()]);
 assert.equal(c.sample([pad([0])],false).jump,false);
 assert.equal(c.sample([pad([0])]).jump,false);c.sample([pad()]);
 assert.equal(c.sample([pad([0])]).jump,true);
 assert.equal(c.sample([pad([],0,1)]).disconnected,true);
});
test('nonstandard pads are left to keyboard rather than guessing button mapping',()=>{
 assert.equal(new ControllerInput().sample([{...pad([0]),mapping:''}]).connected,false);
});
