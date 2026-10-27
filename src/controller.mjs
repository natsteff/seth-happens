// Standard browser Gamepad mapping. Keyboard input remains independent and takes precedence.
export class ControllerInput {
  index=null;id='';armed=false;previous=[];
  sample(pads=[],enabled=true){
    const available=Array.from(pads).filter(p=>p?.connected&&p.mapping==='standard');
    const pad=available.find(p=>p.index===this.index&&p.id===this.id)??available[0];
    const changed=this.index!==null&&(!pad||pad.index!==this.index||pad.id!==this.id);
    const fresh=!!pad&&(pad.index!==this.index||pad.id!==this.id);
    const result={move:0,jump:false,interact:false,recall:false,pause:false,sprint:false,connected:!!pad,disconnected:changed,label:pad?'Controller connected · keyboard still active':'Keyboard · pair a controller, then press a button'};
    if(!pad){this.index=null;this.id='';this.armed=false;this.previous=[];return result;}
    const pressed=pad.buttons.map(b=>b.pressed||b.value>.45);
    const axis=Number.isFinite(pad.axes[0])?pad.axes[0]:0;
    const move=pressed[14]?-1:pressed[15]?1:Math.abs(axis)>.25?Math.sign(axis):0;
    if(fresh){this.index=pad.index;this.id=pad.id;this.armed=false;}
    if(!enabled){this.armed=false;this.previous=pressed;return result;}
    if(!this.armed){if(!move&&!pressed.some(Boolean))this.armed=true;this.previous=pressed;return result;}
    const edge=i=>!!pressed[i]&&!this.previous[i];
    Object.assign(result,{move,jump:edge(0),interact:edge(2),recall:edge(1),pause:edge(9),sprint:!!pressed[7]});
    this.previous=pressed;return result;
  }
}
export function keyboardOrControllerMove(left,right,controllerMove){
  return left||right?Number(right)-Number(left):controllerMove;
}
