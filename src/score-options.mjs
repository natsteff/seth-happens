export const PLAYER_NAME_KEY='seth-happens.player-name.v1';
export function savedPlayerName(storage){try{const name=JSON.parse(storage?.getItem(PLAYER_NAME_KEY)??'null');return typeof name==='string'&&name.trim()&&name.length<=16?name.trim():'';}catch{return '';}}
export function rememberPlayerName(storage,name){try{if(typeof name!=='string'||!name.trim()||name.trim().length>16)return false;storage?.setItem(PLAYER_NAME_KEY,JSON.stringify(name.trim()));return !!storage;}catch{return false;}}
export function clearPasswordRequired(hostname,scope,config={},serverRequired=true){
 if(scope==='server')return serverRequired;
 const host=hostname.toLowerCase();
 if(host.endsWith('.github.io'))return false;
 return config.clearPasswordRequired!==false;
}
export function fitScoreDialog(dialog,win=window){
 const v=win.visualViewport;
 for(const [key,value] of Object.entries({left:v?.offsetLeft??0,top:v?.offsetTop??0,width:v?.width??win.innerWidth,height:v?.height??win.innerHeight}))dialog.style.setProperty(`--score-${key}`,`${value}px`);
}
