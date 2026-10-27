export const PREFERENCES_KEY='seth-happens.preferences.v1';
export const preferenceDefaults={track:0,countdownTrack:0,championTrack:0,volume:.75,musicEnabled:true,muted:false};
function valid(key,value){
 if(['track','countdownTrack','championTrack'].includes(key))return Number.isInteger(value)&&value>=0&&value<(key==='track'?5:2);
 if(key==='volume')return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
 return typeof value==='boolean';
}
export function readPreferences(storage){
 try{const raw=storage.getItem(PREFERENCES_KEY);if(!raw)return {...preferenceDefaults};const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))return {...preferenceDefaults};
 return Object.fromEntries(Object.entries(preferenceDefaults).map(([key,fallback])=>[key,valid(key,value[key])?value[key]:fallback]));}catch{return {...preferenceDefaults};}
}
export function savePreferences(storage,patch){
 try{const raw=storage.getItem(PREFERENCES_KEY);if(raw){const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))return false;}
 const next=readPreferences(storage);for(const key of Object.keys(preferenceDefaults))if(valid(key,patch[key]))next[key]=patch[key];storage.setItem(PREFERENCES_KEY,JSON.stringify(next));return true;}catch{return false;}
}
function browserStorage(){try{return localStorage;}catch{return null;}}
export function loadSettings(){return readPreferences(browserStorage());}
export function saveSettings(patch){return savePreferences(browserStorage(),patch);}
