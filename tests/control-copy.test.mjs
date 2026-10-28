import test from 'node:test';
import assert from 'node:assert/strict';
import {controlCopy} from '../src/control-copy.mjs';
test('touch pause and interactions name visible controls while desktop text stays intact',()=>{
 const source='P or Resume to continue';assert.equal(controlCopy(source,false),source);
 assert.equal(controlCopy(source,true),'Open ☰ menu, then tap Resume to continue');
 assert.equal(controlCopy('ACTION / F: GRAB BEER',true),'ACTION: GRAB BEER');
 assert.equal(controlCopy('[ F ] PHOTO STOP',true),'[ Action ] PHOTO STOP');
 assert.equal(controlCopy('Press B to return.',true),'Use Recall missed photo in the menu to return.');
 assert.equal(controlCopy('Hold R or press Restart',true),'Use Restart in the menu');
 assert.equal(controlCopy('P • PAUSE  /  SHIFT • SPRINT  /  B • PHOTO',true),'☰ MENU • PAUSE / RECALL / SETTINGS');
});
