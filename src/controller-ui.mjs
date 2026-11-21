// UI polling stays active while the game scene is paused or displaying a score.
export function installControllerUI({openMenu, audioUnlock}) {
  let previous=[],armed=false,context=null,lastDirection='',repeatAt=0,padIdentity='';
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -';
  let character=0;
  const hint=document.createElement('p');
  hint.className='controller-ui-hint';
  hint.hidden=true;
  (document.getElementById('play-area')??document.body).append(hint);
  const visible=element=>!element.disabled&&!element.closest('[hidden]')&&element.getClientRects().length>0;
  function tick(now){
    let pad;
    try{pad=Array.from(navigator.getGamepads?.()??[]).find(p=>p?.connected&&p.mapping==='standard');}catch{}
    const identity=pad?pad.index+':'+pad.id:'';
    if(identity!==padIdentity){armed=false;padIdentity=identity;}
    const buttons=pad?.buttons.map(b=>b.pressed||b.value>.45)??[];
    const x=pad?.axes[0]??0,y=pad?.axes[1]??0;
    const direction=buttons[12]||y<-.5?'up':buttons[13]||y>.5?'down':buttons[14]||x<-.5?'left':buttons[15]||x>.5?'right':'';
    const dialogs=Array.from(document.querySelectorAll('dialog[open]'));
    const root=dialogs.at(-1)??null;
    if(root!==context){context=root;armed=false;lastDirection='';}
    const active=document.hasFocus()&&!document.hidden&&!!pad;
    if(!active)armed=false;
    if(active&&!armed&&!direction&&!buttons.some(Boolean))armed=true;
    const edge=i=>armed&&buttons[i]&&!previous[i];
    document.querySelectorAll('.controller-focus').forEach(element=>element.classList.remove('controller-focus'));
    hint.hidden=!active||!root;
    if(active&&armed){
      if(root){
        const controls=Array.from(root.querySelectorAll('button,input,select,a[href],[tabindex="0"]')).filter(visible);
        let target=document.activeElement;
        if(!controls.includes(target)){target=controls[0];target?.focus();}
        const pulse=direction&&(direction!==lastDirection||now>=repeatAt);
        if(pulse){
          repeatAt=now+(direction!==lastDirection?350:140);
          if(target?.matches('input[type="range"]')&&(direction==='left'||direction==='right')){
            direction==='right'?target.stepUp():target.stepDown();
            target.dispatchEvent(new Event('input',{bubbles:true}));
            target.dispatchEvent(new Event('change',{bubbles:true}));
          }else if(target?.matches('input:not([type]),input[type="text"],input[type="password"]')&&(direction==='left'||direction==='right')){
            character=(character+(direction==='right'?1:-1)+alphabet.length)%alphabet.length;
          }else if(controls.length){
            const offset=direction==='up'||direction==='left'?-1:1;
            controls[(controls.indexOf(target)+offset+controls.length)%controls.length].focus();
          }
        }
        document.activeElement?.classList.add('controller-focus');
        const text=target?.matches('input:not([type]),input[type="text"],input[type="password"]');
        hint.textContent=text?'←/→ choose '+alphabet[character]+' · A/Cross add · X/Square delete · ↑/↓ next field · B/Circle back':'D-pad / stick select · A/Cross activate · B/Circle back · Menu close';
        if(text&&(edge(0)||edge(2))){
          target.value=edge(2)?target.value.slice(0,-1):(target.value+alphabet[character]).slice(0,target.maxLength>0?target.maxLength:64);
          target.dispatchEvent(new Event('input',{bubbles:true}));
        }else if(edge(0)){audioUnlock();target?.click();}
        if(edge(1)||edge(9)){
          const cancel=new Event('cancel',{cancelable:true});
          if(root.dispatchEvent(cancel))root.close();
        }
      }else if(edge(9)){audioUnlock();openMenu();}
    }
    lastDirection=direction;previous=buttons;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
