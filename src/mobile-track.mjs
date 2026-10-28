// Number only the five gameplay stations; outcome/countdown tracks have names.
export function mobileTrackLabel(radio){
 const prefix=radio.countdown?'Countdown · ':radio.outcome==='success'?'Champion · ':radio.outcome==='failure'?'Failure · ':radio.outcome==='cheater'?'Shortcut · ':`${radio.selected+1} · `;
 const state=!radio.enabled?'Music off':radio.muted?'Muted':radio.volume===0?'Volume 0%':radio.status==='Paused'?'Paused':radio.status==='Starts after intro'?'Starts after intro':radio.status==='Finished'?'Finished':radio.error?'Audio unavailable':radio.audio?.paused?'Waiting for audio':'';
 return `${prefix}${radio.track.title}${state?`\n${state}`:''}`;
}
