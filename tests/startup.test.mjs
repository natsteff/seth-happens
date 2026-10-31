import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function boot(){
 const elements=Object.fromEntries(['startup-status','startup-message','startup-progress','startup-retry'].map(id=>[id,{style:{},hidden:true,removeAttribute(key){delete this[key];}}]));
 const handlers={},timers=new Map();let next=0,destination;
 vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{document:{getElementById:id=>elements[id]},window:{addEventListener:(name,fn)=>handlers[name]=fn},setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),URL,Date,location:{href:'https://example.com/game/?other=1',replace:url=>destination=url}});
 return {elements,emit:detail=>handlers['game-startup']({detail}),slow:()=>[...timers.values()].at(-1)(),retry:()=>{elements['startup-retry'].onclick();return new URL(destination);}};
}
test('early HTML loader exists before game module; progress and ready dismiss it',()=>{
 assert.ok(html.indexOf('Loading game…')<html.indexOf('src="/src/main.ts"'));
 const b=boot();b.emit({state:'progress',value:.5});assert.match(b.elements['startup-message'].textContent,/50%/);b.emit({state:'ready'});assert.equal(b.elements['startup-status'].style.display,'none');
});
test('slow or failed startup offers cache-busted retry and keeps failed assets visible',()=>{
 const b=boot();b.slow();assert.equal(b.elements['startup-retry'].hidden,false);
 b.emit({state:'error'});b.emit({state:'progress',value:1});b.emit({state:'ready'});assert.match(b.elements['startup-message'].textContent,/could not load/);assert.notEqual(b.elements['startup-status'].style.display,'none');
 const url=b.retry();assert.equal(url.pathname,'/game/');assert.equal(url.searchParams.get('other'),'1');assert.ok(url.searchParams.has('_retry'));
});
test('confirmed update brings loader back and late scene readiness cannot hide it',()=>{
 const b=boot();b.emit({state:'ready'});b.emit({state:'updating'});assert.match(b.elements['startup-message'].textContent,/Update detected/);assert.equal(b.elements['startup-status'].style.display,'flex');
 // A late ready signal belongs to the old page and must not obscure navigation status.
 b.emit({state:'progress',value:.8});b.emit({state:'ready'});assert.equal(b.elements['startup-status'].style.display,'flex');assert.match(b.elements['startup-message'].textContent,/Update detected/);
});
