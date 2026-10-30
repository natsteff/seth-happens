// Settle viewport/input geometry without closing or reopening an active modal.
// Replacing its top-layer entry during rotation can invalidate an in-flight tap.
export function installDialogRotationRecovery(root,{win=window,doc=document,now=()=>performance.now(),onCancel=()=>{},onSettled=()=>{}}={}){
 let dimensions=`${win.innerWidth}x${win.innerHeight}`,timer,frame,readyAt=0,disposed=false;
 const held=new Set();
 const modal=()=>[...root.querySelectorAll('dialog[open]')].at(-1);
 function settled(){
  timer=undefined;
  frame=win.requestAnimationFrame(()=>{
   frame=undefined;if(disposed)return;
   onSettled();
   const dialog=modal();if(!dialog)return;
   // Layout is now in the document coordinate space; retain native focus,
   // selection, scroll position and modal ownership throughout the transition.
   dialog.getBoundingClientRect();
   readyAt=now()+250;
  });
 }
 function refresh(){
  onCancel();
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
