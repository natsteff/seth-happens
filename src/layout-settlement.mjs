export function refreshMeasuredScale(scale){scale.getParentBounds();scale.refresh();}
// Mobile viewport and flex parents can settle after the first orientation event.
/** @param {()=>void} refresh @param {{win?: Window, parent?: Element|null}} options */
export function installLayoutSettlement(refresh,{win=window,parent=null}={}){
 let frame,timers=[];
 function schedule(){
  if(frame!==undefined)win.cancelAnimationFrame(frame);
  timers.forEach(id=>win.clearTimeout(id));timers=[];
  frame=win.requestAnimationFrame(()=>{frame=win.requestAnimationFrame(()=>{frame=undefined;refresh();});});
  for(const delay of [180,500])timers.push(win.setTimeout(refresh,delay));
 }
 const observer=win.ResizeObserver&&parent?new win.ResizeObserver(schedule):null;observer?.observe(parent);
 win.addEventListener('resize',schedule);win.addEventListener('orientationchange',schedule);win.visualViewport?.addEventListener('resize',schedule);win.screen?.orientation?.addEventListener('change',schedule);
 return {schedule,dispose(){if(frame!==undefined)win.cancelAnimationFrame(frame);timers.forEach(id=>win.clearTimeout(id));observer?.disconnect();win.removeEventListener('resize',schedule);win.removeEventListener('orientationchange',schedule);win.visualViewport?.removeEventListener('resize',schedule);win.screen?.orientation?.removeEventListener('change',schedule);}};
}
