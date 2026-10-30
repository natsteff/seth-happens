export const MOBILE_SETUP_KEY='seth-happens.mobile-setup.v1';
const modes=['touch','keyboard'];
const valid=value=>value&&value.version===1&&modes.includes(value.mode);
export function standaloneLaunch(win){
 return win.navigator?.standalone===true||win.matchMedia?.('(display-mode: standalone)')?.matches===true;
}
export function readMobileSetup(storage){
 try{
  const raw=storage?.getItem(MOBILE_SETUP_KEY);
  if(raw!==null&&raw!==undefined){const value=JSON.parse(raw);return valid(value)?{mode:value.mode,legacy:false}:null;}
  // Only an explicitly saved control style is evidence of prior setup.
  const controls=JSON.parse(storage?.getItem('seth-touch-controls')??'null');
  return controls&&['default','slider','stick'].includes(controls.style)?{mode:'touch',legacy:true}:null;
 }catch{return null;}
}
export function saveMobileSetup(storage,mode){
 if(!modes.includes(mode))return false;
 try{
  const raw=storage?.getItem(MOBILE_SETUP_KEY);
  if(raw!==null&&raw!==undefined&&!valid(JSON.parse(raw)))return false;
  if(!storage)return false;
  storage.setItem(MOBILE_SETUP_KEY,JSON.stringify({version:1,mode}));return true;
 }catch{return false;}
}
export function mobileStartup({touchCapable,setup}){
 return {showOffer:touchCapable&&!setup,touchEnabled:touchCapable&&setup?.mode==='touch'};
}
