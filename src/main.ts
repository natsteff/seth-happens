import Phaser from 'phaser';
import { ControllerInput, keyboardOrControllerMove } from './controller.mjs';
import './style.css';
import { touch } from './touch.mjs';
import { installTouchViewport } from './touch-viewport.mjs';
import './radio';
import { offerScore, scoresOpen, resetScoreEntry } from './scoreboard';
import { impactEffects } from './impact-effects';
import { gameAudio } from './audio';
import { soccerBall, steelKeg, sixPack } from './props';
import { walkLayout, fallLayout } from './art-layout';
import { REGULAR_JUMP_SPEED, megaJumpVelocity, countdownLabel, fallingPose, timerWarningSecond, fallDecision, runExpired, RUN_LIMIT_MS, SPRINT_SPEED, timeBonus, finalScore, roadLandingIsFall, fallingStep, fallingObjectHurts, fallingObjectSolid, patrolX, EGG, fallingAssignments, floors, photoStops, beerSpot, recordMishap, RESTART_HOLD_MS, missing, missedPhotos, photoIndicator, LEVEL_WIDTH, GROUND_Y, ROAD, FLOOR_RISE, objectImpactReaction } from './mission.mjs';

const W = 1100, H = 600;
// Render at display density, retaining the same logical play area and physics.
const RENDER_SCALE = Math.min(3, Math.max(1, Math.ceil(
  Math.min(screen.width / W, screen.height / H) * window.devicePixelRatio)));

type HazardKind = 'keg' | 'ball' | 'piano' | 'anvil' | 'ac' | 'cooler' | 'partier' | 'clown' | 'cone' | 'pigeon' | 'suitcase';
type Hazard = { kind: HazardKind; floor: number; x: number; y: number; art: Phaser.GameObjects.Container; body: Phaser.Physics.Arcade.Image; warning?: Phaser.GameObjects.Text; phase: number; dropCycle?: number; piano?: {startedAt:number;readyAt:number;serial:number;dropping?:boolean;landed?:boolean;warning?:boolean}; nextHonk?: number; impacted?:number };
const isFalling=(kind:string)=>['piano','anvil','ac','cooler'].includes(kind);
class Errand extends Phaser.Scene {
  sharpObjects=new WeakSet<Phaser.GameObjects.GameObject>();
  player!: Phaser.Physics.Arcade.Sprite;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  controller=new ControllerInput();pad={move:0,jump:false,interact:false,recall:false,pause:false,sprint:false};
  latePhotos = new Set<number>();
  photos = new Set<number>(); warned = new Set<number>(); beer = false; won = false; retries = 0;
  hud!: Phaser.GameObjects.Text; toast!: Phaser.GameObjects.Text; prompt!: Phaser.GameObjects.Text; photoHud!: Phaser.GameObjects.Text;
  progress!: Phaser.GameObjects.Rectangle;
  crate!: Phaser.GameObjects.Container; hero!: Phaser.GameObjects.Container; portrait!: Phaser.GameObjects.Sprite;
  elapsedMs=0;failed=false;cheater=false;riding=false;rideTween?:Phaser.Tweens.Tween;
  jumpStarted=-1;megaUsed=false;jumpCount=0;
  paused=false;pauseStarted=0;pauseOverlay!:Phaser.GameObjects.Container;
  timerText!:Phaser.GameObjects.Text;
  eggStage=0;eggPreviousX=75;eggBall!:Phaser.GameObjects.Container;eggLift!:Phaser.GameObjects.Container;
  eggLabel!:Phaser.GameObjects.Text;liftHint!:Phaser.GameObjects.Text;eggBlocks:Phaser.GameObjects.Rectangle[]=[];
  scorePaused=false;
  onRoad=true;beerHint!:Phaser.GameObjects.Text;
  mishaps={falls:0,squishes:0,bumps:0}; restartSince:number|null=null;touchRestartSince:number|null=null;
  fallSoundPlayed=false;lastTimerBeep=0;
  heroHeard=false;heroPlaying=false;runVersion=0;
  introActive=true;introStarted=false;introOverlay!:Phaser.GameObjects.Container;introCaption!:Phaser.GameObjects.Text;
  failurePhase='none';timeoutAngel?:Phaser.GameObjects.Sprite;
  heardLocations=new Set<string>();
  visitedWalkFrames=new Set<string>();
  hazards: Hazard[] = []; floor = 0; checkpoint = {x:75,y:ROAD.y-24};
  lastGround = -1000; jumpUntil = 0; immuneUntil = 0; facing = 1; walking = false;
  preload(){
    this.load.image('seth-timeout','./assets/seth-timeout-v1.png');
    this.load.spritesheet('seth-walk','./assets/seth-walk.png',walkLayout);
    this.load.spritesheet('seth-fall','./assets/seth-fall-v1.png',fallLayout);
    this.load.spritesheet('seth-carry-directions','./assets/seth-carry-directions-v1.png',walkLayout);
    this.load.spritesheet('seth-fall-carry-directions','./assets/seth-fall-carry-directions-v1.png',fallLayout);
    this.load.image('allison','./assets/allison.png');
    this.load.image('beer-pickup','./assets/beer-pickup.png');
    this.load.image('title-logo','./assets/title-logo.png');
    this.load.image('clown','./assets/clown.png');
    this.load.image('scruffy','./assets/scruffy-pedestrian.png');
    this.load.image('soccer-star','./assets/soccer-star.png');
    this.load.image('concert-fans','./assets/concert-fans.png');
    this.load.image('loons-logo','./assets/minnesota-united-user-supplied.png');
    this.load.image('cats','./assets/cats.png');
  }
  create() {
    touch.clear();(document.getElementById('touch-menu') as HTMLDialogElement).close();(document.getElementById('touch-menu-open') as HTMLButtonElement).disabled=true;resetScoreEntry();this.scorePaused=false;this.controller=new ControllerInput();
    this.input.keyboard!.enabled=true;
    this.elapsedMs=0;this.lastTimerBeep=0;this.failed=false;this.cheater=false;this.riding=false;this.rideTween=undefined;
    this.jumpStarted=-1;this.megaUsed=false;this.jumpCount=0;this.paused=false;this.eggStage=0;this.eggPreviousX=75;this.eggBlocks=[];
    this.mishaps={falls:0,squishes:0,bumps:0};this.restartSince=null;this.touchRestartSince=null;
    this.runVersion++;this.onRoad=true;this.fallSoundPlayed=false;this.heroHeard=false;this.heroPlaying=false;
    gameAudio.beginRun();this.introActive=true;this.introStarted=false;
    this.latePhotos = new Set();
    this.photos = new Set(); this.warned = new Set(); this.beer = false; this.won = false; this.retries = 0; this.hazards=[];this.heardLocations=new Set();this.visitedWalkFrames=new Set();this.failurePhase='none';this.timeoutAngel=undefined;
    this.lastGround=-1000; this.jumpUntil=0; this.immuneUntil=0; this.floor=0; this.facing=1;
    this.checkpoint={x:75,y:ROAD.y-24};
    this.cameras.main.setZoom(RENDER_SCALE);
    this.cameras.main.setBackgroundColor('#172b45');
    this.drawCity();
    if(!this.textures.exists('body')){
      const tex=this.add.graphics();tex.fillStyle(0xffffff).fillRect(0,0,26,48);tex.generateTexture('body',26,48);tex.destroy();
    }
    const platforms=this.physics.add.staticGroup();
    const roadBody=this.add.rectangle(ROAD.width/2,ROAD.y+65,ROAD.width,130,0x263241,0);
    platforms.add(roadBody);
    this.label(12,ROAD.y+76,'ROAD • START HERE','#e9d2a0',12);
    this.label(12,ROAD.y+98,'Jump onto floor 01 →','#aec3d0',10);
    for(const f of floors.slice(1)){
      const facadeHeight=f.floor===1?ROAD.y-f.y:Math.max(14,Math.min(132,ROAD.y-f.y-86));
      this.add.rectangle(f.x+f.width/2,f.y+facadeHeight/2,f.width,facadeHeight,0x344b61).setStrokeStyle(2,0x607d91);
      const ledge=this.add.rectangle(f.x+f.width/2,f.y+4,f.width,8,0x78dbc3,0);
      platforms.add(ledge);
      const ledgeBody=ledge.body as Phaser.Physics.Arcade.StaticBody;
      ledgeBody.checkCollision.down=false;ledgeBody.checkCollision.left=false;ledgeBody.checkCollision.right=false;
      if(f.floor===1){
        const wall=this.add.rectangle(f.x+f.width/2,f.y+8+(facadeHeight-8)/2,f.width,facadeHeight-8,0x344b61,0);
        platforms.add(wall);(wall.body as Phaser.Physics.Arcade.StaticBody).checkCollision.up=false;
      }
      this.add.rectangle(f.x+f.width/2,f.y+4,f.width,8,f.floor===26?0xffcc7b:0x78dbc3);
      for(let xx=f.x+22;facadeHeight>40&&xx<f.x+f.width-10;xx+=42) this.add.rectangle(xx,f.y+43,16,25,0xffce85,.35);
      this.label(f.x+13,f.y+Math.min(76,Math.max(12,facadeHeight-45)),`FLOOR ${String(f.floor).padStart(2,'0')}`, '#bdd2dc',14);
    }
    const cats=this.textures.get('cats');
    if(!cats.has('oakey'))cats.add('oakey',0,27,146,564,964);
    if(!cats.has('ellowyn'))cats.add('ellowyn',0,634,469,614,562);
    this.decorateLevel();
    this.player=this.physics.add.sprite(75,ROAD.y-24,'body').setVisible(false).setMaxVelocity(SPRINT_SPEED,850);
    this.physics.add.collider(this.player,platforms);
    this.buildEgg();
    const timeoutTexture=this.textures.get('seth-timeout');
    for(let frame=0;frame<4;frame++){timeoutTexture.add(`ground-${frame}`,0,frame*384,0,384,455);timeoutTexture.add(`angel-${frame}`,0,frame*384,455,384,569);}
    if(!this.anims.exists('timeout-angel'))this.anims.create({key:'timeout-angel',frames:[0,1,2,3].map(frame=>({key:'seth-timeout',frame:`angel-${frame}`})),frameRate:7,repeat:-1});
    this.hero=this.add.container(this.player.x,this.player.y);
    // Sharpen Seth alone; preserve smoothing for scenery, UI and other characters.
    for(const key of ['seth-walk','seth-fall','seth-carry-directions','seth-fall-carry-directions'])this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.portrait=this.add.sprite(0,24,'seth-walk',1).setOrigin(.5,1).setDisplaySize(62,82);
    for(const [key,frames] of [['walk-empty',[0,1,2,3]],['walk-beer',[4,5,6,7]]] as const){
      if(!this.anims.exists(key))this.anims.create({key,frames:frames.map(frame=>({key:'seth-walk',frame})),frameRate:8,repeat:-1});
    }
    for(const [key,frames] of [['fall-empty',[0,1,2,3]],['fall-beer',[4,5,6,7]]] as const){
      if(!this.anims.exists(key))this.anims.create({key,frames:frames.map(frame=>({key:'seth-fall',frame})),frameRate:9,repeat:-1});
    }
    for(const [key,texture,frames] of [
      ['walk-beer-right','seth-carry-directions',[0,1,2,3]],['walk-beer-left','seth-carry-directions',[4,5,6,7]],
      ['fall-beer-right','seth-fall-carry-directions',[0,1,2,3]],['fall-beer-left','seth-fall-carry-directions',[4,5,6,7]]
    ] as const){if(!this.anims.exists(key))this.anims.create({key,frames:frames.map(frame=>({key:texture,frame})),frameRate:key.startsWith('fall')?9:8,repeat:-1});}
    this.hero.add(this.portrait).setDepth(5);
    this.physics.world.setBounds(0,0,LEVEL_WIDTH,GROUND_Y+800);
    this.cameras.main.setBounds(0,300,LEVEL_WIDTH,GROUND_Y+240-300);
    this.cameras.main.startFollow(this.player,true,.12,.12,-120,90);
    this.keys=this.input.keyboard!.addKeys('A,D,W,LEFT,RIGHT,UP,SPACE,F,R,B,S,SHIFT,P') as Record<string,Phaser.Input.Keyboard.Key>;
    const onBlur=()=>{touch.clear();this.player.setVelocityX(0);for(const key of Object.values(this.keys))key.reset();if(!this.paused)this.togglePause();};
    const onRadioFocus=()=>{for(const key of Object.values(this.keys))key.reset();this.player.setVelocityX(0);};
    const radioVolume=document.getElementById('radio-volume')!;radioVolume.addEventListener('focus',onRadioFocus);
    this.events.once('shutdown',()=>radioVolume.removeEventListener('focus',onRadioFocus));
    const onHidden=()=>{if(document.hidden)onBlur();};document.addEventListener('visibilitychange',onHidden);this.events.once('shutdown',()=>document.removeEventListener('visibilitychange',onHidden));
    window.addEventListener('blur',onBlur);this.events.once('shutdown',()=>window.removeEventListener('blur',onBlur));
    this.input.keyboard!.addCapture(['SPACE','UP','DOWN','LEFT','RIGHT']);
    const pauseButton=document.getElementById('pause-toggle') as HTMLButtonElement;
    pauseButton.textContent='Pause · P';pauseButton.setAttribute('aria-pressed','false');
    const restartButton=document.getElementById('restart-run') as HTMLButtonElement;
    restartButton.disabled=true;restartButton.onclick=()=>{restartButton.blur();this.scene.restart();};
    pauseButton.disabled=true;pauseButton.onclick=()=>{this.togglePause();pauseButton.blur();};
    this.input.keyboard!.on('keydown',(event:KeyboardEvent)=>{if(scoresOpen()||this.paused||event.code==='KeyP')return;if(this.introActive){void gameAudio.unlock();void this.startIntro();}else void gameAudio.unlock();});
    this.input.on('pointerdown',()=>{if(this.paused)return;if(this.introActive){void gameAudio.unlock();void this.startIntro();}else void gameAudio.unlock();});
    const pattern: [number,HazardKind][] = [[2,'keg'],[3,'partier'],[4,'ball'],[5,'pigeon'],[8,'keg'],[9,'clown'],[10,'ball'],[11,'partier'],[13,'suitcase'],[15,'ball'],[16,'cone'],[18,'clown'],[19,'keg'],[21,'pigeon'],[22,'suitcase'],[24,'ball'],[25,'partier']];
    pattern.push(...fallingAssignments as [number,HazardKind][]);
    pattern.forEach(([floor,kind])=>this.addHazard(floor,kind));
    this.add.rectangle(W/2,42,W,84,0x101e32,.97).setScrollFactor(0).setDepth(10);
    this.timerText=this.label(900,7,'3:00','#ffd08b',32).setScrollFactor(0).setDepth(12);
    this.label(902,43,'TIME LEFT','#d0b58e',9).setScrollFactor(0).setDepth(12);
    this.hud=this.label(20,13,'','#eaf3f1',16).setScrollFactor(0).setDepth(11);
    this.photoHud=this.label(20,47,'','#80e5ce',15).setScrollFactor(0).setDepth(11);
    this.label(620,51,'P • PAUSE  /  SHIFT • SPRINT  /  B • PHOTO','#ffcf8a',10).setScrollFactor(0).setDepth(11);
    this.label(1064,4,'26F','#b7d4d8',9).setOrigin(.5,0).setScrollFactor(0).setDepth(12);
    this.label(1064,68,'0F','#b7d4d8',9).setOrigin(.5,0).setScrollFactor(0).setDepth(12);
    this.add.rectangle(1064,43,4,44,0x43586b).setScrollFactor(0).setDepth(11);
    this.progress=this.add.rectangle(1064,65,4,44,0x7ee0c5).setOrigin(.5,1).setScrollFactor(0).setDepth(12);
    this.toast=this.add.text(W/2,112,'Allison is waiting on Floor 26. Bring beer and two photos. The elevator is out of order.',{fontFamily:'Arial',fontSize:'15px',color:'#ffe0a3',backgroundColor:'#16283e',padding:{x:14,y:10},align:'center'}).setOrigin(.5).setScrollFactor(0).setDepth(12);
    this.prompt=this.add.text(W/2,555,'',{fontFamily:'Arial',fontSize:'16px',color:'#102c39',backgroundColor:'#7ce3c5',padding:{x:14,y:9},align:'center'}).setOrigin(.5).setScrollFactor(0).setDepth(12).setVisible(false);
    this.showIntro();
    this.sharpenDisplay();

  }
  sharpenDisplay(){
    const sharpen=(object:Phaser.GameObjects.GameObject)=>{
      if(this.sharpObjects.has(object))return;
      this.sharpObjects.add(object);
      if(object instanceof Phaser.GameObjects.Text)object.setResolution(RENDER_SCALE);
      if(object instanceof Phaser.GameObjects.Container)object.list.forEach(sharpen);
    };
    for(const object of this.children.list){
      if(this.sharpObjects.has(object))continue;
      if('scrollFactorX' in object && object.scrollFactorX===0){
        const item=object as Phaser.GameObjects.Text;
        item.x+=(W*RENDER_SCALE-W)/2;item.y+=(H*RENDER_SCALE-H)/2;
      }
      sharpen(object);
    }
  }
  showIntro(){
    this.physics.world.pause();
    const backdrop=this.add.rectangle(W/2,H/2,W,H,0x102137,.97);
    const logo=this.add.image(W/2,285,'title-logo').setDisplaySize(750,500);
    this.introCaption=this.add.text(W/2,560,'',{fontFamily:'Arial',fontSize:'16px',fontStyle:'bold',color:'#ffe2aa',backgroundColor:'#102137',padding:{x:12,y:7}}).setOrigin(.5);
    this.introOverlay=this.add.container(0,0,[backdrop,logo,this.introCaption]).setScrollFactor(0).setDepth(50);
    document.getElementById('start-game')!.hidden=false;
  }
  async startIntro(){
    if(this.introStarted||!this.introActive||document.querySelector('dialog[open]'))return;
    document.getElementById('start-game')!.hidden=true;
    this.introStarted=true;this.introCaption.setText('');
    try{await gameAudio.playIntro(()=>this.introCaption.setText(''));}catch{this.say('Intro audio unavailable. The beer run must go on.');}
    if(!this.sys.isActive())return;
    this.introActive=false;this.introOverlay.destroy();
    touch.clear();(document.getElementById('touch-menu-open') as HTMLButtonElement).disabled=false;
    (document.getElementById('pause-toggle') as HTMLButtonElement).disabled=false;
    (document.getElementById('restart-run') as HTMLButtonElement).disabled=false;
    this.lastGround=-1000;this.jumpUntil=0;
    for(const key of Object.values(this.keys))key.reset();
    this.physics.world.resume();gameAudio.music.startRun();
  }
  drawCity(){
    const g=this.add.graphics();
    for(let i=0;i<70;i++){
      const x=i*116, height=230+(i*127%1400);
      if(x+96>floors[26].x-15)continue;
      g.fillStyle(i%2?0x203b56:0x24415b).fillRect(x,GROUND_Y-height,96,height+180);
      g.fillStyle(0x658294,.32);
      for(let y=GROUND_Y-height+20;y<GROUND_Y;y+=42)for(let wx=x+13;wx<x+85;wx+=26)g.fillRect(wx,y,8,13);
    }
    // A quiet, uninterrupted orange-and-blue tower behind the final platform.
    const home=floors[26],tower=this.add.graphics().setDepth(-1).setAlpha(.24);
    const top=home.y-92,bottom=ROAD.y,height=bottom-top;
    tower.fillStyle(0xc47d37).fillRect(home.x,top,home.width,height);
    tower.fillStyle(0xedb44b).fillRect(home.x+22,top+30,home.width-65,height-30);
    tower.fillStyle(0x955332).fillRect(home.x+home.width-43,top+10,43,height-10);
    tower.fillStyle(0x2877a6).fillPoints([
      {x:home.x+12,y:top+28},{x:home.x+12,y:top-33},
      {x:home.x+55,y:top-56},{x:home.x+55,y:top-75},
      {x:home.x+110,y:top-98},{x:home.x+154,y:top-77},
      {x:home.x+154,y:top-52},{x:home.x+home.width-13,y:top-30},
      {x:home.x+home.width-13,y:top+28}
    ],true);
    for(let xx=home.x+28;xx<home.x+home.width-20;xx+=29){
      tower.lineStyle(1,0x7cc7e1,.5).lineBetween(xx,top-28,xx,top+26);
      for(let yy=top+47;yy<bottom-12;yy+=32){
        tower.fillStyle(xx>home.x+home.width-60?0x16486c:0x1e6593).fillRect(xx,yy,11,19);
        tower.fillStyle(0x74bed4,.5).fillRect(xx+1,yy+1,3,16);
      }
    }
    tower.lineStyle(2,0x6ab9d0,.5).lineBetween(EGG.elevatorX,home.y,EGG.elevatorX,ROAD.y);
    this.add.circle(700,650,54,0xffd99a,.8);
    this.add.rectangle(LEVEL_WIDTH/2,ROAD.y+85,LEVEL_WIDTH,170,0x172131);
    this.add.rectangle(LEVEL_WIDTH/2,ROAD.y+2,LEVEL_WIDTH,4,0x687b85);
    for(let x=0;x<LEVEL_WIDTH;x+=120)this.add.rectangle(x,ROAD.y+40,58,5,0xd4b169,.4);
    this.label(290,ROAD.y+110,'GROUND FLOOR • NO ONE BUDGETED FOR CARDIO','#a7c0d0',13);
  }
  decorateLevel(){
    const at=(floor:number)=>floors[floor];
    this.label(20,GROUND_Y-182,'THE ONLY WAY IS UP.', '#ffce88',23);
    this.label(20,GROUND_Y-150,'Allison is waiting on Floor 26.', '#b9d1df',13);
    this.label(20,GROUND_Y-125,'Tap jump • double-tap for Mega Jump • Shift sprint', '#7ee0c6',12);
    this.label(20,GROUND_Y-102,'F at photo signs • Dodge the hazards', '#b9d1df',12);
    this.add.rectangle(29,ROAD.y-48,50,96,0x42566c).setStrokeStyle(2,0x91aabd);
    this.add.rectangle(29,ROAD.y-48,1,92,0x91aabd);
    this.label(6,ROAD.y-79,'ELEVATOR', '#ffd28b',8);
    this.label(8,ROAD.y-60,'OUT OF', '#ffa38a',9);
    this.label(10,ROAD.y-46,'ORDER', '#ffa38a',9);
    const jokes: Record<number,string>={2:'STAIRMASTER: REGRET EDITION',5:'YOUR CALVES HAVE FILED A COMPLAINT',9:'THE BEER IS ABOVE YOU. NATURALLY.',16:'THIS COUNTS AS CONCERT TRAVEL',22:'BUSINESS CLASS. NO CLASS.',25:'FINAL APPROACH / NO SEATBELTS'};
    for(const [n,t] of Object.entries(jokes)){const f=at(Number(n));this.label(f.x+8,f.y-118,t,'#a6c4d4',11);}
    const soccer=at(6);this.label(soccer.x+12,soccer.y-185,'THE LOON ZONE', '#7de2ca',21);this.label(soccer.x+12,soccer.y-157,'UNOFFICIAL BALCONY LEAGUE','#9dbacc',10);
    this.add.image(soccer.x+160,soccer.y,'soccer-star').setOrigin(.5,1).setDisplaySize(49,81);
    const crest=this.textures.get('loons-logo');if(!crest.has('crest'))crest.add('crest',0,1167,16,1505,2122);
    this.add.image(soccer.x+208,soccer.y-116,'loons-logo','crest').setDisplaySize(34,48);
    this.add.rectangle(soccer.x+205,soccer.y-43,43,76,0x94bdc8,0).setStrokeStyle(3,0xd8e9df);
    soccerBall(this,soccer.x+201,soccer.y-10);
    const brew=at(12);this.label(brew.x+12,brew.y-165,'HOP & HOPE', '#ffcc84',23);this.label(brew.x+12,brew.y-136,'SIX BOTTLES. TWELVE FLOORS. NO REFUNDS.','#b1c6d4',10);
    this.crate=this.add.container(beerSpot.x,brew.y,[this.add.image(0,0,'beer-pickup').setOrigin(.5,1).setDisplaySize(52,52)]);
    this.beerHint=this.label(beerSpot.x-78,brew.y-67,'GRAB THE BEER!','#ffda78',16).setDepth(6);
    this.tweens.add({targets:this.beerHint,alpha:.3,duration:400,yoyo:true,repeat:-1});
    const concert=at(17);this.label(concert.x+8,concert.y-204,'THE EXPOSURE TRIANGLE', '#d5b6f2',17);this.label(concert.x+8,concert.y-180,'LIVE MUSIC BREAK','#9fb9cb',10);
    this.add.triangle(concert.x+155,concert.y-85,0,90,30,0,60,90,0xbda0ed,.17);
    const fans=this.textures.get('concert-fans');
    if(!fans.has('metalhead'))fans.add('metalhead',0,180,9,525,979);
    if(!fans.has('jam-fan'))fans.add('jam-fan',0,851,11,448,985);
    const metalhead=this.add.image(concert.x+150,concert.y,'concert-fans','metalhead').setOrigin(.5,1).setDisplaySize(50,94);
    const jamFan=this.add.image(concert.x+216,concert.y,'concert-fans','jam-fan').setOrigin(.5,1).setDisplaySize(43,94);
    this.tweens.add({targets:metalhead,angle:2,duration:420,yoyo:true,repeat:-1});
    this.tweens.add({targets:jamFan,angle:-2,duration:670,yoyo:true,repeat:-1});
    this.add.rectangle(concert.x+179,concert.y-2,121,5,0x59657e);
    this.add.rectangle(concert.x+185,concert.y-18,17,29,0x263047).setStrokeStyle(2,0x9ab2c3);
    this.add.circle(concert.x+185,concert.y-23,5,0x101d2c);this.add.circle(concert.x+185,concert.y-12,4,0x101d2c);
    this.add.line(0,0,concert.x+100,concert.y-132,concert.x+232,concert.y-132,0x62788f).setOrigin(0);
    for(let i=0;i<6;i++)this.add.circle(concert.x+104+i*25,concert.y-130,3,i%2?0xc1a1eb:0x7ce0c8);
    const gate=at(22);this.add.rectangle(gate.x+118,gate.y-64,210,66,0x263d55).setStrokeStyle(2,0x799aaf);
    this.label(gate.x+27,gate.y-87,'GATE 26 → HOME','#ffcf88',19);this.label(gate.x+27,gate.y-59,'Flight delayed. Try jumping.','#bfd4dd',12);
    for(const s of photoStops){
      this.add.rectangle(s.x-25,s.y-65,140,35,0x65e4ca).setStrokeStyle(2,0xe0fff1);
      this.label(s.x-89,s.y-75,'[ F ] PHOTO STOP','#133c48',13);
      this.label(s.x-90,s.y-44,'Don’t walk past the shot!','#b6f7e7',11);
      this.add.line(0,0,s.x-25,s.y-47,s.x-25,s.y+25,0x93cabb).setOrigin(0);
    }
    const home=at(26);this.add.rectangle(home.x+190,home.y-68,90,136,0x435a72).setStrokeStyle(2,0x9bb7c7);
    this.label(home.x+190,home.y-120,"Seth's Apt",'#ffcd87',15).setOrigin(.5,0);
    this.label(home.x+5,home.y-218,'HOME. FINALLY.', '#7ce2c7',23);
    this.add.image(home.x+76,home.y,'allison').setOrigin(.5,1).setDisplaySize(54,82);
    this.label(home.x+28,home.y-102,'Allison','#f6c9d5',13);
    this.cat(home.x+123,home.y-9,0xe3aa72,true);this.cat(home.x+163,home.y-9,0xb6a9c5,false);
    this.label(home.x+10,home.y+144,'Oakey: box inspector. Ellowyn: lap reserved.','#cbdce5',11);
    this.label(home.x+10,home.y+164,'“The elevator works now.” — Allison','#ffcf91',12);
  }
  label(x:number,y:number,t:string,c:string,size:number){return this.add.text(x,y,t,{fontFamily:'Arial',fontSize:`${size}px`,color:c});}
  cat(x:number,y:number,_color:number,playful:boolean){
    const art=this.add.image(0,0,'cats',playful?'oakey':'ellowyn').setOrigin(.5,1).setDisplaySize(playful?23:36,playful?31:25);
    const c=this.add.container(x,y+9,[art]);
    if(playful)this.tweens.add({targets:c,y:y-3,duration:500,yoyo:true,repeat:-1});
  }
  addHazard(floor:number,kind:HazardKind){
    const f=floors[floor],human=kind==='partier'||kind==='clown';
    const x=f.x+(isFalling(kind)?f.width/2:human?196:180);let y=f.y-14,width=22,height=28;
    let art:Phaser.GameObjects.Container;
    if(kind==='keg')art=steelKeg(this,x,y);
    else if(kind==='ball'){y=f.y-9;width=18;height=18;art=soccerBall(this,x,y);}
    else if(kind==='partier'){y=f.y-35;width=25;height=66;art=this.add.container(x,y,[this.add.image(0,0,'scruffy').setDisplaySize(48,76)]);}
    else if(kind==='clown'){
      y=f.y-36;width=26;height=68;
      art=this.add.container(x,y,[this.add.image(0,0,'clown').setDisplaySize(48,76)]);
    }else{
      const g=this.add.graphics();
      if(kind==='piano'){
        y=f.y-20;width=48;height=44;
        g.fillStyle(0x3b283d).fillRoundedRect(-24,-20,48,32,4);g.fillStyle(0xe9e4dd).fillRect(-22,5,44,8);
        for(let i=-18;i<20;i+=8)g.fillStyle(0x172135).fillRect(i,5,3,6);
        g.fillStyle(0xa48173).fillRect(-20,12,5,12).fillRect(15,12,5,12);
      }else if(kind==='anvil'){
        y=f.y-18;width=44;height=34;
        g.fillStyle(0x526575).fillRect(-13,-14,27,10).fillTriangle(-28,-14,-13,-14,-13,-4).fillRect(8,-14,17,6);
        g.fillStyle(0x91a6ae).fillRect(-13,-16,38,3);
        g.fillStyle(0x3b4b59).fillRect(-7,-4,14,14).fillRect(-17,10,34,6);
      }else if(kind==='ac'){
        y=f.y-18;width=42;height=34;
        g.fillStyle(0xb5c1c2).fillRoundedRect(-22,-17,44,34,2);
        g.fillStyle(0xe1e5dd).fillRect(-19,-14,38,27);
        for(let yy=-10;yy<12;yy+=4)g.lineStyle(2,0x657780).lineBetween(-16,yy,5,yy);
        g.fillStyle(0x354e5c).fillRect(9,-9,7,15);g.fillStyle(0x7de2ca).fillCircle(12,-5,1.5);
        g.lineStyle(2,0x536878).lineBetween(-25,17,25,17);
      }else if(kind==='cooler'){
        y=f.y-17;width=42;height=32;
        g.fillStyle(0x346d91).fillRoundedRect(-21,-12,42,27,4);
        g.fillStyle(0xedeee5).fillRoundedRect(-23,-18,46,8,2);
        g.lineStyle(3,0xbac7c9).strokeRoundedRect(-25,-5,50,14,4);
        g.fillStyle(0xe9d5a6).fillRect(-10,-6,20,12);g.fillStyle(0x294f4b).fillRect(-7,-3,14,6);
      }else if(kind==='cone'){
        width=20;height=25;y=f.y-12;
        g.fillStyle(0x263b4b).fillRoundedRect(-14,8,28,4,2);g.fillStyle(0xd85f25).fillTriangle(-10,8,0,-14,10,8);g.fillStyle(0xff9755).fillTriangle(-8,7,0,-14,0,7);g.fillStyle(0xe9e7d9).fillPoints([{x:-5,y:-4},{x:5,y:-4},{x:7,y:1},{x:-7,y:1}],true);
      }else if(kind==='pigeon'){
        y=f.y-16;width=23;height=20;
        g.fillStyle(0x667783).fillEllipse(0,0,24,15);g.fillStyle(0x4d676b).fillEllipse(6,-6,11,15);g.fillStyle(0xabb9bf).fillCircle(9,-12,6);g.fillStyle(0xe9b868).fillTriangle(14,-13,19,-11,14,-9);g.fillStyle(0x172637).fillCircle(11,-13,1);g.lineStyle(2,0x3d5263).lineBetween(-8,-2,3,4).lineBetween(-5,-5,5,1);g.lineStyle(1,0xdca876).lineBetween(-4,7,-6,13).lineBetween(3,7,5,13);
      }else{
        width=24;height=29;y=f.y-17;
        g.lineStyle(2,0x9db1ba).strokeRoundedRect(-5,-23,10,13,2);g.fillStyle(0x397e86).fillRoundedRect(-12,-12,24,27,4);g.lineStyle(1,0x83bac0).lineBetween(-6,-9,-6,12).lineBetween(0,-9,0,12).lineBetween(6,-9,6,12);g.fillStyle(0x182c3c).fillCircle(-8,15,3).fillCircle(8,15,3);g.fillStyle(0xffd892).fillRect(-1,-7,6,5);
      }
      art=this.add.container(x,y,[g]);
    }
    const body=this.physics.add.image(x,y,'body').setVisible(false).setImmovable(true).setSize(width,height);body.body.allowGravity=false;
    const names={keg:'KEG CROSSING',ball:'BALL HAS NO BRAKES',piano:'LOOK UP! PIANO',anvil:'ACME ROOFTOP DELIVERY',ac:'AIR CONDITIONING: EXPRESS',cooler:'COLD BEER. HARD LANDING.',partier:'AFTERPARTY WOBBLER',clown:'UNLICENSED BALCONY CLOWN',cone:'CONE OF UNCERTAINTY',pigeon:'PIGEON: NO PHOTO RELEASE',suitcase:'UNATTENDED EMOTIONAL BAGGAGE'};
    this.label(f.x+12,f.y+(f.floor===2?45:99),names[kind],'#ffad92',10);
    const warning=isFalling(kind)?this.label(x-43,f.y-112,'▼ DROP ZONE','#ffcc78',11):undefined;
    if(isFalling(kind)){this.add.rectangle(x,f.y-2,60,4,0xf38279);this.label(f.x+12,f.y-126,'BAIT THE DROP. THEN GO.','#a8c4d0',10);}
    const hazard:Hazard={kind,floor,x,y,art,body,warning,phase:floor*131};
    this.hazards.push(hazard);
    if(isFalling(kind))this.physics.add.collider(this.player,body,undefined,()=>fallingObjectSolid(hazard.piano));
  }
  say(t:string){this.toast.setText(t);}
  retry(time:number,reason:string,reaction:'fall'|'person'|'object'|'squish'='object'){
    this.mishaps=recordMishap(this.mishaps,reaction);
    this.jumpStarted=-1;this.megaUsed=false;
    this.retries++;(this.player.body as Phaser.Physics.Arcade.Body).reset(this.checkpoint.x,this.checkpoint.y);this.player.setVelocity(0,0);this.immuneUntil=time+1400;this.lastGround=-1000;this.jumpUntil=0;
    gameAudio.play('impact');if(reaction==='fall'&&!this.fallSoundPlayed)gameAudio.speak('Aaaaaah!','fall');if(reaction==='squish')gameAudio.speak('Squish!','squish');if(reaction==='person')gameAudio.speak('Well, excuse you.','person');if(reaction==='object'){const kind=objectImpactReaction(Math.random());gameAudio.speak(kind==='ouch'?'Ouch!':'Ahh!',kind);}this.cameras.main.shake(100,.003);this.say(reason+' Beer and photos saved.');this.fallSoundPlayed=false;
  }
  togglePause(){
    if(this.introActive||this.won||this.failed||scoresOpen())return;
    touch.clear();this.paused=!this.paused;this.controller.armed=false;
    const button=document.getElementById('pause-toggle')!;
    button.textContent=this.paused?'Resume · P':'Pause · P';button.setAttribute('aria-pressed',String(this.paused));
    this.jumpStarted=-1;this.megaUsed=false;
    if(this.paused){
      this.pauseStarted=this.time.now;this.physics.world.pause();this.tweens.pauseAll();void gameAudio.setPaused(true);
      this.pauseOverlay=this.add.container(0,0,[
        this.add.rectangle(W/2,H/2,W,H,0x102137,.88),
        this.add.text(W/2,265,'PAUSED',{fontFamily:'Arial',fontSize:'54px',fontStyle:'bold',color:'#ffd08b'}).setOrigin(.5),
        this.add.text(W/2,330,'P or Resume to continue',{fontFamily:'Arial',fontSize:'21px',color:'#c9dde7'}).setOrigin(.5)
      ]).setScrollFactor(0).setDepth(70);this.sharpenDisplay();
    }else{
      const duration=this.time.now-this.pauseStarted;this.immuneUntil+=duration;this.lastGround=-1000;this.jumpUntil=0;
      this.pauseOverlay.destroy();this.tweens.resumeAll();void gameAudio.setPaused(false);
      for(const key of Object.values(this.keys))key.reset();
      if(!this.riding)this.physics.world.resume();
    }
  }
  updateHud(){
    const progressFloor=this.riding?(ROAD.y-this.player.y-24)/FLOOR_RISE:this.floor;
    this.progress.setSize(4,44*Phaser.Math.Clamp(progressFloor/26,0,1)).setOrigin(.5,1).setVisible(progressFloor>0);
    const remaining=Math.max(0,Math.ceil((RUN_LIMIT_MS-this.elapsedMs)/1000));
    gameAudio.music.updateRemaining(remaining);
    this.hud.setText(`GROUND → 26F  ${this.onRoad?'ROAD':`FLOOR ${this.floor} / 26`}  ${missing(this.beer,this.photos)}  •  mishaps ${this.retries}`);
    this.timerText.setText(countdownLabel(this.elapsedMs)).setColor(remaining<=30?'#ff7e79':'#ffd08b');
  }
  failRun(){
    if(this.failed||this.won)return;
    (document.getElementById('pause-toggle') as HTMLButtonElement).disabled=true;
    gameAudio.music.finishRun('failure');this.failed=true;this.failurePhase='falling';gameAudio.cancelRide();this.riding=false;this.rideTween?.stop();this.eggLift.setVisible(false);
    this.player.setVelocity(0,0);this.walking=false;this.physics.world.pause();this.prompt.setVisible(false);this.cameras.main.stopFollow();
    this.hero.setPosition(this.player.x,this.player.y).setAlpha(1);this.portrait.anims.timeScale=1;
    this.portrait.play(this.beer?`fall-beer-${this.facing<0?'left':'right'}`:'fall-empty',true);
    if(!this.fallSoundPlayed)gameAudio.speak('Aaaaaah!','fall');
    const version=this.runVersion;
    this.tweens.add({targets:this.hero,y:this.hero.y+H+180,duration:900,ease:'Quad.easeIn',onComplete:()=>{if(this.runVersion===version&&this.sys.isActive())this.showTimeoutScene();}});
  }
  showTimeoutScene(){
    this.hero.setVisible(false);this.failurePhase='ground';
    const screen=this.add.container(0,0).setScrollFactor(0).setDepth(40);
    screen.add(this.add.rectangle(W/2,H/2,W,H,0x172b45,1));
    // Preserve the game's city palette and windows behind the ground-level scene.
    const city=this.add.graphics();
    for(let i=0;i<11;i++){
      const x=i*112-25,height=170+(i*127%280);
      city.fillStyle(i%2?0x203b56:0x24415b).fillRect(x,525-height,96,height);
      city.fillStyle(0x658294,.32);
      for(let y=545-height;y<510;y+=42)for(let wx=x+13;wx<x+85;wx+=26)city.fillRect(wx,y,8,13);
    }
    screen.add(city);screen.add(this.add.rectangle(W/2,H/2,W,H,0x102137,.35));
    screen.add(this.add.rectangle(W/2,185,660,170,0x102137,.82));
    screen.add(this.add.rectangle(W/2,565,W,80,0x172131));
    for(let x=30;x<W;x+=120)screen.add(this.add.rectangle(x,565,58,5,0xd4b169,.35));
    const text=(y:number,value:string,size:number,color:string)=>{const label=this.add.text(W/2,y,value,{fontFamily:'Arial',fontSize:`${size}px`,color,align:'center'}).setOrigin(.5);screen.add(label);return label;};
    text(130,'TIME’S UP. BEER’S WARM.',34,'#ffd08b').setFontStyle('bold');
    text(175,'You died, great sadness.',20,'#ffac8c');
    text(220,'180 seconds elapsed. No score saved.\nHold R for another run.',20,'#d5e8ec');
    screen.add(this.add.rectangle(W/2,525,W-100,3,0x537185));
    const body=this.add.sprite(165,525,'seth-timeout','ground-2').setOrigin(.5,1).setDisplaySize(190,225).setScrollFactor(0).setDepth(43);
    const angel=this.add.sprite(165,525,'seth-timeout','angel-0').setOrigin(.5,.9).setDisplaySize(128,190).setAlpha(0).setScrollFactor(0).setDepth(44);
    screen.add([body,angel]);this.timeoutAngel=angel;angel.play('timeout-angel');
    this.time.delayedCall(1000,()=>{
      this.failurePhase='rising';
      this.tweens.add({targets:body,alpha:0,duration:650});this.tweens.add({targets:angel,alpha:1,duration:650});
      this.tweens.add({targets:angel,y:310,duration:1600,ease:'Sine.easeOut',onComplete:()=>{
        this.failurePhase='angel';
        // Free flight may pass in front of the message; keep the whole sprite on screen.
        this.tweens.chain({targets:angel,tweens:[{x:W/2,y:235,duration:3500},{x:W-165,y:360,duration:4000},{x:W/2,y:490,duration:4500},{x:165,y:250,duration:4500},{x:W-165,y:235,duration:6000},{x:165,y:310,duration:5500}],ease:'Sine.easeInOut',repeat:-1});
        this.tweens.add({targets:angel,angle:5,duration:650,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
      }});
    });
    this.sharpenDisplay();
  }
  buildEgg(){
    const y=ROAD.y;
    const guitar=this.add.graphics();
    guitar.fillStyle(0xb52e36).fillPoints([
      {x:EGG.guitarX-4,y:y-41},{x:EGG.guitarX-13,y:y-50},{x:EGG.guitarX-16,y:y-36},
      {x:EGG.guitarX-12,y:y-27},{x:EGG.guitarX-18,y:y-17},{x:EGG.guitarX-13,y:y-3},
      {x:EGG.guitarX+10,y:y-3},{x:EGG.guitarX+17,y:y-14},{x:EGG.guitarX+10,y:y-29},
      {x:EGG.guitarX+14,y:y-45},{x:EGG.guitarX+5,y:y-39}
    ],true);
    guitar.fillStyle(0xe8e1ca).fillTriangle(EGG.guitarX-4,y-34,EGG.guitarX+10,y-12,EGG.guitarX-8,y-10);
    guitar.fillStyle(0xd4b072).fillRect(EGG.guitarX-2,y-68,4,42);
    guitar.fillStyle(0x916332).fillRect(EGG.guitarX-3,y-76,8,11);
    guitar.fillStyle(0x182330).fillRect(EGG.guitarX-5,y-27,10,3).fillRect(EGG.guitarX-5,y-17,10,3);
    guitar.fillStyle(0xc5cdd0).fillRect(EGG.guitarX-4,y-10,8,3);
    guitar.lineStyle(.6,0xe9e0c5).lineBetween(EGG.guitarX,y-73,EGG.guitarX,y-7);
    this.add.rectangle(EGG.ampX,y-20,42,40,0x252b34).setStrokeStyle(2,0xa0a5a0);
    this.add.circle(EGG.ampX,y-18,12,0x101a24).setStrokeStyle(1,0x5a6a78);
    for(let i=0;i<4;i++)this.add.circle(EGG.ampX-12+i*8,y-34,1.5,0xeac88b);
    for(const [x,width,height] of [[EGG.guitarX,25,42],[EGG.ampX,42,40]]){
      const block=this.add.rectangle(x,y-height/2,width,height,0xffffff,0);
      this.physics.add.existing(block,true);this.physics.add.collider(this.player,block);this.eggBlocks.push(block);
    }
    this.eggBall=soccerBall(this,EGG.ballX,y-9,9);
    const net=this.add.graphics();
    const gx=EGG.goalX-30;
    net.fillStyle(0x9fbfc9,.12).fillPoints([{x:gx,y:y-48},{x:gx+86,y:y-48},{x:gx+105,y:y-33},{x:gx+105,y},{x:gx,y}],true);
    net.lineStyle(1,0x9ab9bf,.55);
    for(let i=1;i<9;i++)net.lineBetween(gx+i*10,y-48,gx+i*10,y);
    for(let i=1;i<5;i++)net.lineBetween(gx,y-i*10,gx+86,y-i*10);
    net.lineStyle(3,0xdfece3,1).strokePoints([{x:gx,y},{x:gx,y:y-48},{x:gx+86,y:y-48},{x:gx+86,y}],false);
    net.lineStyle(2,0x9fbfc9,.85).strokePoints([{x:gx+86,y:y-48},{x:gx+105,y:y-33},{x:gx+105,y},{x:gx+86,y}],false);
    this.label(EGG.ballX-45,y-70,'KICK A GOAL →','#ffd08b',14);
    this.liftHint=this.label(EGG.elevatorX-125,y-118,'[ F ] ENTER ELEVATOR','#ffd08b',14).setVisible(false).setDepth(6);
    this.eggLabel=this.label(EGG.guitarX-24,y-110,'SERVICE ROAD','#93afc3',12);
    this.eggLift=this.add.container(EGG.elevatorX,y,[
      this.add.rectangle(0,-45,48,90,0x40576a).setStrokeStyle(2,0x7ee0c5),
      this.add.rectangle(0,-45,1,85,0x9db4c2),
      this.label(-20,-80,'↑ 26','#ffd08b',13),
    ]).setVisible(false);
  }
  updateEgg(){
    this.liftHint.setVisible(this.onRoad&&this.eggStage===4&&!this.riding&&Math.abs(this.player.x-EGG.elevatorX)<70);
    if(!this.onRoad){this.eggPreviousX=this.player.x;return;}
    const body=this.player.body as Phaser.Physics.Arcade.Body;
    if(this.eggStage===0&&this.eggPreviousX<EGG.guitarX&&this.player.x>=EGG.guitarX&&body.bottom<ROAD.y-22)this.eggStage=1;
    if(this.eggStage===1&&this.eggPreviousX<EGG.ampX&&this.player.x>=EGG.ampX&&body.bottom<ROAD.y-38)this.eggStage=2;
    if(this.eggStage===2&&Math.abs(this.player.x-EGG.ballX)<30&&Math.abs(body.bottom-ROAD.y)<12){
      this.eggStage=3;gameAudio.playLocation('goal');
      this.tweens.add({targets:this.eggBall,x:EGG.goalX+12,duration:800,onUpdate:(_tween:Phaser.Tweens.Tween)=>{
        const progress=(this.eggBall.x-EGG.ballX)/(EGG.goalX+12-EGG.ballX);
        this.eggBall.y=ROAD.y-9-Math.sin(progress*Math.PI)*60;this.eggBall.rotation=progress*9;
      },onComplete:()=>{this.eggStage=4;this.eggLift.setVisible(true);this.eggLabel.setText('GOAL! ELEVATOR UNLOCKED →').setColor('#ffd08b');}});
    }
    if(this.eggStage===4&&Math.abs(this.player.x-EGG.elevatorX)<60&&(Phaser.Input.Keyboard.JustDown(this.keys.F)||this.pad.interact))void this.takeElevator();
    this.eggPreviousX=this.player.x;
  }
  async takeElevator(){
    if(this.riding)return;
    this.riding=true;this.cheater=true;this.liftHint.setVisible(false);this.player.setVelocity(0,0);this.physics.world.pause();
    this.prompt.setVisible(false);this.say('Going up. No stairs were harmed.');
    const version=this.runVersion;await gameAudio.unlock();
    if(this.runVersion!==version)return;
    const duration=gameAudio.duration('elevator'),home=floors[26];
    (this.player.body as Phaser.Physics.Arcade.Body).reset(EGG.elevatorX,ROAD.y-24);
    this.eggLift.setPosition(EGG.elevatorX,ROAD.y);
    this.rideTween=this.tweens.add({targets:this.player,y:home.y-24,duration,ease:'Sine.easeInOut',onUpdate:()=>{
      this.hero.setPosition(this.player.x,this.player.y);this.eggLift.setPosition(this.player.x,this.player.y+24);
    }});
    await gameAudio.playRide();
    if(this.runVersion!==version||this.failed)return;
    this.rideTween.stop();(this.player.body as Phaser.Physics.Arcade.Body).reset(EGG.elevatorX,home.y-24);
    this.hero.setPosition(this.player.x,this.player.y);this.eggLift.setVisible(false);
    this.floor=26;this.onRoad=false;this.riding=false;this.heroHeard=true;this.heroPlaying=false;
    this.checkpoint={x:home.x+50,y:home.y-24};this.immuneUntil=this.time.now+1500;
    this.finish();
  }

  update(time:number,delta:number){
    if(!this.player)return;
    gameAudio.music.setHold('scores',scoresOpen());
    let pads:readonly (Gamepad|null)[]=[];try{pads=navigator.getGamepads?.()??[];}catch{/* Keyboard remains usable if gamepad access is blocked. */}
    const controller=this.controller.sample(Array.from(pads),document.hasFocus()&&!scoresOpen()&&!(document.getElementById('touch-menu') as HTMLDialogElement).open&&document.activeElement?.id!=='radio-volume');const mobile=touch.sample(scoresOpen()||document.hidden||!!document.querySelector('dialog[open]'));
    controller.move=controller.move||mobile.move;
    controller.jump ||= mobile.jump;controller.interact ||= mobile.interact;controller.recall ||= mobile.recall;controller.pause ||= mobile.pause;controller.sprint ||= mobile.sprint;
    this.pad=controller;
    if(!mobile.restart)this.touchRestartSince=null;
    if(mobile.restart&&!this.introActive){this.touchRestartSince??=time;if(time-this.touchRestartSince>=RESTART_HOLD_MS){touch.clear();this.scene.restart();return;}}

    const controllerStatus=document.getElementById('controller-status');if(controllerStatus&&controllerStatus.textContent!==controller.label)controllerStatus.textContent=controller.label;
    if(controller.disconnected&&!this.paused){this.player.setVelocityX(0);this.togglePause();}
    if(Phaser.Input.Keyboard.JustDown(this.keys.P)||controller.pause)this.togglePause();
    if(this.paused){const live=document.getElementById('live-status');if(live){live.dataset.paused='true';live.dataset.sound=gameAudio.state;live.textContent='Paused. Press P to resume.';}return;}
    if(scoresOpen()){this.physics.world.pause();this.input.keyboard!.enabled=false;this.scorePaused=true;return;}
    if(this.scorePaused){this.input.keyboard!.enabled=true;this.scorePaused=false;for(const key of Object.values(this.keys))key.reset();if(!this.introActive&&!this.failed&&!this.won)this.physics.world.resume();}
    if(Phaser.Input.Keyboard.JustDown(this.keys.S))gameAudio.toggle();
    if(this.introActive&&(controller.jump||controller.interact||controller.pause||controller.move!==0)){void gameAudio.unlock();void this.startIntro();}
    if(this.introActive){const status=document.getElementById('live-status');if(status){status.textContent=`BEER RUN intro. ${this.introStarted?'Playing Let’s go. Gameplay locked.':'Select Start Game to begin. Gameplay locked.'}`;status.dataset.intro='true';status.dataset.x=String(Math.round(this.player.x));status.dataset.y=String(Math.round(this.player.y));status.dataset.loadedVoices=String(gameAudio.loadedVoiceCount);status.dataset.voiceLine=gameAudio.lastSpoken;status.dataset.voiceStatus=gameAudio.voiceStatus;status.dataset.muted=String(gameAudio.muted);}return;}
    if(!this.won&&!this.failed)this.elapsedMs+=Math.min(delta,250);
    if(!this.won&&!this.failed&&runExpired(this.elapsedMs))this.failRun();
    const timerBeep=timerWarningSecond(this.elapsedMs);
    if(!this.won&&!this.failed&&timerBeep!==null&&timerBeep!==this.lastTimerBeep){this.lastTimerBeep=timerBeep;gameAudio.play('timer',timerBeep<=10);}
    if(this.riding){
      this.updateHud();const live=document.getElementById('live-status');
      if(live){live.dataset.riding='true';live.dataset.x=String(Math.round(this.player.x));live.dataset.y=String(Math.round(this.player.y));live.dataset.elapsed=String(Math.round(this.elapsedMs));live.textContent='Elevator ascending to floor 26. '+this.hud.text;}
      return;
    }
    if(this.keys.R.isDown||mobile.restart){
      this.restartSince??=time;
      if(time-this.restartSince>=RESTART_HOLD_MS){this.scene.restart();return;}
    }else this.restartSince=null;
    if(this.failed){this.updateHud();const live=document.getElementById('live-status');if(live){live.dataset.failed='true';live.dataset.failurePhase=this.failurePhase;live.dataset.angelX=String(Math.round(this.timeoutAngel?.x??0));live.dataset.angelY=String(Math.round(this.timeoutAngel?.y??0));live.dataset.falls=String(this.mishaps.falls);live.dataset.squishes=String(this.mishaps.squishes);live.dataset.bumps=String(this.mishaps.bumps);live.textContent=`Time expired. No score saved. ${this.failurePhase==='angel'?'Angel Seth is fluttering.':'Seth’s final flight.'} Hold R or press Restart for a new run.`;}return;}
    const body=this.player.body as Phaser.Physics.Arcade.Body;
    if(!this.won&&!this.failed){
      const missed=missedPhotos(this.player.x,this.photos);
      if((Phaser.Input.Keyboard.JustDown(this.keys.B)||controller.recall)&&missed.length){
        const stop=photoStops[missed[0]],f=floors[stop.floor];
        body.reset(f.x+65,f.y-24);this.player.setVelocity(0,0);this.floor=f.floor;this.onRoad=false;this.checkpoint={x:f.x+45,y:f.y-24};this.immuneUntil=time+1000;
        this.say('CAMERA STRAP EXPRESS: back to the missed shot. Press F at the sign.');
      }
      const direction=keyboardOrControllerMove(this.keys.A.isDown||this.keys.LEFT.isDown,this.keys.D.isDown||this.keys.RIGHT.isDown,controller.move);
      this.player.setVelocityX(direction*((this.keys.SHIFT.isDown||controller.sprint)?SPRINT_SPEED:275));this.walking=direction!==0&&body.blocked.down;if(direction)this.facing=direction;
      if(body.blocked.down){
        this.lastGround=time;
        const landed=floors.find(f=>this.player.x>f.x+8&&this.player.x<f.x+f.width-8&&Math.abs(body.bottom-f.y)<8);
        if(landed){
          if(landed.floor===0&&roadLandingIsFall(this.floor)){this.retry(time,'Back to the rooftop.','fall');}
          else{this.fallSoundPlayed=false;this.onRoad=landed.floor===0;this.floor=landed.floor;this.checkpoint={x:landed.floor===0?this.player.x:landed.x+50,y:landed.y-24};}
        }
      }
      const jumpPressed=controller.jump||['W','UP','SPACE'].some(k=>Phaser.Input.Keyboard.JustDown(this.keys[k]));
      if(body.blocked.down&&body.velocity.y>=0){this.jumpStarted=-1;this.megaUsed=false;}
      const boost=jumpPressed&&!this.megaUsed&&this.jumpStarted>=0
        ?megaJumpVelocity(this.elapsedMs-this.jumpStarted,body.velocity.y):null;
      if(boost!==null){
        this.player.setVelocityY(boost);this.megaUsed=true;this.jumpUntil=0;
        gameAudio.speak('Mega jump','grunt',undefined,false,this.jumpCount%2?.97:1.04);
      }else{
        if(jumpPressed)this.jumpUntil=time+130;
        if(this.jumpUntil>time&&time-this.lastGround<110){
          this.player.setVelocityY(-REGULAR_JUMP_SPEED);this.jumpUntil=0;this.lastGround=-1000;
          this.jumpStarted=this.elapsedMs;this.megaUsed=false;this.jumpCount++;
          gameAudio.play('jump');gameAudio.speak('Quick hop','quick',undefined,false,this.jumpCount%2?.97:1.04);
        }
      }
      this.player.x=Phaser.Math.Clamp(this.player.x,14,LEVEL_WIDTH-14);
      const fall=fallDecision(this.floor,body.bottom,body.velocity.y,this.player.x);
      if(!this.fallSoundPlayed&&fall.scream){this.fallSoundPlayed=true;gameAudio.speak('Aaaaaah!','fall');}
      if(fall.retry)this.retry(time,'Gravity got the shot.','fall');
      for(const h of this.hazards){
        let x=h.x,y=h.y,active=true;



        if(!isFalling(h.kind))x=patrolX(floors[h.floor],this.elapsedMs,h.phase,h.kind==='ball'?120:h.kind==='partier'?55:80);
        if(h.kind==='pigeon')y-=Math.max(0,Math.sin((time+h.phase)/470))*17;
        if(h.kind==='clown'){
          y-=Math.abs(Math.sin((time+h.phase)/480))*5;
          if(Math.abs(this.player.x-x)<210&&time>(h.nextHonk??0)){gameAudio.play('clown');h.nextHonk=time+4500;}
        }
        if(isFalling(h.kind)){
          const inRange=Math.abs(this.player.x-h.x)<280&&Math.abs(this.player.y-(floors[h.floor].y-24))<170;
          const motion=fallingStep(h.piano??{startedAt:-Infinity,readyAt:0,serial:0},this.elapsedMs,inRange,h.kind);
          h.piano=motion;y=h.y+motion.offset;active=fallingObjectHurts(motion);
          h.warning!.setVisible(motion.warning||motion.dropping).setText(motion.warning?'▼ INCOMING!':'▼ MOVE!').setColor('#ff8d82');
          h.art.setVisible(motion.warning||motion.dropping||motion.landed);
          if(motion.landed&&h.impacted!==motion.serial){
            h.impacted=motion.serial;impactEffects(this,h.kind,h.x,floors[h.floor].y);
            if(h.kind==='cooler')gameAudio.playLocation('crashing');else gameAudio.play('piano');
            this.cameras.main.shake(h.kind==='anvil'?140:80,.002);
          }
        }
        h.art.setPosition(x,y);h.body.body!.reset(x,y);
        // Resolve the first landed frame immediately; the collider also supports standing/jumping on it.
        if(isFalling(h.kind)&&fallingObjectSolid(h.piano))this.physics.collide(this.player,h.body);
        if(h.kind==='partier')h.art.rotation=Math.sin((time+h.phase)/500)*.12;
        if(h.kind==='ball')h.art.rotation=time/110;
        if(h.kind==='suitcase'||h.kind==='clown')h.art.rotation=Math.sin((time+h.phase)/180)*.065;
        if(active&&time>this.immuneUntil&&this.physics.overlap(this.player,h.body)){
          const lines={keg:'Keg: 1. Shins: 0.',ball:'Red card for your ankles.',piano:'That was an upright. You are not.',anvil:'Heavy metal. Wrong concert.',ac:'You have been air conditioned.',cooler:'The cold ones got you.',partier:'The afterparty has right of way, apparently.',clown:'Honk if you regret this route.',cone:'You have been inconvenienced by municipal geometry.',pigeon:'You have been reviewed by a pigeon. One star.',suitcase:'Your baggage has arrived ahead of you.'};
          this.retry(time,lines[h.kind],isFalling(h.kind)?'squish':h.kind==='partier'||h.kind==='clown'?'person':'object');break;
        }
      }
      const locations=[{id:'soccer',floor:6,kind:'soccer' as const},{id:'concert',floor:17,kind:'concert' as const},{id:'jet-13',floor:13,kind:'jet' as const},{id:'jet-22',floor:22,kind:'jet' as const}];
      for(const spot of locations)if(this.floor===spot.floor&&!this.heardLocations.has(spot.id)){
        this.heardLocations.add(spot.id);gameAudio.playLocation(spot.kind);
      }
      if(!this.beer&&Math.abs(this.player.x-beerSpot.x)<43&&Math.abs(this.player.y-beerSpot.y)<65){this.beer=true;gameAudio.play('pickup');this.crate.setVisible(false);this.beerHint.setVisible(false);this.say('SIX-PACK IN HAND. Only fourteen floors of foam management left.');}
      this.updateEgg();
      if(this.riding)return;
      const stop=photoStops.findIndex(s=>Math.abs(this.player.x-s.x)<100&&Math.abs(this.player.y-s.y)<90);
      const home=this.floor===26;
      if(home&&!this.heroHeard){
        this.heroHeard=true;this.heroPlaying=true;const run=this.runVersion;
        this.say('Allison: “My hero!” • Let her finish, then press F to deliver.');
        void gameAudio.playHero().then(()=>{if(this.runVersion===run)this.heroPlaying=false;});
      }
      const beerNearby=this.floor===12&&!this.beer;
      this.prompt.setVisible(stop>=0||home||beerNearby);
      if(stop>=0)this.prompt.setText(this.photos.has(stop)?'✓ Photo saved. Upward, photographer.':this.heroHeard?'[ F ] RECOVER PHOTO • +125 points (half value)':'[ F ] PHOTO OPPORTUNITY • +250 points');
      else if(home)this.prompt.setText(this.heroPlaying?'Allison: “My hero!” • Delivery unlocks after this line':this.beer?'[ F ] Deliver six-pack & finish • B returns to missed photos':'[ F ] Finish without beer • B returns to missed photos');
      if(beerNearby)this.prompt.setText(`GRAB THE BEER! ${this.player.x<beerSpot.x?'→':'←'} Walk into the six-pack`);
      if(Phaser.Input.Keyboard.JustDown(this.keys.F)||controller.interact){
        if(stop>=0&&!this.photos.has(stop)){this.photos.add(stop);if(this.heroHeard)this.latePhotos.add(stop);gameAudio.play('photo');this.cameras.main.flash(140,255,255,255);this.say(`PHOTO SAVED • +${this.latePhotos.has(stop)?125:250} points • ${photoStops[stop].caption}`);}
        else if(home&&!this.heroPlaying)this.finish();
      }
      for(const i of missedPhotos(this.player.x,this.photos))if(!this.warned.has(i)){
        this.warned.add(i);gameAudio.play('miss');this.say(`MISSED PHOTO: ${photoStops[i].short.toUpperCase()}! Press B to return. Watch the persistent photo tracker.`);this.cameras.main.flash(180,255,135,60);
      }
    }
    this.hero.setPosition(this.player.x,this.player.y);
    const falling=!body.blocked.down&&!this.won&&!this.failed&&fallingPose(this.floor,body.bottom,body.velocity.y);
    const side=this.facing<0?'left':'right';
    const anim=falling?(this.beer?`fall-beer-${side}`:'fall-empty'):(this.beer?`walk-beer-${side}`:'walk-empty');
    // Match the 40% faster sprint with a 40% faster walk cycle (8 → 11.2 fps).
    this.portrait.anims.timeScale=!falling&&this.walking&&Math.abs(body.velocity.x)>275?1.4:1;
    if(falling){this.portrait.play(anim,true);}
    else if(this.walking&&!this.won){this.portrait.play(anim,true);this.visitedWalkFrames.add(String(this.portrait.frame.name));}
    else{this.portrait.stop();this.portrait.setTexture(this.beer?'seth-carry-directions':'seth-walk',this.beer?(side==='left'?5:1):(body.blocked.down?1:0));}
    this.portrait.setFlipX(!this.beer&&this.facing<0).setY(24);
    this.hero.setAlpha(time<this.immuneUntil?(Math.floor(time/100)%2?.35:1):1);
    this.updateHud();
    const indicator=photoIndicator(this.player.x,this.photos),hasMissed=missedPhotos(this.player.x,this.photos).length>0;
    this.photoHud.setText(indicator).setColor(hasMissed?'#ffac8c':'#80e5ce');
    const status=document.getElementById('live-status');
    const summary=`${this.hud.text}. ${indicator}. ${this.toast.text}${this.won?' Mission complete.':''}`;
    if(status){status.dataset.paused='false';const drop=this.hazards.find(h=>isFalling(h.kind)&&h.floor===this.floor);status.dataset.dropPhase=drop?.piano?.dropping?'dropping':drop?.piano?.landed?'landed':drop?.piano?.warning?'warning':'idle';status.dataset.heroFlipped=String(this.portrait.flipX);status.dataset.heroAnimation=this.portrait.anims.currentAnim?.key??'idle';status.dataset.heroAnimationRate=String(this.portrait.anims.timeScale);status.dataset.heroFilter='nearest';status.dataset.heroTexture=this.portrait.texture.key;status.dataset.timerBeeps=String(this.lastTimerBeep);status.dataset.megaJump=String(this.megaUsed);status.dataset.floor=String(this.floor);status.dataset.elapsed=String(Math.round(this.elapsedMs));status.dataset.eggStage=String(this.eggStage);status.dataset.riding=String(this.riding);status.dataset.failed=String(this.failed);status.dataset.failurePhase=this.failurePhase;status.dataset.score=String(finalScore(this.beer,this.photos,this.mishaps,this.latePhotos,this.elapsedMs,this.cheater));status.dataset.falls=String(this.mishaps.falls);status.dataset.squishes=String(this.mishaps.squishes);status.dataset.bumps=String(this.mishaps.bumps);status.dataset.won=String(this.won);status.dataset.intro='false';status.dataset.heroPlaying=String(this.heroPlaying);status.dataset.fallSound=String(this.fallSoundPlayed);if(status.textContent!==summary)status.textContent=summary;status.dataset.x=String(Math.round(this.player.x));status.dataset.y=String(Math.round(this.player.y));status.dataset.grounded=String(body.blocked.down);status.dataset.walkFrame=String(this.portrait.frame.name);status.dataset.walkFrames=[...this.visitedWalkFrames].sort().join(',');status.dataset.carrying=String(this.beer);status.dataset.sound=gameAudio.state;status.dataset.muted=String(gameAudio.muted);status.dataset.lastCue=gameAudio.lastCue;status.dataset.voiceLine=gameAudio.lastSpoken;status.dataset.voiceStatus=gameAudio.voiceStatus;status.dataset.voiceName=gameAudio.voiceName;status.dataset.loadedVoices=String(gameAudio.loadedVoiceCount);status.dataset.playedVoices=[...gameAudio.playedKinds].sort().join(',');status.dataset.locationCue=gameAudio.lastLocation;status.dataset.heardLocations=[...this.heardLocations].sort().join(',');const nearbyPiano=this.hazards.find(h=>h.kind==='piano'&&h.floor===this.floor);status.dataset.pianoDrops=String(nearbyPiano?.piano?.serial??0);status.dataset.pianoVisible=String(nearbyPiano?.art.visible??false);}
  }
  finish(){
    gameAudio.music.finishRun(this.cheater?'cheater':'success');
    (document.getElementById('pause-toggle') as HTMLButtonElement).disabled=true;
    if(this.cheater)gameAudio.speak('Cheater!','cheater');else gameAudio.play('win');this.won=true;this.player.setVelocity(0,0);this.walking=false;this.prompt.setVisible(false);this.say('Allison: “You’re home! The elevator just got fixed.”');
    this.add.rectangle(W/2,H/2,880,410,0x12253c,.98).setStrokeStyle(2,0x79dec5).setScrollFactor(0).setDepth(20);
    this.add.text(W/2,160,'26 FLOORS. SETH HAPPENED.',{fontFamily:'Arial',fontSize:'34px',fontStyle:'bold',color:'#ffd08b'}).setOrigin(.5).setScrollFactor(0).setDepth(21);
    const score=finalScore(this.beer,this.photos,this.mishaps,this.latePhotos,this.elapsedMs,this.cheater);
    this.add.text(W/2,220,`SCORE: ${score.toLocaleString()}`,{fontFamily:'Arial',fontSize:'36px',fontStyle:'bold',color:this.cheater?'#ffac8c':'#80e5ce'}).setOrigin(.5).setScrollFactor(0).setDepth(21);
    const row=(y:number,text:string,color='#d5e8ec',size=17)=>this.add.text(W/2,y,text,{fontFamily:'Arial',fontSize:size+'px',color,align:'center'}).setOrigin(.5).setScrollFactor(0).setDepth(21);
    row(270,this.cheater?'ELEVATOR SHORTCUT • CHEATER':`Time: ${(this.elapsedMs/1000).toFixed(1)}s • Time bonus: +${timeBonus(this.elapsedMs)}`,this.cheater?'#ffac8c':'#80e5ce',19);
    row(309,`Falls: ${this.mishaps.falls}  •  Squished: ${this.mishaps.squishes}  •  Bumps: ${this.mishaps.bumps}`);
    row(340,`Photos: ${this.photos.size}/2 (${this.latePhotos.size} at half value)  •  Six-pack: ${this.beer?'Delivered':'Not delivered'}`);
    row(373,this.cheater?'Fixed shortcut score: −10,000. Objectives and time bonuses do not apply.':'1,000 finish + photos + beer − mishaps + time bonus','#a8becd',15);
    row(426,'Oakey wants the box. Ellowyn has booked your lap.');
    row(465,'Hold R to question your life choices again.','#ffcf91');
    this.sharpenDisplay();this.updateHud();
    const live=document.getElementById('live-status');
    if(live){live.dataset.riding='false';live.dataset.floor=String(this.floor);live.dataset.won='true';live.dataset.score=String(score);live.textContent=`Run complete. Score ${score}. ${this.cheater?'CHEATER elevator shortcut.':''}`;}
    offerScore({score,...this.mishaps,photos:this.photos.size,latePhotos:this.latePhotos.size,beer:this.beer,elapsedMs:Math.round(this.elapsedMs),bonus:this.cheater?0:timeBonus(this.elapsedMs),cheater:this.cheater});
  }
}
const game = new Phaser.Game({type:Phaser.AUTO,parent:'game',width:W*RENDER_SCALE,height:H*RENDER_SCALE,physics:{default:'arcade',arcade:{gravity:{x:0,y:1050},debug:false}},scene:Errand,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},render:{antialias:true}});

const soundToggle=document.getElementById('sound-toggle');
soundToggle?.addEventListener('click',()=>{void gameAudio.unlock();gameAudio.toggle();(soundToggle as HTMLButtonElement).blur();});

const fullscreenToggle=document.getElementById('fullscreen-toggle') as HTMLButtonElement;
const gameElement=document.getElementById('play-area')!;
const touchViewport=installTouchViewport(gameElement,{onResize:()=>requestAnimationFrame(()=>game.scale.refresh()),onCancel:()=>touch.clear()});
async function toggleFullscreen(){
  fullscreenToggle.blur();
  try {
    if(document.fullscreenElement)await document.exitFullscreen();
    else if(gameElement.classList.contains('expanded'))gameElement.classList.remove('expanded');
    else if(gameElement.requestFullscreen)await gameElement.requestFullscreen({navigationUI:'hide'});
    else gameElement.classList.add('expanded');
  } catch {
    gameElement.classList.add('expanded');
  }
  touchViewport.sync();
  requestAnimationFrame(()=>game.scale.refresh());
}
fullscreenToggle.addEventListener('click',()=>{void toggleFullscreen();});
document.addEventListener('keydown',(event)=>{
  if(!scoresOpen()&&event.code==='KeyV'&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
    event.preventDefault();void toggleFullscreen();
  }
});
document.addEventListener('fullscreenchange',()=>{
  document.getElementById('fullscreen-recommendation')!.hidden=!!document.fullscreenElement;
  fullscreenToggle.textContent=document.fullscreenElement?'Exit full screen · V':'Full screen ⛶ · V';
  fullscreenToggle.setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen');
  requestAnimationFrame(()=>game.scale.refresh());
});
if(!document.fullscreenEnabled){
  fullscreenToggle.disabled=false;
  fullscreenToggle.title='Use expanded view in this browser.';
}

document.getElementById('fullscreen-exit')!.addEventListener('click',()=>{void toggleFullscreen();});

const touchToggle=document.getElementById('touch-toggle')!;
const touchOffer=document.getElementById('touch-offer') as HTMLDialogElement;
function setTouch(enabled:boolean){
  touch.clear();touch.enabled=enabled;
  document.getElementById('touch-controls')!.hidden=!enabled;
  gameElement.classList.toggle('touch-mode',enabled);
  touchViewport.sync();
  const radio=document.getElementById('radio')!;
  if(enabled)document.getElementById('touch-radio-slot')!.append(radio);else gameElement.insertBefore(radio,document.getElementById('game'));
  if(!enabled)(document.getElementById('touch-menu') as HTMLDialogElement).close();
  touchToggle.textContent=`Touch controls: ${enabled?'On':'Off'}`;
  touchToggle.setAttribute('aria-pressed',String(enabled));
  requestAnimationFrame(()=>game.scale.refresh());
}
touchToggle.addEventListener('click',()=>{setTouch(!touch.enabled);touchToggle.blur();});
document.getElementById('touch-accept')!.addEventListener('click',()=>{touchOffer.close();setTouch(true);void toggleFullscreen();});
document.getElementById('touch-decline')!.addEventListener('click',()=>touchOffer.close());
document.getElementById('touch-view')!.addEventListener('click',()=>{closeTouchMenu();void toggleFullscreen();});
if(navigator.maxTouchPoints>0||matchMedia('(pointer: coarse)').matches)touchOffer.showModal();
window.addEventListener('resize',()=>{touch.clear();requestAnimationFrame(()=>game.scale.refresh());});

document.querySelectorAll<HTMLButtonElement>('[data-proxy]').forEach(button=>{
  const source=document.getElementById(button.dataset.proxy!) as HTMLButtonElement;
  const sync=()=>{button.textContent=source.innerText;button.disabled=source.disabled;if(source.hasAttribute('aria-pressed'))button.setAttribute('aria-pressed',source.getAttribute('aria-pressed')!);};
  sync();new MutationObserver(sync).observe(source,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','aria-pressed']});
  button.addEventListener('click',()=>{touch.clear();if(['restart-run','high-scores'].includes(source.id))closeTouchMenu(source.id!=='restart-run');source.click();button.blur();});
});

const touchMenu=document.getElementById('touch-menu') as HTMLDialogElement;
function closeTouchMenu(resume=true){
  touchMenu.close();touch.clear();
  const scene=game.scene.scenes[0] as Errand;
  if(resume&&scene?.paused)scene.togglePause();
}
document.getElementById('touch-menu-open')!.addEventListener('click',()=>{
  const scene=game.scene.scenes[0] as Errand;
  if(!scene||scene.introActive||scoresOpen())return;
  touch.clear();if(!scene.paused&&!scene.won&&!scene.failed)scene.togglePause();
  (document.getElementById('touch-recall') as HTMLButtonElement).disabled=scene.won||scene.failed;
  touchMenu.showModal();
});
document.getElementById('touch-resume')!.addEventListener('click',()=>closeTouchMenu());
document.getElementById('touch-recall')!.addEventListener('click',()=>{closeTouchMenu();touch.edges.add('recall');});
touchMenu.addEventListener('cancel',event=>{event.preventDefault();closeTouchMenu();});
for(const type of ['keydown','keyup'])document.addEventListener(type,event=>{if(touchMenu.open)event.stopPropagation();},true);

// Control configuration is local to this browser and never touches scores.
const controlSettings=document.getElementById('control-settings') as HTMLDialogElement;
const styleSelect=document.getElementById('control-style') as HTMLSelectElement;
const spacingInput=document.getElementById('control-spacing') as HTMLInputElement;
let controlStyle='default',controlSpacing=3,customizeFromOffer=false;
try{const saved=JSON.parse(localStorage.getItem('seth-touch-controls')||'null');if(saved&&['default','slider','stick'].includes(saved.style))controlStyle=saved.style;if(Number.isInteger(saved?.spacing)&&saved.spacing>=1&&saved.spacing<=5)controlSpacing=saved.spacing;}catch{/* Defaults remain available. */}
function applyControls(){
 touch.clear();touch.style=controlStyle;
 gameElement.dataset.controlStyle=controlStyle;
 gameElement.style.setProperty('--arrow-gap',`${8+(controlSpacing-1)*8}px`);
 document.getElementById('touch-style-help')!.textContent=controlStyle==='default'?'Default arrows walk only; no sprint. Release to stop. Double-tap Jump for Mega Jump.':'Slide through the center to reverse without lifting. Release to stop. Push left/right to the edge to sprint. Double-tap Jump for Mega Jump.';
 document.getElementById('touch-arrows')!.hidden=controlStyle!=='default';
 document.getElementById('touch-stick')!.hidden=controlStyle==='default';
 document.querySelector('.touch-hint')!.textContent=controlStyle==='default'?'Left / right · release to stop':controlStyle==='stick'?'Game Stick · edges sprint':'Slide to move · edges sprint';
}
function previewControls(){document.getElementById('spacing-value')!.textContent=spacingInput.value;document.getElementById('spacing-preview')!.style.gap=`${8+(Number(spacingInput.value)-1)*8}px`;spacingInput.disabled=styleSelect.value!=='default';}
function openControls(first=false){document.getElementById('controls-save')!.textContent=first?'Save and continue':'Save controls';customizeFromOffer=first;touch.clear();styleSelect.value=controlStyle;spacingInput.value=String(controlSpacing);previewControls();controlSettings.showModal();}
document.getElementById('touch-customize-first')!.addEventListener('click',()=>{touchOffer.close();openControls(true);});
document.getElementById('touch-customize')!.addEventListener('click',()=>openControls());
spacingInput.addEventListener('input',previewControls);styleSelect.addEventListener('change',previewControls);
document.getElementById('controls-reset')!.addEventListener('click',()=>{styleSelect.value='default';spacingInput.value='3';previewControls();});
document.getElementById('controls-save')!.addEventListener('click',()=>{controlStyle=styleSelect.value;controlSpacing=Number(spacingInput.value);applyControls();try{localStorage.setItem('seth-touch-controls',JSON.stringify({style:controlStyle,spacing:controlSpacing}));}catch{/* Session controls still work. */}controlSettings.close();if(customizeFromOffer){setTouch(true);void toggleFullscreen();}});
controlSettings.addEventListener('cancel',()=>{if(customizeFromOffer)requestAnimationFrame(()=>touchOffer.showModal());});
const installHelp=document.getElementById('install-help') as HTMLDialogElement;
document.querySelectorAll('[data-install-help]').forEach(button=>button.addEventListener('click',()=>{touch.clear();installHelp.showModal();}));
document.getElementById('install-close')!.addEventListener('click',()=>installHelp.close());
for(const type of ['keydown','keyup'])document.addEventListener(type,event=>{if(controlSettings.open||installHelp.open||touchOffer.open)event.stopPropagation();},true);
document.getElementById('start-game')!.addEventListener('click',()=>{gameAudio.unlock();const scene=game.scene.scenes[0] as Errand;void scene?.startIntro();});
applyControls();
