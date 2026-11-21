import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installControllerUI} from '../src/controller-ui.mjs';
test('controller navigates dialogs, edits names, activates restart and waits for release across transitions',()=>{
 let callback,root=null,opened=0,restarted=0,clock=0;
 const element=(kind='button')=>({
  disabled:false,maxLength:16,value:'',classList:{add(){},remove(){}},
  closest(){return null;},getClientRects(){return [1];},
  focus(){document.activeElement=this;},click(){this.clicked?.();},
  matches(selector){return kind==='text'&&selector.includes('input:not');},
  dispatchEvent(){return true;}
 });
 const name=element('text'),restart=element();restart.clicked=()=>restarted++;
 const dialog={querySelectorAll:()=>[name,restart],dispatchEvent:()=>true,close(){root=null;}};
 const pad={index:0,id:'test',connected:true,mapping:'standard',axes:[0,0],buttons:[]};
 const oldDocument=globalThis.document,oldNavigator=globalThis.navigator,oldRAF=globalThis.requestAnimationFrame;
 globalThis.document={getElementById:()=>null,body:{append(){}},createElement:()=>element(),hasFocus:()=>true,hidden:false,activeElement:null,querySelectorAll:selector=>selector==='dialog[open]'?(root?[root]:[]):[]};
 Object.defineProperty(globalThis,'navigator',{value:{getGamepads:()=>[pad]},configurable:true});
 globalThis.requestAnimationFrame=fn=>callback=fn;
 const frame=(held=[])=>{pad.buttons=Array.from({length:17},(_,i)=>({pressed:held.includes(i),value:0}));callback(clock+=20);};
 try{
  installControllerUI({openMenu:()=>{opened++;root=dialog;},audioUnlock(){}});
  frame();frame([9]);assert.equal(opened,1);
  frame([9]);assert.equal(root,dialog);
  frame();frame([0]);assert.equal(name.value,'A');
  frame([0]);assert.equal(name.value,'A');
  frame();frame([2]);assert.equal(name.value,'');
  frame();frame([13]);assert.equal(document.activeElement,restart);
  frame();frame([0]);assert.equal(restarted,1);
  frame();frame([1]);assert.equal(root,null);
  frame([9]);assert.equal(opened,1);
  frame();frame([9]);assert.equal(opened,2);
 }finally{
  globalThis.document=oldDocument;Object.defineProperty(globalThis,'navigator',{value:oldNavigator,configurable:true});globalThis.requestAnimationFrame=oldRAF;
 }
});
