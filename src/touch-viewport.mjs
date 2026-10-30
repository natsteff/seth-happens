// Keep the game inside the visible viewport, while allowing native scrolling in dialogs.
export function visiblePlayRect(win,fullscreen=false){
 const view=fullscreen?null:win.visualViewport;
 return {left:view?.offsetLeft??0,top:view?.offsetTop??0,width:Math.max(1,view?.width??win.innerWidth),height:Math.max(1,view?.height??win.innerHeight)};
}
export function cancelPlayGesture(type,target,{touchMode,locked}){
 if(!touchMode||target?.closest?.('dialog'))return false;
 const gameplay=!!target?.closest?.('[data-touch], #touch-stick, canvas');
 return gameplay||(locked&&['touchmove','gesturestart','gesturechange'].includes(type));
}
export function installTouchViewport(root,{win=window,doc=document,onResize=()=>{},onCancel=()=>{}}={}){
 let locked=false,savedX=0,savedY=0,lastRect='';
 const dimensions=['--play-left','--play-top','--play-width','--play-height'];
 function layout(){
  if(!locked)return;
  const rect=visiblePlayRect(win,doc.fullscreenElement===root),signature=JSON.stringify(rect);
  if(signature===lastRect)return;
  if(lastRect)onCancel();lastRect=signature;
  for(const [key,value] of Object.entries(rect))root.style.setProperty(`--play-${key}`,`${value}px`);
  onResize();
 }
 function sync(){
  const active=root.classList.contains('touch-mode')&&(root.classList.contains('expanded')||doc.fullscreenElement===root);
  if(active&&!locked){
   savedX=win.scrollX;savedY=win.scrollY;locked=true;
   // Keep body in normal flow: a fixed body can retain pre-rotation iOS hit coordinates.
   win.scrollTo(0,0);
   doc.documentElement.classList.add('touch-play-locked');
  }else if(!active&&locked){
   locked=false;lastRect='';onCancel();
   doc.documentElement.classList.remove('touch-play-locked');doc.documentElement.style.removeProperty('--touch-page-top');
   dimensions.forEach(key=>root.style.removeProperty(key));win.scrollTo(savedX,savedY);onResize();
  }
  layout();
 }
 const guard=event=>{
  const touchMode=root.classList.contains('touch-mode');
  const multiTouch=touchMode&&locked&&event.touches?.length>1&&!event.target?.closest?.('dialog');
  if((multiTouch||cancelPlayGesture(event.type,event.target,{touchMode,locked}))&&event.cancelable)event.preventDefault();
 };
 const types=['touchstart','touchmove','touchend','gesturestart','gesturechange','dblclick'];
 types.forEach(type=>root.addEventListener(type,guard,{passive:false}));
 let orientationFrame;
 const orientation=()=>{
  onCancel();if(locked)win.scrollTo(0,0);layout();if(locked)onResize();
  if(orientationFrame!==undefined)win.cancelAnimationFrame?.(orientationFrame);
  orientationFrame=win.requestAnimationFrame?.(()=>{orientationFrame=undefined;layout();if(locked)onResize();});
 };
 win.addEventListener('orientationchange',orientation);win.screen?.orientation?.addEventListener('change',orientation);
 win.addEventListener('resize',layout);win.visualViewport?.addEventListener('resize',layout);win.visualViewport?.addEventListener('scroll',layout);
 // The parent can resize after a toolbar/orientation change without another
 // visualViewport event. Refresh the scale against the settled parent box.
 const observer=win.ResizeObserver?new win.ResizeObserver(()=>{if(locked){onCancel();onResize();}}):null;
 observer?.observe(root);
 doc.addEventListener('fullscreenchange',sync);sync();
 return {sync,get locked(){return locked;},dispose(){
  if(orientationFrame!==undefined)win.cancelAnimationFrame?.(orientationFrame);
  win.removeEventListener('orientationchange',orientation);win.screen?.orientation?.removeEventListener('change',orientation);
  observer?.disconnect();root.classList.remove('touch-mode');sync();types.forEach(type=>root.removeEventListener(type,guard));
  win.removeEventListener('resize',layout);win.visualViewport?.removeEventListener('resize',layout);win.visualViewport?.removeEventListener('scroll',layout);doc.removeEventListener('fullscreenchange',sync);
 }};
}
