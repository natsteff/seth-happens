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
export class TouchInput {
  style='slider';vertical=0;enabled=false;held=new Map();edges=new Set();movement=new SlidingMovement();
  paintStick(){
    const stick=document.getElementById?.('touch-stick');if(!stick)return;
    stick.style.setProperty('--stick-x',`${this.movement.axis*(stick.getBoundingClientRect().width/2-30)}px`);
    stick.style.setProperty('--stick-y',`${this.style==='stick'?this.vertical*(stick.getBoundingClientRect().height/2-24):0}px`);
    stick.dataset.sprint=String(this.movement.sprint);
    stick.setAttribute('aria-valuenow',String(Math.round(this.movement.axis*100)));
    stick.setAttribute('aria-valuetext',this.movement.direction?`${this.movement.sprint?'Sprinting':'Moving'} ${this.movement.direction<0?'left':'right'}`:'Stopped');
  }
  clear(){this.vertical=0;this.held.clear();this.edges.clear();this.movement.clear();this.paintStick();document.querySelectorAll('[data-touch]').forEach(el=>el.removeAttribute('data-held'));}
  sample(blocked=false){
    if(blocked||!this.enabled){this.clear();return {move:0,jump:false,interact:false,recall:false,pause:false,sprint:false,restart:false};}
    const down=(key)=>[...this.held.values()].includes(key);
    const result={move:(this.style==='default'?0:this.movement.direction)||Number(down('right'))-Number(down('left')),jump:this.edges.has('jump'),interact:this.edges.has('interact'),recall:this.edges.has('recall'),pause:this.edges.has('pause'),sprint:this.style!=='default'&&(this.movement.sprint||down('sprint')),restart:down('restart')};
    this.edges.clear();return result;
  }
  constructor(){
    document.querySelectorAll('[data-touch]').forEach(button=>{
      button.addEventListener('pointerdown',event=>{
        if(!this.enabled)return;
        event.preventDefault();button.setPointerCapture(event.pointerId);
        const action=button.dataset.touch;this.held.set(event.pointerId,action);this.edges.add(action);button.dataset.held='true';
      });
      const release=(event)=>{this.held.delete(event.pointerId);if(![...this.held.values()].includes(button.dataset.touch))button.removeAttribute('data-held');};
      button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
      button.addEventListener('contextmenu',event=>event.preventDefault());
    });
    const stick=document.getElementById?.('touch-stick');
    if(stick){
      const axis=(event)=>{const rect=stick.getBoundingClientRect();let x=(event.clientX-rect.left-rect.width/2)/(rect.width/2-24),y=(event.clientY-rect.top-rect.height/2)/(rect.height/2-24);if(this.style==='stick'){const magnitude=Math.max(1,Math.hypot(x,y));x/=magnitude;y/=magnitude;this.vertical=y;}else this.vertical=0;return x;};
      stick.addEventListener('pointerdown',event=>{if(!this.enabled||this.movement.pointer!==null)return;event.preventDefault();if(this.movement.start(event.pointerId,axis(event))){stick.setPointerCapture(event.pointerId);this.paintStick();}});
      stick.addEventListener('pointermove',event=>{if(this.movement.pointer!==event.pointerId)return;this.movement.move(event.pointerId,axis(event));this.paintStick();});
      for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,event=>{this.movement.release(event.pointerId);if(this.movement.pointer===null)this.vertical=0;this.paintStick();});
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
