import Phaser from 'phaser';
import './style.css';
import { offerScore, scoresOpen, resetScoreEntry } from './scoreboard';
import { gameAudio } from './audio';
import { soccerBall, steelKeg, sixPack } from './props';
import { walkLayout } from './art-layout';
import { fallingAssignments, floors, photoStops, beerSpot, isTrueFall, runScore, recordMishap, RESTART_HOLD_MS, missing, missedPhotos, photoIndicator, LEVEL_WIDTH, GROUND_Y, ROAD, pianoStep, objectImpactReaction, PIANO_TRIGGER_DISTANCE } from './mission.mjs';

const W = 1100, H = 600;
// Render at display density, retaining the same logical play area and physics.
const RENDER_SCALE = Math.min(3, Math.max(1, Math.ceil(
  Math.min(screen.width / W, screen.height / H) * window.devicePixelRatio)));

type HazardKind = 'keg' | 'ball' | 'piano' | 'anvil' | 'ac' | 'cooler' | 'partier' | 'clown' | 'cone' | 'pigeon' | 'suitcase';
type Hazard = { kind: HazardKind; floor: number; x: number; y: number; art: Phaser.GameObjects.Container; body: Phaser.Physics.Arcade.Image; warning?: Phaser.GameObjects.Text; phase: number; dropCycle?: number; piano?: {startedAt:number;readyAt:number;serial:number}; nextHonk?: number };
const isFalling=(kind:string)=>['piano','anvil','ac','cooler'].includes(kind);
class Errand extends Phaser.Scene {
  sharpObjects=new WeakSet<Phaser.GameObjects.GameObject>();
  player!: Phaser.Physics.Arcade.Sprite;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  latePhotos = new Set<number>();
  photos = new Set<number>(); warned = new Set<number>(); beer = false; won = false; retries = 0;
  hud!: Phaser.GameObjects.Text; toast!: Phaser.GameObjects.Text; prompt!: Phaser.GameObjects.Text; photoHud!: Phaser.GameObjects.Text;
  progress!: Phaser.GameObjects.Rectangle;
  crate!: Phaser.GameObjects.Container; hero!: Phaser.GameObjects.Container; portrait!: Phaser.GameObjects.Sprite;
  scorePaused=false;
  onRoad=true;beerHint!:Phaser.GameObjects.Text;
  mishaps={falls:0,squishes:0,bumps:0}; restartSince:number|null=null;
  fallSoundPlayed=false;
  heroHeard=false;heroPlaying=false;runVersion=0;
  introActive=true;introStarted=false;introOverlay!:Phaser.GameObjects.Container;introCaption!:Phaser.GameObjects.Text;
  cheatMode=false; jumpClues:Phaser.GameObjects.Container[]=[];
  heardLocations=new Set<string>();
  visitedWalkFrames=new Set<string>();
  hazards: Hazard[] = []; floor = 0; checkpoint = {x:75,y:ROAD.y-24};
  lastGround = -1000; jumpUntil = 0; immuneUntil = 0; facing = 1; walking = false;
  preload(){
    this.load.spritesheet('seth-walk','./assets/seth-walk.png',walkLayout);
    this.load.image('allison','./assets/allison.png');
    this.load.image('intro-skyline','./assets/intro-skyline.png');
    this.load.image('clown','./assets/clown.png');
    this.load.image('scruffy','./assets/scruffy-pedestrian.png');
    this.load.image('soccer-star','./assets/soccer-star.png');
    this.load.image('concert-fans','./assets/concert-fans.png');
    this.load.image('loons-logo','./assets/minnesota-united-user-supplied.png');
    this.load.image('cats','./assets/cats.png');
  }
  create() {
    resetScoreEntry();this.scorePaused=false;
    this.mishaps={falls:0,squishes:0,bumps:0};this.restartSince=null;
    this.runVersion++;this.onRoad=true;this.fallSoundPlayed=false;this.heroHeard=false;this.heroPlaying=false;
    gameAudio.beginRun();this.introActive=true;this.introStarted=false;
    this.latePhotos = new Set();
    this.photos = new Set(); this.warned = new Set(); this.beer = false; this.won = false; this.retries = 0; this.hazards=[];this.heardLocations=new Set();this.visitedWalkFrames=new Set();this.jumpClues=[];
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
    this.label(12,ROAD.y+98,'Jump onto the first rooftop →','#aec3d0',10);
    for(const f of floors){
      const slab=this.add.rectangle(f.x+f.width/2,f.y+66,f.width,132,0x344b61).setStrokeStyle(2,0x607d91);
      platforms.add(slab);
      this.add.rectangle(f.x+f.width/2,f.y+4,f.width,8,f.floor===26?0xffcc7b:0x78dbc3);
      for(let xx=f.x+22;xx<f.x+f.width-10;xx+=42) this.add.rectangle(xx,f.y+43,16,25,0xffce85,.35);
      this.label(f.x+13,f.y+76,f.floor===0?'FIRST ROOFTOP':`FLOOR ${String(f.floor).padStart(2,'0')}`, '#bdd2dc',14);
      if(f.floor>0&&f.floor<26) this.label(f.x+17,f.y+99,'↑ 26F / ELEVATOR STILL BROKEN', '#93afc3',9);
      // Clear launch stripe: jump here to clear the obstacle and reach the next balcony.
      if(f.floor<26){const clue=this.add.container(f.x+100,f.y,[this.add.rectangle(0,-3,20,6,0xffce7d),this.label(-30,12,'JUMP ↑','#ffd28d',10)]).setVisible(this.cheatMode);this.jumpClues.push(clue);}
    }
    const cats=this.textures.get('cats');
    if(!cats.has('oakey'))cats.add('oakey',0,27,146,564,964);
    if(!cats.has('ellowyn'))cats.add('ellowyn',0,634,469,614,562);
    this.decorateLevel();
    this.player=this.physics.add.sprite(75,ROAD.y-24,'body').setVisible(false).setMaxVelocity(300,850);
    this.physics.add.collider(this.player,platforms);
    this.hero=this.add.container(this.player.x,this.player.y);
    this.portrait=this.add.sprite(0,24,'seth-walk',1).setOrigin(.5,1).setDisplaySize(62,82);
    for(const [key,frames] of [['walk-empty',[0,1,2,3]],['walk-beer',[4,5,6,7]]] as const){
      if(!this.anims.exists(key))this.anims.create({key,frames:frames.map(frame=>({key:'seth-walk',frame})),frameRate:8,repeat:-1});
    }
    this.hero.add(this.portrait).setDepth(5);
    this.physics.world.setBounds(0,0,LEVEL_WIDTH,GROUND_Y+800);
    this.cameras.main.setBounds(0,300,LEVEL_WIDTH,GROUND_Y+240-300);
    this.cameras.main.startFollow(this.player,true,.12,.12,-120,90);
    this.keys=this.input.keyboard!.addKeys('A,D,W,LEFT,RIGHT,UP,SPACE,F,R,B,S,C') as Record<string,Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.addCapture(['SPACE','UP','DOWN','LEFT','RIGHT']);
    const cheatButton=document.getElementById('cheat-toggle') as HTMLButtonElement;
    cheatButton.disabled=this.introActive;
    cheatButton.onclick=()=>{this.toggleCheats();cheatButton.blur();};
    this.syncCheatButton();
    this.input.keyboard!.on('keydown',()=>{if(this.introActive){void gameAudio.unlock();void this.startIntro();}else void gameAudio.unlock();});
    this.input.on('pointerdown',()=>{if(this.introActive){void gameAudio.unlock();void this.startIntro();}else void gameAudio.unlock();});
    const pattern: [number,HazardKind][] = [[1,'keg'],[2,'cone'],[3,'partier'],[4,'ball'],[5,'pigeon'],[8,'keg'],[9,'clown'],[10,'ball'],[11,'partier'],[13,'suitcase'],[15,'ball'],[16,'cone'],[18,'clown'],[19,'keg'],[21,'pigeon'],[22,'suitcase'],[24,'ball'],[25,'partier']];
    pattern.push(...fallingAssignments as [number,HazardKind][]);
    pattern.forEach(([floor,kind])=>this.addHazard(floor,kind));
    this.add.rectangle(W/2,42,W,84,0x101e32,.97).setScrollFactor(0).setDepth(10);
    this.hud=this.label(20,13,'','#eaf3f1',16).setScrollFactor(0).setDepth(11);
    this.photoHud=this.label(20,47,'','#80e5ce',15).setScrollFactor(0).setDepth(11);
    this.label(820,49,'B • RETURN TO MISSED PHOTO','#ffcf8a',11).setScrollFactor(0).setDepth(11);
    this.add.rectangle(1000,22,150,5,0x43586b).setScrollFactor(0).setDepth(11);
    this.progress=this.add.rectangle(925,22,0,5,0x7ee0c5).setOrigin(0,.5).setScrollFactor(0).setDepth(12);
    this.toast=this.add.text(W/2,112,'Allison: “Ground floor. Beer. Two photos. Meet us at 2601. The elevator quit.”',{fontFamily:'Arial',fontSize:'15px',color:'#ffe0a3',backgroundColor:'#16283e',padding:{x:14,y:10},align:'center'}).setOrigin(.5).setScrollFactor(0).setDepth(12);
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
    const border=this.add.rectangle(W/2,H/2,750,400,0x19364b).setStrokeStyle(2,0x78dfc4);
    const skyline=this.add.image(650,175,'intro-skyline').setDisplaySize(240,130);
    const seth=this.add.image(330,460,'seth-walk',1).setOrigin(.5,1).setDisplaySize(240,320);
    const title=this.add.text(650,285,'BEER RUN',{fontFamily:'Arial',fontSize:'78px',fontStyle:'bold',color:'#ffd08b',stroke:'#102137',strokeThickness:5}).setOrigin(.5);
    const route=this.add.text(650,340,'STREET LEVEL  →  APARTMENT 2601',{fontFamily:'Arial',fontSize:'18px',color:'#84e5ce'}).setOrigin(.5);
    const joke=this.add.text(650,380,'One six-pack. Two photos.\nTwenty-six floors.',{fontFamily:'Arial',fontSize:'17px',color:'#c9dde7'}).setOrigin(.5);
    this.introCaption=this.add.text(650,445,'Starting the beer run…',{fontFamily:'Arial',fontSize:'17px',fontStyle:'bold',color:'#ffe2aa'}).setOrigin(.5);
    this.introOverlay=this.add.container(0,0,[backdrop,border,seth,skyline,title,route,joke,this.introCaption]).setScrollFactor(0).setDepth(50);
    void this.startIntro();
    if(gameAudio.state!=='running')this.introCaption.setText('Browser paused audio • click to enable sound');
  }
  async startIntro(){
    if(this.introStarted||!this.introActive)return;
    this.introStarted=true;this.introCaption.setText('LET’S GO!  •  Listen up…');
    try{await gameAudio.playIntro(()=>this.introCaption.setText('LET’S GO!  •  Listen up…'));}catch{this.say('Intro audio unavailable. The beer run must go on.');}
    if(!this.sys.isActive())return;
    this.introActive=false;this.introOverlay.destroy();
    (document.getElementById('cheat-toggle') as HTMLButtonElement).disabled=false;
    this.lastGround=-1000;this.jumpUntil=0;
    for(const key of Object.values(this.keys))key.reset();
    this.physics.world.resume();
  }
  drawCity(){
    const g=this.add.graphics();
    for(let i=0;i<70;i++){
      const x=i*116, height=230+(i*127%1400);
      g.fillStyle(i%2?0x203b56:0x24415b).fillRect(x,GROUND_Y-height,96,height+180);
      g.fillStyle(0x658294,.32);
      for(let y=GROUND_Y-height+20;y<GROUND_Y;y+=42)for(let wx=x+13;wx<x+85;wx+=26)g.fillRect(wx,y,8,13);
    }
    this.add.circle(700,650,54,0xffd99a,.8);
    this.add.rectangle(LEVEL_WIDTH/2,ROAD.y+85,LEVEL_WIDTH,170,0x172131);
    this.add.rectangle(LEVEL_WIDTH/2,ROAD.y+2,LEVEL_WIDTH,4,0x687b85);
    for(let x=0;x<LEVEL_WIDTH;x+=120)this.add.rectangle(x,ROAD.y+40,58,5,0xd4b169,.4);
    this.label(290,ROAD.y+110,'SAINT PAUL • GROUND FLOOR • NO ONE BUDGETED FOR CARDIO','#a7c0d0',13);
  }
  decorateLevel(){
    const at=(floor:number)=>floors[floor];
    this.label(20,GROUND_Y-182,'THE ONLY WAY IS UP.', '#ffce88',23);
    this.label(20,GROUND_Y-150,'Allison & the cats are waiting at 2601.', '#b9d1df',13);
    this.label(20,GROUND_Y-125,'Hold jump for height. C toggles jump clues.', '#7ee0c6',12);
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
    this.crate=sixPack(this,beerSpot.x,brew.y-8).setScale(.8);
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
    this.label(home.x+152,home.y-120,'2601','#ffcd87',26);
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
    const x=f.x+(human?196:180);let y=f.y-14,width=22,height=28;
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
    this.label(f.x+12,f.y-150,names[kind],'#ffad92',11);
    const warning=isFalling(kind)?this.label(x-43,f.y-112,'▼ DROP ZONE','#ffcc78',11):undefined;
    if(isFalling(kind)){this.add.rectangle(x,f.y-2,60,4,0xf38279);this.label(f.x+12,f.y-126,'BAIT THE DROP. THEN GO.','#a8c4d0',10);}
    this.hazards.push({kind,floor,x,y,art,body,warning,phase:floor*131});
  }
  toggleCheats(){this.cheatMode=!this.cheatMode;this.jumpClues.forEach(clue=>clue.setVisible(this.cheatMode));this.syncCheatButton();}
  syncCheatButton(){const button=document.getElementById('cheat-toggle');if(button){button.textContent=`Cheat mode: ${this.cheatMode?'On':'Off'} · C`;button.setAttribute('aria-pressed',String(this.cheatMode));}}
  say(t:string){this.toast.setText(t);}
  retry(time:number,reason:string,reaction:'fall'|'person'|'object'|'squish'='object'){
    this.mishaps=recordMishap(this.mishaps,reaction);
    this.retries++;(this.player.body as Phaser.Physics.Arcade.Body).reset(this.checkpoint.x,this.checkpoint.y);this.player.setVelocity(0,0);this.immuneUntil=time+1400;this.lastGround=-1000;this.jumpUntil=0;
    gameAudio.play('impact');if(reaction==='fall'&&!this.fallSoundPlayed)gameAudio.speak('Aaaaaah!','fall');if(reaction==='squish')gameAudio.speak('Squish!','squish');if(reaction==='person')gameAudio.speak('Well, excuse you.','person');if(reaction==='object'){const kind=objectImpactReaction(Math.random());gameAudio.speak(kind==='ouch'?'Ouch!':'Ahh!',kind);}this.cameras.main.shake(100,.003);this.say(reason+' Beer and photos saved. C toggles jump clues.');this.fallSoundPlayed=false;
  }
  update(time:number){
    if(!this.player)return;
    if(scoresOpen()){this.physics.world.pause();this.input.keyboard!.enabled=false;this.scorePaused=true;return;}
    if(this.scorePaused){this.input.keyboard!.enabled=true;this.scorePaused=false;for(const key of Object.values(this.keys))key.reset();if(!this.introActive)this.physics.world.resume();}
    if(Phaser.Input.Keyboard.JustDown(this.keys.S))gameAudio.toggle();
    if(this.introActive){const status=document.getElementById('live-status');if(status){status.textContent=`BEER RUN intro. ${gameAudio.state==='running'?'Playing Let’s go. Gameplay locked.':'Browser autoplay paused. Click to enable sound. Gameplay locked.'}`;status.dataset.intro='true';status.dataset.x=String(Math.round(this.player.x));status.dataset.y=String(Math.round(this.player.y));status.dataset.loadedVoices=String(gameAudio.loadedVoiceCount);status.dataset.voiceLine=gameAudio.lastSpoken;status.dataset.voiceStatus=gameAudio.voiceStatus;status.dataset.muted=String(gameAudio.muted);}return;}
    if(Phaser.Input.Keyboard.JustDown(this.keys.C))this.toggleCheats();
    if(this.keys.R.isDown){
      this.restartSince??=time;
      if(time-this.restartSince>=RESTART_HOLD_MS){this.scene.restart();return;}
    }else this.restartSince=null;
    const body=this.player.body as Phaser.Physics.Arcade.Body;
    if(!this.won){
      const missed=missedPhotos(this.player.x,this.photos);
      if(Phaser.Input.Keyboard.JustDown(this.keys.B)&&missed.length){
        const stop=photoStops[missed[0]],f=floors[stop.floor];
        body.reset(f.x+65,f.y-24);this.player.setVelocity(0,0);this.floor=f.floor;this.onRoad=false;this.checkpoint={x:f.x+45,y:f.y-24};this.immuneUntil=time+1000;
        this.say('CAMERA STRAP EXPRESS: back to the missed shot. Press F at the sign.');
      }
      const direction=Number(this.keys.D.isDown||this.keys.RIGHT.isDown)-Number(this.keys.A.isDown||this.keys.LEFT.isDown);
      this.player.setVelocityX(direction*275);this.walking=direction!==0&&body.blocked.down;if(direction)this.facing=direction;
      if(body.blocked.down){
        this.lastGround=time;
        const landed=[ROAD,...floors].find(f=>this.player.x>f.x+8&&this.player.x<f.x+f.width-8&&Math.abs(body.bottom-f.y)<8);
        if(landed){this.fallSoundPlayed=false;this.onRoad=landed.floor===-1;this.floor=Math.max(0,landed.floor);this.checkpoint={x:landed.x+50,y:landed.y-24};}
      }
      if(['W','UP','SPACE'].some(k=>Phaser.Input.Keyboard.JustDown(this.keys[k])))this.jumpUntil=time+130;
      if(this.jumpUntil>time&&time-this.lastGround<110){gameAudio.play('jump');this.player.setVelocityY(-520);this.jumpUntil=0;this.lastGround=-1000;}
      if(!['W','UP','SPACE'].some(k=>this.keys[k].isDown)&&body.velocity.y < -230)this.player.setVelocityY(-230);
      this.player.x=Phaser.Math.Clamp(this.player.x,14,LEVEL_WIDTH-14);
      if(!this.fallSoundPlayed&&isTrueFall(body.bottom,this.onRoad?ROAD.y:floors[this.floor].y,body.velocity.y)){this.fallSoundPlayed=true;gameAudio.speak('Aaaaaah!','fall');}
      if(this.player.y>(this.onRoad?ROAD.y:floors[this.floor].y)+290)this.retry(time,'Gravity got the shot.','fall');
      for(const h of this.hazards){
        let x=h.x,y=h.y,active=true;
        if(h.kind==='ball')x+=Math.sin((time+h.phase)/430)*27;
        if(h.kind==='partier')x+=Math.sin((time+h.phase)/580)*18;
        if(h.kind==='suitcase')x+=Math.sin((time+h.phase)/650)*23;
        if(h.kind==='pigeon'){x+=Math.sin((time+h.phase)/370)*19;y-=Math.max(0,Math.sin((time+h.phase)/470))*17;}
        if(h.kind==='clown'){
          x+=Math.sin((time+h.phase)/620)*12;y-=Math.abs(Math.sin((time+h.phase)/480))*5;
          if(Math.abs(this.player.x-x)<210&&time>(h.nextHonk??0)){gameAudio.play('clown');h.nextHonk=time+4500;}
        }
        if(isFalling(h.kind)){
          const inRange=Math.abs(this.player.x-h.x)<PIANO_TRIGGER_DISTANCE&&Math.abs(this.player.y-(floors[h.floor].y-24))<150;
          const motion=pianoStep(h.piano??{startedAt:-Infinity,readyAt:0,serial:0},time,inRange);
          h.piano=motion;y=h.y+motion.offset;active=motion.dropping;
          h.warning!.setVisible(motion.dropping).setText('▼ MOVE!').setColor('#ff8d82');
          h.art.setVisible(motion.dropping);
          if(motion.dropping&&motion.offset>0&&h.dropCycle!==motion.serial){h.dropCycle=motion.serial;gameAudio.play('piano');}
        }
        h.art.setPosition(x,y);h.body.body!.reset(x,y);
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
      if(Phaser.Input.Keyboard.JustDown(this.keys.F)){
        if(stop>=0&&!this.photos.has(stop)){this.photos.add(stop);if(this.heroHeard)this.latePhotos.add(stop);gameAudio.play('photo');this.cameras.main.flash(140,255,255,255);this.say(`PHOTO SAVED • +${this.latePhotos.has(stop)?125:250} points • ${photoStops[stop].caption}`);}
        else if(home&&!this.heroPlaying)this.finish();
      }
      for(const i of missedPhotos(this.player.x,this.photos))if(!this.warned.has(i)){
        this.warned.add(i);gameAudio.play('miss');this.say(`MISSED PHOTO: ${photoStops[i].short.toUpperCase()}! Press B to return. Watch the persistent photo tracker.`);this.cameras.main.flash(180,255,135,60);
      }
    }
    this.hero.setPosition(this.player.x,this.player.y);
    const anim=this.beer?'walk-beer':'walk-empty';
    if(this.walking&&!this.won){this.portrait.play(anim,true);this.visitedWalkFrames.add(String(this.portrait.frame.name));}
    else{this.portrait.stop();this.portrait.setFrame(this.beer?(body.blocked.down?5:4):(body.blocked.down?1:0));}
    this.portrait.setFlipX(this.facing<0).setY(24);
    this.hero.setAlpha(time<this.immuneUntil?(Math.floor(time/100)%2?.35:1):1);
    this.progress.width=150*this.floor/26;
    this.hud.setText(`GROUND → 26F     ${this.onRoad?'ROAD':this.floor===0?'FIRST ROOFTOP':`FLOOR ${this.floor} / 26`}     ${missing(this.beer,this.photos)}     •     mishaps ${this.retries}`);
    const indicator=photoIndicator(this.player.x,this.photos),hasMissed=missedPhotos(this.player.x,this.photos).length>0;
    this.photoHud.setText(indicator).setColor(hasMissed?'#ffac8c':'#80e5ce');
    const status=document.getElementById('live-status');
    const summary=`${this.hud.text}. ${indicator}. ${this.toast.text}${this.won?' Mission complete.':''}`;
    if(status){status.dataset.score=String(runScore(this.beer,this.photos,this.mishaps,this.latePhotos));status.dataset.falls=String(this.mishaps.falls);status.dataset.squishes=String(this.mishaps.squishes);status.dataset.bumps=String(this.mishaps.bumps);status.dataset.won=String(this.won);status.dataset.intro='false';status.dataset.heroPlaying=String(this.heroPlaying);status.dataset.fallSound=String(this.fallSoundPlayed);if(status.textContent!==summary)status.textContent=summary;status.dataset.x=String(Math.round(this.player.x));status.dataset.y=String(Math.round(this.player.y));status.dataset.grounded=String(body.blocked.down);status.dataset.walkFrame=String(this.portrait.frame.name);status.dataset.walkFrames=[...this.visitedWalkFrames].sort().join(',');status.dataset.carrying=String(this.beer);status.dataset.sound=gameAudio.state;status.dataset.muted=String(gameAudio.muted);status.dataset.lastCue=gameAudio.lastCue;status.dataset.voiceLine=gameAudio.lastSpoken;status.dataset.voiceStatus=gameAudio.voiceStatus;status.dataset.voiceName=gameAudio.voiceName;status.dataset.loadedVoices=String(gameAudio.loadedVoiceCount);status.dataset.playedVoices=[...gameAudio.playedKinds].sort().join(',');status.dataset.locationCue=gameAudio.lastLocation;status.dataset.heardLocations=[...this.heardLocations].sort().join(',');status.dataset.cheatMode=String(this.cheatMode);status.dataset.jumpClues=String(this.jumpClues.filter(clue=>clue.visible).length);const nearbyPiano=this.hazards.find(h=>h.kind==='piano'&&h.floor===this.floor);status.dataset.pianoDrops=String(nearbyPiano?.piano?.serial??0);status.dataset.pianoVisible=String(nearbyPiano?.art.visible??false);}
  }
  finish(){
    gameAudio.play('win');this.won=true;this.player.setVelocity(0,0);this.walking=false;this.prompt.setVisible(false);this.say('Allison: “You’re home! The elevator just got fixed.”');
    this.add.rectangle(W/2,H/2+15,850,330,0x12253c,.98).setStrokeStyle(2,0x79dec5).setScrollFactor(0).setDepth(20);
    this.add.text(W/2,205,'26 FLOORS. SETH HAPPENED.',{fontFamily:'Arial',fontSize:'35px',fontStyle:'bold',color:'#ffd08b'}).setOrigin(.5).setScrollFactor(0).setDepth(21);
    const score=runScore(this.beer,this.photos,this.mishaps,this.latePhotos);
    this.add.text(W/2,270,`SCORE: ${score.toLocaleString()} / 2,000`,{fontFamily:'Arial',fontSize:'30px',fontStyle:'bold',color:'#80e5ce'}).setOrigin(.5).setScrollFactor(0).setDepth(21);
    const stats=`Falls: ${this.mishaps.falls}  •  Squished: ${this.mishaps.squishes}  •  Bumps: ${this.mishaps.bumps}
Photos: ${this.photos.size}/2 (${this.latePhotos.size} at half value)  •  Six-pack: ${this.beer?'Delivered':'Not delivered'}
1,000 finish + 250/photo (125 recovered) + 500/beer − 10/mishap

Oakey wants the box. Ellowyn has booked your lap.
Hold R to question your life choices again.`;
    this.add.text(W/2,365,stats,{fontFamily:'Arial',fontSize:'17px',color:'#d5e8ec',align:'center',lineSpacing:9}).setOrigin(.5).setScrollFactor(0).setDepth(21);
    this.sharpenDisplay();
    offerScore({score,...this.mishaps,photos:this.photos.size,latePhotos:this.latePhotos.size,beer:this.beer});
  }
}
const game = new Phaser.Game({type:Phaser.AUTO,parent:'game',width:W*RENDER_SCALE,height:H*RENDER_SCALE,physics:{default:'arcade',arcade:{gravity:{x:0,y:1050},debug:false}},scene:Errand,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},render:{antialias:true}});

const soundToggle=document.getElementById('sound-toggle');
soundToggle?.addEventListener('click',()=>{void gameAudio.unlock();gameAudio.toggle();(soundToggle as HTMLButtonElement).blur();});

const fullscreenToggle=document.getElementById('fullscreen-toggle') as HTMLButtonElement;
const gameElement=document.getElementById('game')!;
async function toggleFullscreen(){
  fullscreenToggle.blur();
  try {
    if(document.fullscreenElement)await document.exitFullscreen();
    else await gameElement.requestFullscreen();
  } catch {
    fullscreenToggle.textContent='Fullscreen unavailable';
  }
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
  fullscreenToggle.disabled=true;
  fullscreenToggle.title='Fullscreen is unavailable in this browser. Open the game in a regular browser window.';
}

document.getElementById('fullscreen-exit')!.addEventListener('click',()=>{void document.exitFullscreen();});
