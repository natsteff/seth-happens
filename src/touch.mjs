// Horizontal movement uses a center dead zone and hysteresis at the sprint edge.
export class SlidingMovement {
  pointer=null;axis=0;sprint=false;
  start(pointer,axis){if(this.pointer!==null)return false;this.pointer=pointer;this.move(pointer,axis);return true;}
  move(pointer,axis){
    if(pointer!==this.pointer)return;
    this.axis=Math.max(-1,Math.min(1,Number.isFinite(axis)?axis:0));
    const magnitude=Math.abs(this.axis);
    this.sprint=magnitude>=(this.sprint?.62:.8);
  }
  release(pointer){if(pointer===this.pointer)this.clear();}
  clear(){this.pointer=null;this.axis=0;this.sprint=false;}
  get direction(){return Math.abs(this.axis)<=.18?0:Math.sign(this.axis);}
}
// A short, released tap followed by the same arrow within 250ms.
export class QuickSprint {
 pointer=null;direction=null;started=0;lastTap=null;active=false;
 press(pointer,direction,time){
  if(this.pointer!==null){this.clear();return;}
  this.active=this.lastTap?.direction===direction&&time>=this.lastTap.time&&time-this.lastTap.time<=250;
  this.lastTap=null;this.pointer=pointer;this.direction=direction;this.started=time;
 }
 release(pointer,time,cancelled=false){
  if(pointer!==this.pointer)return;
  const tap=!cancelled&&!this.active&&time>=this.started&&time-this.started<=200;
  this.lastTap=tap?{direction:this.direction,time:this.started}:null;
  this.pointer=null;this.direction=null;this.active=false;
 }
 clear(){this.pointer=null;this.direction=null;this.lastTap=null;this.active=false;}
}
export class TouchInput {
  quickSprintEnabled=false;quickSprint=new QuickSprint();
  style='slider';vertical=0;enabled=false;captures=new Map();held=new Map();edges=new Set();movement=new SlidingMovement();
  paintStick(){
    const stick=document.getElementById?.('touch-stick');if(!stick)return;
    stick.style.setProperty('--stick-x',`${this.movement.axis*(stick.getBoundingClientRect().width/2-30)}px`);
    stick.style.setProperty('--stick-y',`${this.style==='stick'?this.vertical*(stick.getBoundingClientRect().height/2-24):0}px`);
    stick.dataset.sprint=String(this.movement.sprint);
    stick.setAttribute('aria-valuenow',String(Math.round(this.movement.axis*100)));
    stick.setAttribute('aria-valuetext',this.movement.direction?`${this.movement.sprint?'Sprinting':'Moving'} ${this.movement.direction<0?'left':'right'}`:'Stopped');
  }
  paintSprint(){const arrows=document.getElementById?.('touch-arrows');if(arrows)arrows.dataset.sprint=String(this.quickSprint.active);}
  clear(){
    const captures=[...this.captures];this.captures.clear();
    for(const [pointer,element] of captures){try{if(element.hasPointerCapture?.(pointer))element.releasePointerCapture(pointer);}catch{/* Rotation may already have invalidated this pointer. */}}
    this.quickSprint.clear();this.paintSprint();this.vertical=0;this.held.clear();this.edges.clear();this.movement.clear();this.paintStick();document.querySelectorAll('[data-touch]').forEach(el=>el.removeAttribute('data-held'));}
  sample(blocked=false){
    if(blocked||!this.enabled){this.clear();return {move:0,jump:false,interact:false,recall:false,pause:false,sprint:false,restart:false};}
    const down=(key)=>[...this.held.values()].includes(key);
    const result={move:(this.style==='default'?0:this.movement.direction)||Number(down('right'))-Number(down('left')),jump:this.edges.has('jump'),interact:this.edges.has('interact'),recall:this.edges.has('recall'),pause:this.edges.has('pause'),sprint:this.style==='default'?this.quickSprintEnabled&&this.quickSprint.active&&(down('left')!==down('right')):this.movement.sprint||down('sprint'),restart:down('restart')};
    this.edges.clear();return result;
  }
  constructor(){
    document.querySelectorAll('[data-touch]').forEach(button=>{
      button.addEventListener('pointerdown',event=>{
        if(!this.enabled)return;
        event.preventDefault();button.setPointerCapture(event.pointerId);this.captures.set(event.pointerId,button);
        const action=button.dataset.touch;if(this.style==='default'&&this.quickSprintEnabled&&['left','right'].includes(action)){this.quickSprint.press(event.pointerId,action,event.timeStamp);this.paintSprint();}this.held.set(event.pointerId,action);this.edges.add(action);button.dataset.held='true';
      });
      const release=(event)=>{this.captures.delete(event.pointerId);this.quickSprint.release(event.pointerId,event.timeStamp,event.type!=='pointerup');this.paintSprint();this.held.delete(event.pointerId);if(![...this.held.values()].includes(button.dataset.touch))button.removeAttribute('data-held');};
      button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
      button.addEventListener('contextmenu',event=>event.preventDefault());
    });
    const stick=document.getElementById?.('touch-stick');
    if(stick){
      const axis=(event)=>{const rect=stick.getBoundingClientRect();let x=(event.clientX-rect.left-rect.width/2)/(rect.width/2-24),y=(event.clientY-rect.top-rect.height/2)/(rect.height/2-24);if(this.style==='stick'){const magnitude=Math.max(1,Math.hypot(x,y));x/=magnitude;y/=magnitude;this.vertical=y;}else this.vertical=0;return x;};
      stick.addEventListener('pointerdown',event=>{if(!this.enabled||this.movement.pointer!==null)return;event.preventDefault();if(this.movement.start(event.pointerId,axis(event))){stick.setPointerCapture(event.pointerId);this.captures.set(event.pointerId,stick);this.paintStick();}});
      stick.addEventListener('pointermove',event=>{if(this.movement.pointer!==event.pointerId)return;this.movement.move(event.pointerId,axis(event));this.paintStick();});
      for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,event=>{this.captures.delete(event.pointerId);this.movement.release(event.pointerId);if(this.movement.pointer===null)this.vertical=0;this.paintStick();});
      stick.addEventListener('contextmenu',event=>event.preventDefault());
      stick.addEventListener('keydown',event=>{if(this.enabled&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();this.movement.start('keyboard',event.key==='ArrowLeft'?-1:1);this.movement.move('keyboard',event.key==='ArrowLeft'?-1:1);this.paintStick();}});
      stick.addEventListener('keyup',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){this.movement.release('keyboard');this.paintStick();}});
      stick.addEventListener('blur',()=>{this.movement.clear();this.paintStick();});
    }
    window.addEventListener('blur',()=>this.clear());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});
  }
}
export const touch=new TouchInput();
