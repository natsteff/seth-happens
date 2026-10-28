// Stop the opening tap (and fingers already down during the guard) carrying
// through into a newly opened pane. Keyboard/accessibility activation stays usable.
export function installOpeningGuard(dialog,{now=()=>performance.now()}={}){
 let readyAt=0,clickBlockedUntil=0;const pointers=new Set();
 const stop=event=>{event.preventDefault();event.stopImmediatePropagation();};
 const down=event=>{if(now()<readyAt){pointers.add(event.pointerId);stop(event);}};
 const up=event=>{if(pointers.delete(event.pointerId)){clickBlockedUntil=now()+350;stop(event);}};
 const click=event=>{if(event.detail!==0&&now()<Math.max(readyAt,clickBlockedUntil))stop(event);};
 const close=()=>pointers.clear();
 const listeners=[['pointerdown',down],['pointerup',up],['pointercancel',up],['click',click],['close',close]];
 listeners.forEach(([name,handler])=>dialog.addEventListener(name,handler,true));
 return {arm(){pointers.clear();clickBlockedUntil=0;readyAt=now()+250;},dispose(){listeners.forEach(([name,handler])=>dialog.removeEventListener(name,handler,true));pointers.clear();}};
}
