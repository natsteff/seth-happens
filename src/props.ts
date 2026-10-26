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
  for(const row of [-3,2])for(const bx of [-7,0,7]){
    g.fillStyle(row===-3?0x653b16:0x91521d).fillRoundedRect(bx-2.8,row-10,5.6,14,1.6).fillRect(bx-1.6,row-16,3.2,7);
    g.fillStyle(0xd7bc74).fillRect(bx-1.9,row-17,3.8,2);g.fillStyle(0xf1dfaf).fillRect(bx-2.2,row-6,4.4,6);g.fillStyle(0xffffff,.3).fillRect(bx-1.2,row-14,.8,14);
  }
  g.fillStyle(0xad7945).fillRoundedRect(-12,-3,24,13,2);g.fillStyle(0xd6aa70).fillRect(-10,-2,19,10);
  g.lineStyle(3,0xc99c63).strokeRoundedRect(-4,-18,8,17,3);g.lineStyle(.5,0xf2d5a5).lineBetween(-10,0,9,0);
  g.fillStyle(0x294f4b).fillRoundedRect(-6,2,12,5,1);
  return scene.add.container(x,y,[g]);
}
