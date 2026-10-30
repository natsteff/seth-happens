export const FORGOT_BEER='You forgot the beer! Allison is very disappointed in you, go back.';
export function missionAction({beerInReach,photoInReach,home,beer,missed,heroPlaying}){
 if(beerInReach)return 'beer';
 if(photoInReach)return 'photo';
 if(home){if(!beer)return 'missing-beer';if(heroPlaying)return 'wait';return missed?'finish-choice':'finish';}
 return missed?'recall':null;
}

export function summitSignals({home,beer,reached,heroHeard}){return {reached:reached||home,playHero:home&&beer&&!heroHeard};}
