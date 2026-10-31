import {radioTracks,countdownTracks,championTracks,failureTrack,cheaterTrack} from './radio-playlist.mjs';

export const jukeboxTracks=[...radioTracks,...countdownTracks,...championTracks,failureTrack,cheaterTrack];
export const DEFAULT_JUKEBOX_TRACK=jukeboxTracks.findIndex(track=>track.file==='eye-of-the-stairwell.mp3');
export const DANCES=['air-guitar','moonwalk','headspin','shuffle','standing'];
export const AFTERPARTY_TIMES={credits:20000,crowd:30000,allison:40000,solo:50000,logo:50000};
export function afterpartyPhase(ms){
 const t=AFTERPARTY_TIMES;
 return ms<t.crowd?'party':ms<t.allison?'couple':ms<t.solo?'spotlight':'jukebox';
}
export function nextDance(now,previous,random=Math.random){
 const options=DANCES.filter(dance=>dance!==previous);
 const name=options[Math.min(options.length-1,Math.floor(random()*options.length))];
 const fraction=Math.min(1,Math.max(0,random()));
 return {name,until:now+(name==='standing'?1000+fraction*1000:3000+fraction*2000)};
}
export const afterpartyCredits=[
 ['title','SETH HAPPENS!'],['subtitle','THE AFTERPARTY'],
 ['label','CREATED & DEVELOPED BY'],['name','Nate S.'],['text','OpenAI Codex'],
 ['label','ORIGINAL MUSIC'],['name','BT-AI'],['text','Featuring "Eye of the Stairwell"'],
 ['label','SPECIAL THANKS'],['name','Seth & Allison'],
 ['text','And the cats, for inspiration, likenesses, and putting up with this nonsense.'],
 ['label','ADDITIONAL SOUND & VOICE ASSETS'],
 ['text','See the GitHub repository for source credits and attribution.'],
 ['name','THANKS FOR PLAYING!'],['text','No Seths were harmed in the making of this game. Probably.']
];
