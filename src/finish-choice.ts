import {installOpeningGuard} from './dialog-input.mjs';
const dialog=document.createElement('dialog');dialog.className='finish-choice';dialog.setAttribute('aria-labelledby','finish-choice-title');
dialog.innerHTML='<h2 id="finish-choice-title">Missing photos</h2><p>You can finish with the beer now, or return for your earliest missed photo.</p><button data-choice="finish">Deliver beer &amp; finish</button><button data-choice="recall">Recall missed photo</button><button data-choice="cancel">Keep playing</button>';
document.getElementById('play-area')!.append(dialog);
const guard=installOpeningGuard(dialog);
let complete:((choice:string)=>void)|null=null;
export const finishChoiceOpen=()=>dialog.open;
function close(choice:string){dialog.close();const callback=complete;complete=null;callback?.(choice);}
export function askFinishChoice(callback:(choice:string)=>void){if(dialog.open)return;complete=callback;dialog.showModal();(dialog.querySelector('[data-choice="cancel"]') as HTMLButtonElement).focus();guard.arm();}
export function resetFinishChoice(){complete=null;if(dialog.open)dialog.close();}
dialog.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(button=>button.addEventListener('click',()=>close(button.dataset.choice!)));
dialog.addEventListener('cancel',event=>{event.preventDefault();close('cancel');});
for(const type of ['keydown','keyup'])dialog.addEventListener(type,event=>event.stopPropagation());
