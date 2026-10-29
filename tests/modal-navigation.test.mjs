import test from 'node:test';
import assert from 'node:assert/strict';
import {ModalNavigation} from '../src/modal-navigation.mjs';
function dialog(open=false){return {open,shows:0,closes:0,showModal(){this.open=true;this.shows++;},close(){this.open=false;this.closes++;}};}
test('help temporarily replaces menu and returns without gameplay callbacks, across repeated visits',()=>{
 const nav=new ModalNavigation(),menu=dialog(true),help=dialog();let focused=0;
 for(let i=0;i<3;i++){
  nav.open(help,menu,{focus(){focused++;}});assert.equal(menu.open,false);assert.equal(help.open,true);
  nav.open(help,menu);assert.equal(help.shows,i+1);
  help.close();nav.restore(help);assert.equal(menu.open,true);assert.equal(help.open,false);
 }
 assert.equal(focused,3);
});
test('restart discards pending return, stale close events do not reopen a menu',()=>{
 const nav=new ModalNavigation(),menu=dialog(true),help=dialog();
 nav.open(help,menu);nav.reset();nav.restore(help);assert.equal(menu.open,false);assert.equal(help.open,false);
});
test('offer/help and customization use the same single-modal return path',()=>{
 const nav=new ModalNavigation(),offer=dialog(true),help=dialog(),controls=dialog();
 nav.open(help,offer);help.close();nav.restore(help);assert.equal(offer.open,true);
 nav.open(controls,offer);controls.close();nav.restore(controls);assert.equal(offer.open,true);
 nav.open(help,offer);nav.restore(help);assert.equal(offer.open,false,'queued old close cannot restore while child is open');
});
