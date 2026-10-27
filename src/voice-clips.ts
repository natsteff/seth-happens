/** Owner-provided local WAV recordings. Originals remain untouched in Downloads. */
export type VoiceReaction = 'grunt' | 'fall' | 'person' | 'beer' | 'start' | 'win' | 'ouch' | 'ahh' | 'hero' | 'squish' | 'quick' | 'cheater';
export type LocationCue = 'soccer' | 'concert' | 'jet' | 'goal' | 'crashing' | 'elevator';
export type AudioClip = VoiceReaction | LocationCue;
const base = `${import.meta.env.BASE_URL}audio/`;
export const voiceClips: Record<VoiceReaction,string> = {
  quick: `${base}quick-jump.wav`,
  cheater: `${base}cheater.wav`,
  grunt: `${base}grunt.wav`,
  fall: `${base}fall.wav`,
  person: `${base}person.wav`,
  beer: `${base}beer.wav`,
  start: `${base}start.wav`,
  win: `${base}win.wav`,
  ouch: `${base}ouch.wav`,
  ahh: `${base}ahh.wav`,
  hero: `${base}hero.wav`,
  squish: `${base}squish.wav`,
};

export const locationClips: Record<LocationCue,string> = { goal:`${base}goal.wav`, crashing:`${base}crashing.wav`, elevator:`${base}elevator.wav`, soccer:`${base}soccer.wav`, concert:`${base}concert.wav`, jet:`${base}jet.wav` };
export const recordedClips = { ...voiceClips, ...locationClips };
