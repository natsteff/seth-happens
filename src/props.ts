import Phaser from 'phaser';
export function soccerBall(scene:Phaser.Scene,x:number,y:number,r=9){
  const g=scene.add.graphics();g.fillStyle(0xf3f0e8).fillCircle(0,0,r);g.lineStyle(.7,0x9badae).strokeCircle(0,0,r);
  const polygon=(cx:number,cy:number,radius:number,count:number,angle:number,fill:number)=>{
    const points=Array.from({length:count},(_,i)=>new Phaser.Math.Vector2(cx+Math.cos(angle+i*Math.PI*2/count)*radius,cy+Math.sin(angle+i*Math.PI*2/count)*radius));
    g.fillStyle(fill).fillPoints(points,true);g.lineStyle(.45,0x60717a).strokePoints(points,true);return points;
  };
  const center=polygon(0,0,r*.4,5,-Math.PI/2,0x1b2936);
  center.forEach(p=>{const a=Math.atan2(p.y,p.x),ex=Math.cos(a)*r*.85,ey=Math.sin(a)*r*.85;g.lineStyle(.5,0x71828a).lineBetween(p.x,p.y,ex,ey);polygon(ex,ey,r*.22,5,a,0x243443);});
  g.fillStyle(0xffffff,.3).fillCircle(-r*.32,-r*.35,r*.2);
  return scene.add.container(x,y,[g]);
}
export function steelKeg(scene:Phaser.Scene,x:number,y:number){
  const g=scene.add.graphics();
  g.fillStyle(0x526979).fillRoundedRect(-11,-14,22,28,4);
  g.fillStyle(0x95aab5).fillRect(-9,-11,18,22);g.fillStyle(0xd4dde0).fillRect(-6,-10,4,20);g.fillStyle(0x6d8493).fillRect(5,-10,4,20);
  g.fillStyle(0xb6c7cd).fillEllipse(0,-12,21,6).fillEllipse(0,12,21,5);
  g.lineStyle(2,0x435b6c).lineBetween(-10,-8,10,-8).lineBetween(-10,8,10,8);
  g.lineStyle(1,0xe0e8e9).lineBetween(-10,-7,10,-7).lineBetween(-10,9,10,9);
  g.fillStyle(0x334e60).fillRoundedRect(-6,-14,12,3,1);g.fillStyle(0x172c3d).fillRect(-3,-14,6,2);
  return scene.add.container(x,y,[g]);
}
export function sixPack(scene:Phaser.Scene,x:number,y:number){
  const g=scene.add.graphics();
  g.fillStyle(0x102137,.3).fillEllipse(0,13,36,6);
  // Six amber glass bottles in two rows, matching Seth's tan cardboard carrier.
  for(const [row,shade] of [[-5,0x593316],[1,0x844718]]){
    for(const bx of [-10,0,10]){
      g.fillStyle(0x291b13).fillRoundedRect(bx-3.8,row-18,7.6,25,2.7);
      g.fillStyle(shade).fillRoundedRect(bx-3,row-17,6,23,2);
      g.fillStyle(0x613916).fillRect(bx-1.8,row-27,3.6,11);
      g.fillStyle(0xd5b576).fillEllipse(bx,row-27,4.5,2);
      g.fillStyle(0xf1dfb5).fillRoundedRect(bx-3,row-9,6,9,1);
      g.fillStyle(0x284a3d).fillCircle(bx,row-5,1.8);
      g.fillStyle(0xffe7a1,.35).fillRect(bx-1.9,row-22,.8,25);
    }
  }
  g.fillStyle(0x9d693b).fillRoundedRect(-18,-3,36,18,2);
  g.fillStyle(0xd1a569).fillPoints([{x:-17,y:-2},{x:11,y:1},{x:11,y:15},{x:-17,y:12}],true);
  g.fillStyle(0xb68047).fillPoints([{x:11,y:1},{x:18,y:-3},{x:18,y:11},{x:11,y:15}],true);
  g.lineStyle(4,0xbb8b50).strokeRoundedRect(-4,-28,8,26,3);
  g.lineStyle(1,0xf0c88d).lineBetween(-16,-1,9,2).lineBetween(-16,11,9,14);
  g.fillStyle(0x2b3e32).fillCircle(-3,6,5.5);
  g.lineStyle(.6,0xe9ce8e).strokeCircle(-3,6,5.5);
  g.fillStyle(0xdec077).fillEllipse(-3,6,3,5);
  return scene.add.container(x,y,[g]);
}
