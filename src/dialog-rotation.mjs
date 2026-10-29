// Re-present the existing native modal after viewport rotation/layout settles.
// This preserves DOM/listeners and refreshes top-layer layout and hit testing.
export function installDialogRotationRecovery(root,{win=window,doc=document,now=()=>performance.now(),onCancel=()=>{}}={}){
 let dimensions=`${win.innerWidth}x${win.innerHeight}`,timer,frame,readyAt=0,disposed=false;
 const held=new Set();
 const modal=()=>[...root.querySelectorAll('dialog[open]')].at(-1);
 function settled(){
  timer=undefined;
  frame=win.requestAnimationFrame(()=>{
   frame=undefined;if(disposed)return;
   const dialog=modal();if(!dialog)return;
   const focused=doc.activeElement,scrollTop=dialog.scrollTop;
   // close/show is synchronous: queued close listeners see it still open and
   // must not navigate back or resume play (ModalNavigation.restore checks this).
   dialog.close();dialog.showModal();dialog.scrollTop=scrollTop;
   if(focused&&dialog.contains(focused))focused.focus({preventScroll:true});
   readyAt=now()+250;
  });
 }
 function refresh(){
  onCancel();
  if(!modal())return;
  readyAt=now()+250;
  if(timer!==undefined)win.clearTimeout(timer);
  if(frame!==undefined){win.cancelAnimationFrame(frame);frame=undefined;}
  timer=win.setTimeout(settled,120);
 }
 const resize=()=>{const next=`${win.innerWidth}x${win.innerHeight}`;if(next===dimensions)return;dimensions=next;refresh();};
 const stop=event=>{event.preventDefault();event.stopImmediatePropagation();};
 const guard=event=>{
  if(!event.target?.closest?.('dialog[open]'))return;
  const busy=timer!==undefined||frame!==undefined||now()<readyAt;
  if(event.type==='pointerdown'&&busy){held.add(event.pointerId);stop(event);return;}
  if((event.type==='pointerup'||event.type==='pointercancel')&&held.delete(event.pointerId)){readyAt=now()+350;stop(event);return;}
  if(event.type!=='click'||event.detail===0)return; // Native keyboard/AT activation.
  if(busy){stop(event);return;}
  const button=event.target.closest('button');
  if(button){const r=button.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)stop(event);}
 };
 const types=['pointerdown','pointerup','pointercancel','click'];
 types.forEach(type=>root.addEventListener(type,guard,true));
 win.addEventListener('resize',resize);win.visualViewport?.addEventListener('resize',resize);
 win.addEventListener('orientationchange',refresh);win.screen?.orientation?.addEventListener('change',refresh);
 return {dispose(){disposed=true;if(timer!==undefined)win.clearTimeout(timer);if(frame!==undefined)win.cancelAnimationFrame(frame);held.clear();types.forEach(type=>root.removeEventListener(type,guard,true));win.removeEventListener('resize',resize);win.visualViewport?.removeEventListener('resize',resize);win.removeEventListener('orientationchange',refresh);win.screen?.orientation?.removeEventListener('change',refresh);}};
}
