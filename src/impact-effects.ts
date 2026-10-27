import Phaser from 'phaser';
/** Short-lived visual debris only; never creates another gameplay collision. */
export function impactEffects(scene:Phaser.Scene,kind:string,x:number,ground:number){
  const dust=scene.add.ellipse(x,ground-3,25,9,0xc7bb9c,.5).setDepth(4);
  scene.tweens.add({targets:dust,scaleX:4,scaleY:1.7,alpha:0,duration:650,onComplete:()=>dust.destroy()});
  const count=kind==='cooler'?8:kind==='anvil'?12:9;
  for(let i=0;i<count;i++){
    const g=scene.add.graphics().setDepth(4);
    if(kind==='cooler'&&i===0){g.fillStyle(0xe9eee5).fillRoundedRect(-23,-4,46,8,2);}
    else if(kind==='cooler'){
      g.fillStyle(i%2?0xc3d7df:0xdd9c3e).fillRoundedRect(-3,-6,6,12,2);
      g.fillStyle(0xe8e8db).fillEllipse(0,-5,5,2);g.fillStyle(0x294f4b).fillRect(-2,-2,4,4);
    }else if(kind==='anvil'){g.fillStyle(0xffcc66).fillRect(-2,-1,4,2);}
    else if(kind==='piano'){g.fillStyle(i%3===0?0x3b283d:0xe9e4dd).fillRect(-3,-2,i%3===0?14:8,4);}
    else{g.fillStyle(i%2?0xb4c7cf:0x657780).fillRect(-5,-2,10,4);}
    const direction=i%2?1:-1,reach=25+(i*19%95),height=kind==='anvil'?12+(i*11%28):35+(i*17%85);
    const state={t:0};g.setPosition(x,ground-4);
    scene.tweens.add({targets:state,t:1,duration:kind==='cooler'?1700:1100,onUpdate:()=>{
      g.x=x+direction*reach*state.t;
      g.y=ground-4-Math.abs(Math.sin(state.t*Math.PI*3))*height*(1-state.t);
      g.rotation=direction*state.t*(i===0?5:12);
      g.alpha=state.t>.75?(1-state.t)*4:1;
    },onComplete:()=>g.destroy()});
  }
  if(kind==='anvil'){
    const ring=scene.add.ellipse(x,ground-3,22,10).setStrokeStyle(2,0xffcf7e).setDepth(4);
    scene.tweens.add({targets:ring,scaleX:5,scaleY:2,alpha:0,duration:450,onComplete:()=>ring.destroy()});
  }
}
