import test from 'node:test';
import assert from 'node:assert/strict';
import {installDialogRotationRecovery} from '../src/dialog-rotation.mjs';
import {ModalNavigation} from '../src/modal-navigation.mjs';
function setup(){
 let time=0,id=0,focuses=0,cancels=0,settlements=0;const callbacks=new Map(),events=new Map(),input=new Map(),closed=[];
 const focus={focus(){focuses++;}};
 const make=()=>({open:false,scrollTop:31,shows:0,close(){this.open=false;closed.push(this);},showModal(){this.open=true;this.shows++;},contains:x=>x===focus});
 const menu=make(),child=make();menu.open=true;
 const win={innerWidth:844,innerHeight:390,addEventListener:(k,fn)=>events.set(k,fn),removeEventListener:k=>events.delete(k),setTimeout:fn=>{callbacks.set(++id,fn);return id;},clearTimeout:n=>callbacks.delete(n),requestAnimationFrame:fn=>{callbacks.set(++id,fn);return id;},cancelAnimationFrame:n=>callbacks.delete(n)};
 const root={querySelectorAll:()=>[menu,child].filter(x=>x.open),addEventListener:(k,fn)=>input.set(k,fn),removeEventListener:k=>input.delete(k)};
 const nav=new ModalNavigation(),recovery=installDialogRotationRecovery(root,{win,doc:{activeElement:focus},now:()=>time,onCancel(){cancels++;},onSettled(){settlements++;}});
 const flush=()=>{while(callbacks.size){const [key,fn]=callbacks.entries().next().value;callbacks.delete(key);fn();}for(const d of closed.splice(0))nav.restore(d);};
 const target={closest:q=>q==='dialog[open]'?(child.open?child:menu):{getBoundingClientRect:()=>({left:10,right:90,top:10,bottom:50})}};
 const send=(type,extra={})=>{const event={type,target,detail:1,pointerId:5,clientX:20,clientY:20,preventDefault(){this.blocked=true;},stopImmediatePropagation(){},...extra};input.get(type)(event);return event;};
 return {win,menu,child,nav,recovery,events,input,flush,send,setTime:v=>time=v,get focuses(){return focuses;},get cancels(){return cancels;},get settlements(){return settlements;}};
}
test('landscape menu rotation refreshes same modal without changing pause/navigation or focused control',()=>{
 const s=setup();s.win.innerWidth=390;s.win.innerHeight=844;s.events.get('resize')();s.events.get('orientationchange')();s.flush();
 assert.equal(s.menu.open,true);assert.equal(s.menu.shows,1);assert.equal(s.child.open,false);assert.equal(s.menu.scrollTop,31);assert.equal(s.focuses,1);assert.ok(s.cancels>=1);
 s.setTime(300);assert.equal(s.send('click').blocked,undefined);
});
test('rotation rejects carry-through and stale wrong-button coordinates, preserves keyboard access',()=>{
 const s=setup();s.events.get('orientationchange')();assert.equal(s.send('pointerdown').blocked,true);assert.equal(s.send('click',{detail:0}).blocked,undefined);s.flush();
 s.setTime(600);assert.equal(s.send('pointerup').blocked,true);assert.equal(s.send('click').blocked,true);
 s.setTime(1000);assert.equal(s.send('click',{clientX:150}).blocked,true);assert.equal(s.send('click').blocked,undefined);
});
test('rotating customization does not restore menu, genuine close does; pending refresh never reopens dismissed modal',()=>{
 const s=setup();s.nav.open(s.child,s.menu);s.events.get('orientationchange')();s.flush();assert.equal(s.child.open,true);assert.equal(s.menu.open,false);
 s.child.close();s.nav.restore(s.child);assert.equal(s.menu.open,true);
 s.events.get('orientationchange')();s.menu.close();s.flush();assert.equal(s.menu.open,false);assert.equal(s.child.open,false);
});
test('unchanged resize does not re-present modal and disposal cancels pending work',()=>{
 const s=setup();s.events.get('resize')();s.flush();assert.equal(s.menu.shows,0);
 s.events.get('orientationchange')();s.recovery.dispose();s.flush();assert.equal(s.menu.shows,0);assert.equal(s.events.size,0);assert.equal(s.input.size,0);
});

test('rotation settles input geometry even during active play without an open dialog',()=>{
 const s=setup();s.menu.open=false;s.events.get('orientationchange')();s.flush();assert.equal(s.settlements,1);assert.equal(s.menu.shows,0);assert.ok(s.cancels>0);
});
