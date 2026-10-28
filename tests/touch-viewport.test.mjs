import test from 'node:test';
import assert from 'node:assert/strict';
import {visiblePlayRect,cancelPlayGesture,installTouchViewport} from '../src/touch-viewport.mjs';
const target=kind=>({closest(selector){return selector==='dialog'?kind==='dialog':['canvas','control'].includes(kind);}});
test('game gestures are cancelled but dialogs and ordinary page scrolling remain native',()=>{
 const state={touchMode:true,locked:true};
 for(const type of ['touchstart','touchmove','touchend','gesturestart','gesturechange','dblclick']){
  assert.equal(cancelPlayGesture(type,target('control'),state),true);
  assert.equal(cancelPlayGesture(type,target('canvas'),state),true);
  assert.equal(cancelPlayGesture(type,target('dialog'),state),false);
  assert.equal(cancelPlayGesture(type,target('canvas'),{touchMode:false,locked:false}),false);
 }
 assert.equal(cancelPlayGesture('touchmove',target('background'),state),true);
 assert.equal(cancelPlayGesture('touchstart',target('menu-button'),state),false,'menu tap must still generate a click');
 assert.equal(cancelPlayGesture('touchmove',target('background'),{touchMode:true,locked:false}),false);
});
test('visible viewport uses toolbar/keyboard dimensions; native fullscreen uses fullscreen window',()=>{
 const win={innerWidth:844,innerHeight:390,visualViewport:{width:800,height:300,offsetTop:45,offsetLeft:4}};
 assert.deepEqual(visiblePlayRect(win),{left:4,top:45,width:800,height:300});
 assert.deepEqual(visiblePlayRect(win,true),{left:0,top:0,width:844,height:390});
 delete win.visualViewport;assert.deepEqual(visiblePlayRect(win),{left:0,top:0,width:844,height:390});
});
function surface(){
 const classes=new Set(),props=new Map(),listeners=new Map();
 return {classList:{contains:key=>classes.has(key),add:key=>classes.add(key),remove:key=>classes.delete(key)},style:{setProperty:(key,value)=>props.set(key,value),removeProperty:key=>props.delete(key),getPropertyValue:key=>props.get(key)},listeners,
 addEventListener(name,fn,options){listeners.set(name,{fn,options});},removeEventListener(name){listeners.delete(name);}};
}
test('expanded touch play locks background, tracks viewport resize, and restores page scroll on exit',()=>{
 const root=surface(),html=surface(),doc=surface(),win=surface(),view=surface();let cancels=0,resizes=0;
 root.classList.add('touch-mode');root.classList.add('expanded');doc.documentElement=html;
 Object.assign(win,{innerWidth:844,innerHeight:390,scrollX:0,scrollY:250,visualViewport:view,scrollTo(x,y){this.restored=[x,y];}});
 Object.assign(view,{width:844,height:330,offsetTop:0,offsetLeft:0});
 const controller=installTouchViewport(root,{win,doc,onCancel(){cancels++;},onResize(){resizes++;}});
 assert.equal(controller.locked,true);assert.equal(html.classList.contains('touch-play-locked'),true);assert.equal(html.style.getPropertyValue('--touch-page-top'),'-250px');
 assert.equal(root.style.getPropertyValue('--play-height'),'330px');
 assert.equal(root.listeners.get('touchmove').options.passive,false);
 let prevented=false;root.listeners.get('touchend').fn({type:'touchend',target:target('control'),cancelable:true,preventDefault(){prevented=true;}});assert.equal(prevented,true);
 prevented=false;root.listeners.get('touchmove').fn({type:'touchmove',target:target('dialog'),cancelable:true,preventDefault(){prevented=true;}});assert.equal(prevented,false);
 view.height=280;view.listeners.get('resize').fn();assert.equal(root.style.getPropertyValue('--play-height'),'280px');assert.equal(cancels,1);
 root.classList.remove('expanded');controller.sync();assert.equal(controller.locked,false);assert.equal(html.classList.contains('touch-play-locked'),false);assert.deepEqual(win.restored,[0,250]);assert.equal(root.style.getPropertyValue('--play-height'),undefined);
 assert.equal(resizes,3);controller.dispose();assert.equal(view.listeners.size,0);assert.equal(root.listeners.size,0);
});
test('native fullscreen escape releases page lock; two-finger gestures are blocked outside dialogs',()=>{
 const root=surface(),html=surface(),doc=surface(),win=surface();doc.documentElement=html;doc.fullscreenElement=root;root.classList.add('touch-mode');
 Object.assign(win,{innerWidth:844,innerHeight:390,scrollX:0,scrollY:0,scrollTo(){}});
 const controller=installTouchViewport(root,{doc,win});assert.equal(controller.locked,true);
 let prevented=false;root.listeners.get('touchstart').fn({type:'touchstart',target:target('background'),touches:[{},{}],cancelable:true,preventDefault(){prevented=true;}});assert.equal(prevented,true);
 doc.fullscreenElement=null;doc.listeners.get('fullscreenchange').fn();assert.equal(controller.locked,false);controller.dispose();
});
