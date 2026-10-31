import {AFTERPARTY_TIMES} from './afterparty-model.mjs';
type Crop=[number,number,number,number];
type Art={image:HTMLImageElement;crop?:Crop};
/** Generated venue and whole-body dance atlases; other characters reuse shipped art. */
export class AfterpartyArt{
 private images=new Map<string,HTMLImageElement>();
 private ctx:CanvasRenderingContext2D;
 private width=1100;private height=600;
 private frames=new Map<string,{crop:Crop;scale:number}[]>();
 constructor(private canvas:HTMLCanvasElement){this.ctx=canvas.getContext('2d')!;}
 async load(){
  const files=['allison','clown','scruffy-pedestrian','soccer-star','concert-fans','cats','title-logo','venue-dj','dance-air-guitar','dance-moonwalk','dance-headspin','dance-shuffle','dance-standing'];
  const results=await Promise.allSettled(files.map(async key=>{
   const path=key.startsWith('dance-')?`afterparty/seth-${key.slice(6)}-v1`:key.startsWith('venue-')?`afterparty/${key}-v2`:key;
   const img=new Image();img.src=new URL(`./assets/${path}.png`,document.baseURI).href;
   await img.decode();this.images.set(key,img);if(key.startsWith('dance-'))this.prepareFrames(key,img);
  }));
  return results.every(result=>result.status==='fulfilled');
 }
 resize(){
  const rect=this.canvas.getBoundingClientRect(),density=Math.min(2,window.devicePixelRatio||1);
  this.canvas.width=Math.max(1,Math.round(rect.width*density));this.canvas.height=Math.max(1,Math.round(rect.height*density));
  this.width=1100;this.height=600;
 }
 private image(key:string,crop?:Crop):Art|undefined{const image=this.images.get(key);return image?{image,crop}:undefined;}
 private sprite(art:Art|undefined,x:number,y:number,w:number,h:number,angle=0,flip=false){
  if(!art)return;const c=this.ctx;c.save();c.translate(x,y);c.rotate(angle);if(flip)c.scale(-1,1);
  const crop=art.crop??[0,0,art.image.width,art.image.height];c.drawImage(art.image,...crop,-w/2,-h,w,h);c.restore();
 }
 private text(text:string,x:number,y:number,size:number,color='#a9f7e7'){
  const c=this.ctx;c.fillStyle=color;c.font=`bold ${size}px Arial`;c.textAlign='center';c.fillText(text,x,y);
 }
 private prepareFrames(key:string,img:HTMLImageElement){
  const sheet=document.createElement('canvas');sheet.width=img.width;sheet.height=img.height;
  const context=sheet.getContext('2d',{willReadFrequently:true})!;context.drawImage(img,0,0);
  const pixels=context.getImageData(0,0,img.width,img.height).data,frames:{crop:Crop;scale:number}[]=[];
  for(let frame=0;frame<12;frame++){
   const left=Math.round(frame%4*img.width/4),right=Math.round((frame%4+1)*img.width/4);
   const top=Math.round(Math.floor(frame/4)*img.height/3),bottom=Math.round((Math.floor(frame/4)+1)*img.height/3);
   let minX=right,minY=bottom,maxX=left,maxY=top;
   for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(pixels[(y*img.width+x)*4+3]>96){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
   frames.push({crop:maxX>=minX&&maxY>=minY?[minX,minY,maxX-minX+1,maxY-minY+1]:[left,top,right-left,bottom-top],scale:1});
  }
  const tallest=Math.max(...frames.map(frame=>frame.crop[3]));
  for(const frame of frames)frame.scale=230/tallest;
  this.frames.set(key,frames);sheet.width=sheet.height=1;
 }
 private seth(x:number,y:number,mode:string,t:number,reduced:boolean){
  const key=`dance-${mode}`,frames=this.frames.get(key),img=this.images.get(key);if(!frames||!img)return;
  const speed=mode==='standing'?6:12,frame=frames[reduced?0:Math.floor(t*speed)%frames.length];
  const c=this.ctx,scale=frame.scale;
  // Use complete authored poses with a common scale and a floor-aligned anchor.
  c.fillStyle='#0007';c.beginPath();c.ellipse(x,y+3,56,9,0,0,Math.PI*2);c.fill();
  c.drawImage(img,...frame.crop,x-frame.crop[2]*scale/2,y-frame.crop[3]*scale,frame.crop[2]*scale,frame.crop[3]*scale);
 }
 private finalLogo(){
  const c=this.ctx,img=this.images.get('title-logo');if(!img)return;
  const w=this.width,h=this.height,available=Math.max(100,h-155);
  const scale=Math.min(w*.94/img.width,available/img.height),width=img.width*scale,height=img.height*scale;
  const top=(h-height)/2;c.drawImage(img,(w-width)/2,top,width,height);
  this.text('THE AFTERPARTY NEVER REALLY ENDS',w/2,Math.max(40,top-24),32,'#c7a9ff');this.text('PICK A TRACK. STAY A WHILE.',w/2,Math.min(h-18,top+height+47),32,'#a4f4df');
 }
 private crowd(t:number,y:number,depart:number,reduced:boolean){
  // Three clowns and four drunks total, plus the soccer star and both fans.
  const people:[string,Crop|undefined,number,number,number][]=[
   ['clown',undefined,140,155,-85],['scruffy-pedestrian',undefined,245,145,-80],
   ['clown',undefined,905,155,-85],['scruffy-pedestrian',undefined,1020,145,-75],
   ['scruffy-pedestrian',undefined,805,145,-75],
   ['scruffy-pedestrian',undefined,85,155,0],['clown',undefined,285,180,5],
   ['soccer-star',undefined,850,167,25],['concert-fans',[180,9,525,979],985,175,25],
   ['concert-fans',[851,11,448,985],755,165,10]
  ];
  for(let i=0;i<people.length;i++){
   const [key,crop,base,h,offset]=people[i],s=reduced?0:Math.sin(t*3+i);
   const x=base+(base<550?-1:1)*depart*700+s*13;
   this.sprite(this.image(key,crop),x,y+offset-Math.abs(s)*5,h*.58,h,s*.035,i%2===1);
  }
 }
 render(ms:number,phase:string,dance:string,reduced:boolean){
  const c=this.ctx,w=this.width,h=this.height,t=(reduced?0:ms)/1000;
  c.setTransform(1,0,0,1,0,0);c.fillStyle='#000';c.fillRect(0,0,this.canvas.width,this.canvas.height);
  const scale=Math.min(this.canvas.width/w,this.canvas.height/h);c.setTransform(scale,0,0,scale,(this.canvas.width-w*scale)/2,(this.canvas.height-h*scale)/2);
  if(phase==='jukebox'){this.finalLogo();return;}
  const lit=phase!=='spotlight';
  if(lit){
   const bg=this.images.get('venue-dj');
   if(bg){const fit=Math.max(w/bg.width,h/bg.height);c.drawImage(bg,(w-bg.width*fit)/2,(h-bg.height*fit)/2,bg.width*fit,bg.height*fit);}
   const departure=Math.max(0,Math.min(1,(ms-(AFTERPARTY_TIMES.crowd-800))/800));
   if(phase==='party'){
    this.sprite(this.image('cats',[27,146,564,964]),280-departure*620,h*.68,38,65);
    this.sprite(this.image('cats',[634,469,614,562]),810+departure*620,h*.68,64,59);
    this.crowd(t,h*.90,departure,reduced);
   }
   const leave=phase==='couple'?Math.max(0,Math.min(1,(ms-(AFTERPARTY_TIMES.allison-1800))/1800)):0;
   this.sprite(this.image('allison'),690+leave*510,h*.92,130,202,reduced?0:Math.sin(t*3.5)*.035,dance==='headspin');
   if(dance==='headspin'&&leave===0){c.fillStyle='#14273fe8';c.fillRect(720,h*.92-245,142,38);this.text('…Seth?',791,h*.92-219,23,'#ffd38a');}
  }else{
   const alpha=Math.min(1,Math.max(0,(ms-(AFTERPARTY_TIMES.allison+500))/650));c.fillStyle=`rgba(255,237,189,${alpha*.13})`;
   c.beginPath();c.moveTo(550,0);c.lineTo(380,h*.93);c.lineTo(690,h*.93);c.closePath();c.fill();
   c.fillStyle=`rgba(255,237,189,${alpha*.13})`;c.beginPath();c.ellipse(535,h*.92,150,25,0,0,Math.PI*2);c.fill();
   if(alpha===0)return;c.globalAlpha=alpha;
  }
  this.seth(530,h*.92,dance,t,reduced);c.globalAlpha=1;
 }
}
