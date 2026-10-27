export const radioTracks=[
 {title:'Arcade Staircase',description:'High-energy arcade electronica',file:'arcade-staircase.mp3'},
 {title:'The Beer of Destiny',description:'Cinematic gothic folk & punk',file:'beer-of-destiny.mp3'},
 {title:'Twenty-Six Floors of Celts',description:'Celtic punk & folk metal',file:'twenty-six-floors-of-glory.mp3'},
 {title:'Go Seth Go',description:'Gothic Americana & punk',file:'go-seth-go.mp3'},
 {title:'The Haunted Happy Hour',description:'Dark swing & gothic cabaret',file:'haunted-happy-hour.mp3'}
];
export const DEFAULT_RADIO_TRACK=0;
export function nextRadioTrack(index,step){return ((index+step)%radioTracks.length+radioTracks.length)%radioTracks.length;}
export function radioShortcut(code){
 if(code==='Digit0'||code==='Numpad0')return {off:true};
 const digit=/^(?:Digit|Numpad)([1-5])$/.exec(code);
 if(digit)return {track:Number(digit[1])-1};
 if(code==='BracketLeft')return {step:-1};
 if(code==='BracketRight')return {step:1};
 return null;
}

export const countdownTracks=[{title:'The Final Warning',description:'Final countdown',file:'the-final-warning.mp3'},{title:'System Failure Imminent',description:'Final countdown',file:'system-failure-imminent.mp3'}];

export const championTracks=[{title:'26 Floors of Glory',description:'Champion Track',file:'26-floors-of-glory.mp3'},{title:'Eye of the Stairwell',description:'Champion Track',file:'eye-of-the-stairwell.mp3'}];
export const failureTrack={title:'Failure - Twenty-Six Floors for Nothing',description:'Time’s up',file:'failure-twenty-six-floors-for-nothing.mp3'};
export const cheaterTrack={title:'Big Stupid Cheater',description:'Elevator shortcut',file:'big-stupid-cheater.mp3'};
