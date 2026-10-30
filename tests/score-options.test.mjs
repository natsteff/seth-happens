import test from 'node:test';import assert from 'node:assert/strict';
import {PLAYER_NAME_KEY,savedPlayerName,rememberPlayerName,clearPasswordRequired,fitScoreDialog} from '../src/score-options.mjs';
test('remembered successful player name preserves full letters and other records; storage failures safe',()=>{
 const data=new Map([['scores','keep']]);const s={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 assert.equal(savedPlayerName(s),'');assert.equal(rememberPlayerName(s,'  Nate W.  '),true);assert.equal(savedPlayerName(s),'Nate W.');assert.equal(data.get('scores'),'keep');
 data.set(PLAYER_NAME_KEY,'broken');assert.equal(savedPlayerName(s),'');assert.equal(rememberPlayerName(s,'12345678901234567'),false);assert.equal(savedPlayerName(null),'');assert.equal(rememberPlayerName(null,'Nate'),false);
});
test('github.io exemption only affects local scores, other hosts default protected and explicit opt-out allowed',()=>{
 assert.equal(clearPasswordRequired('natsteff.github.io','local'),false);
 for(const host of ['github.io.evil.test','localhost','example.com'])assert.equal(clearPasswordRequired(host,'local'),true);
 assert.equal(clearPasswordRequired('example.com','local',{clearPasswordRequired:false}),false);
 assert.equal(clearPasswordRequired('natsteff.github.io','server',{clearPasswordRequired:false}),true);
 assert.equal(clearPasswordRequired('anywhere','server',{},false),false);
});
test('compact name entry follows visual keyboard viewport offsets and height',()=>{
 const props={};fitScoreDialog({style:{setProperty:(k,v)=>props[k]=v}},{visualViewport:{offsetLeft:4,offsetTop:10,width:650,height:145}});
 assert.equal(props['--score-height'],'145px');assert.equal(props['--score-top'],'10px');assert.equal(props['--score-width'],'650px');
});
