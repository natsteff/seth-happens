// Keep desktop hints intact; touch mode names the controls players can use.
export function controlCopy(text,mobile){
 if(!mobile)return text;
 return text
 .replace('P • PAUSE  /  SHIFT • SPRINT  /  B • PHOTO','☰ MENU • PAUSE / RECALL / SETTINGS')
 .replace('P or Resume to continue','Open ☰ menu, then tap Resume to continue')
 .replace('Paused. Press P to resume.','Paused. Open the menu, then tap Resume to continue.')
 .replace('Tap jump • double-tap for Mega Jump • Shift sprint','Jump • double-tap for Mega Jump')
 .replace(/\[ F \]/g,'[ Action ]')
 .replace(/Action \/ F/g,'Action')
 .replace(/Press F|press F/g,'Tap Action')
 .replace(/F at photo signs/g,'Action at photo signs')
 .replace(/Press B to return\./g,'Use Recall missed photo in the menu to return.')
 .replace(/B returns to missed photos/g,'Menu: Recall missed photo')
 .replace(/Hold R or press Restart/g,'Use Restart in the menu')
 .replace(/Hold R for another run\./g,'Open the menu and tap Restart for another run.')
 .replace(/Hold R to question your life choices again\./g,'Menu → Restart to try again.')
 .replace(/ · [PS]$/g,'');
}
