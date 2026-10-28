// Pointer capture allows independent movement, sprint and jump fingers.
export class TouchInput {
  enabled=false;
  held=new Map();
  edges=new Set();
  clear(){this.held.clear();this.edges.clear();document.querySelectorAll('[data-touch]').forEach(el=>el.removeAttribute('data-held'));}
  sample(blocked=false){
    if(blocked||!this.enabled){this.clear();return {move:0,jump:false,interact:false,recall:false,pause:false,sprint:false,restart:false};}
    const down=(key)=>[...this.held.values()].includes(key);
    const result={move:Number(down('right'))-Number(down('left')),jump:this.edges.has('jump'),interact:this.edges.has('interact'),recall:this.edges.has('recall'),pause:this.edges.has('pause'),sprint:down('sprint'),restart:down('restart')};
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
    window.addEventListener('blur',()=>this.clear());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});
  }
}
export const touch=new TouchInput();
