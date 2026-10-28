export const ROUTE_OFFSET = 200;
export const LEVEL_WIDTH = 7450;
export const GROUND_Y = 2700;
export const FLOOR_RISE = 76;
export const ROAD = { floor:0, x:0, y:GROUND_Y+FLOOR_RISE, width:LEVEL_WIDTH };
// Index matches floor number; zero is the road, exactly 26 actual rooftops.
export const floors = [ROAD, ...Array.from({length:26},(_,index)=>{
  const floor=index+1;
  return {floor,x:ROUTE_OFFSET+index*280,y:GROUND_Y-index*FLOOR_RISE,width:floor===26?250:240};
})];
export const photoStops = [
  {floor:6,x:floors[6].x+110,y:floors[6].y-30,title:'LOON ZONE',caption:'Caught the ball. With a camera. Much safer.',short:'Soccer'},
  {floor:17,x:floors[17].x+110,y:floors[17].y-30,title:'ROOFTOP ENCORE',caption:'ISO 6400. Dignity 0. Still got the shot.',short:'Concert'},
];
export const beerSpot={floor:12,x:floors[12].x+115,y:floors[12].y-28};
export function missing(beer, photos) { return `${beer ? '✓' : '○'} six-pack   •   ${photos.size}/2 photos`; }
export function missedPhotos(x, photos) { return photoStops.flatMap((stop, i) => x > stop.x + 115 && !photos.has(i) ? [i] : []); }
export function photoIndicator(x, photos) {
  return photoStops.map((stop, i) => photos.has(i) ? `✓ ${stop.short}` : x > stop.x + 115 ? `! MISSED ${stop.short} ←` : `○ ${stop.short} →`).join('     ');
}

export function objectImpactReaction(randomValue) { return randomValue < 0.5 ? 'ouch' : 'ahh'; }

export function runScore(beer, photos, mishaps, latePhotos = new Set()) {
  const photoPoints = photoStops.reduce((points, _, i) => points + (photos.has(i) ? (latePhotos.has(i) ? 125 : 250) : 0), 0);
  return Math.max(0, 1000 + photoPoints + (beer ? 500 : 0)
    - 10 * (mishaps.falls + mishaps.squishes + mishaps.bumps));
}
export function recordMishap(mishaps, reaction) {
  const key = reaction === 'fall' ? 'falls' : reaction === 'squish' ? 'squishes' : 'bumps';
  return { ...mishaps, [key]: mishaps[key] + 1 };
}
export const RESTART_HOLD_MS = 650;

export const fallingAssignments = [[7,'piano'],[14,'anvil'],[20,'ac'],[23,'cooler']];

export const RUN_LIMIT_MS=120000;
export const SPRINT_SPEED=385;
export function timeBonus(elapsedMs){return Math.max(0,120-Math.ceil(Math.max(0,elapsedMs)/1000))*100;}
export function finalScore(beer,photos,mishaps,latePhotos,elapsedMs,cheater=false){
  return cheater?-10000:runScore(beer,photos,mishaps,latePhotos)+timeBonus(elapsedMs);
}
export function roadLandingIsFall(departureFloor){return departureFloor>=2;}
export const dropProfiles={
  piano:{warning:300,fall:430,landed:600,pause:350},
  anvil:{warning:180,fall:280,landed:800,pause:250},
  ac:{warning:260,fall:520,landed:650,pause:160},
  cooler:{warning:200,fall:380,landed:700,pause:420},
};
export function fallingStep(state,time,nearby,kind){
  const p=dropProfiles[kind],cycle=p.warning+p.fall+p.landed+p.pause;
  let next=state;
  if(nearby&&time>=state.readyAt)next={startedAt:time,readyAt:time+cycle,serial:state.serial+1};
  const elapsed=time-next.startedAt;
  const warning=elapsed>=0&&elapsed<p.warning;
  const dropping=elapsed>=p.warning&&elapsed<p.warning+p.fall;
  const landed=elapsed>=p.warning+p.fall&&elapsed<p.warning+p.fall+p.landed;
  return {...next,warning,dropping,landed,offset:dropping?-230+230*((elapsed-p.warning)/p.fall)**2:landed?0:-230};
}
export function patrolX(floor,time,phase,speed=85){
  const left=floor.x+24,right=floor.x+floor.width-24,span=right-left;
  const distance=((time/1000*speed+phase)%(span*2)+span*2)%(span*2);
  return left+(distance<=span?distance:span*2-distance);
}
export const EGG={guitarX:LEVEL_WIDTH-590,ampX:LEVEL_WIDTH-480,ballX:LEVEL_WIDTH-355,goalX:LEVEL_WIDTH-190,elevatorX:LEVEL_WIDTH-78};

export function fallingPose(floor,bottom,velocityY){
  return velocityY>120&&bottom>floors[floor].y+12;
}
export function fallDecision(floor,bottom,velocityY,x){
  const dropping=floor>=2&&velocityY>120;
  // Stay silent while any lower roof remains reachable, even with a direction change.
  // After missing them, start audio near departure rather than waiting for ground level.
  const reachable=Number.isFinite(x)&&floors.slice(1).some(roof=>{
    if(roof.y<bottom)return false;
    const seconds=(-velocityY+Math.sqrt(velocityY**2+2*1050*(roof.y-bottom)))/1050;
    const reach=SPRINT_SPEED*seconds+12;
    return x+reach>=roof.x&&x-reach<=roof.x+roof.width;
  });
  return {scream:dropping&&bottom>floors[floor].y+12&&!reachable,
    retry:dropping&&bottom>GROUND_Y+60};
}
export function timerWarningSecond(elapsedMs){
  const remaining=Math.max(0,Math.ceil((RUN_LIMIT_MS-elapsedMs)/1000));
  return remaining>0&&remaining<=30?remaining:null;
}
export function runExpired(elapsedMs){return elapsedMs>=RUN_LIMIT_MS;}

export const MEGA_TAP_MS=300;
export const REGULAR_JUMP_SPEED=490;
export const MEGA_JUMP_SPEED=650;
// Add only the extra launch energy, so a later second tap cannot create a higher jump.
export function megaJumpVelocity(sinceFirstMs,velocityY){
  if(sinceFirstMs<=0||sinceFirstMs>MEGA_TAP_MS||velocityY>=0)return null;
  return -Math.sqrt(velocityY**2+MEGA_JUMP_SPEED**2-REGULAR_JUMP_SPEED**2);
}
export function countdownLabel(elapsedMs){
  const seconds=Math.max(0,Math.ceil((RUN_LIMIT_MS-elapsedMs)/1000));
  return `${seconds}s`;
}

export function fallingObjectHurts(motion){return motion.dropping===true;}

export function fallingObjectSolid(motion){return motion?.landed===true;}

export function formatRunSeconds(elapsedMs){return `${(Math.max(0,elapsedMs)/1000).toFixed(1)} seconds`;}
