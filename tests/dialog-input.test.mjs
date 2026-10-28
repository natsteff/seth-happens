import test from 'node:test';
import assert from 'node:assert/strict';
import {installOpeningGuard} from '../src/dialog-input.mjs';
test('opening touch cannot change newly opened controls; intentional later and keyboard clicks work',()=>{
 const listeners=new Map();let time=0;
 const dialog={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const guard=installOpeningGuard(dialog,{now:()=>time});guard.arm();
 const send=(type,extra={})=>{const event={detail:1,pointerId:1,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};listeners.get(type)(event);return event;};
 assert.equal(send('click').prevented,true);
 assert.equal(send('click',{detail:0}).prevented,undefined);
 assert.equal(send('pointerdown').prevented,true);
 time=300;assert.equal(send('pointerup').prevented,true,'a held opening finger stays blocked past the initial delay');
 assert.equal(send('click').prevented,true);
 time=651;assert.equal(send('pointerdown').prevented,undefined);assert.equal(send('click').prevented,undefined);
 guard.arm();send('pointerdown');send('close');time=1000;assert.equal(send('pointerup').prevented,undefined);
 guard.dispose();assert.equal(listeners.size,0);
});
