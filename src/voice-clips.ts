/** Owner-provided local WAV recordings. Originals remain untouched in Downloads. */
export type VoiceReaction = 'grunt' | 'fall' | 'person' | 'beer' | 'start' | 'win' | 'ouch' | 'ahh' | 'hero' | 'squish';
export type LocationCue = 'soccer' | 'concert' | 'jet';
export type AudioClip = VoiceReaction | LocationCue;
const base = `${import.meta.env.BASE_URL}audio/`;
export const voiceClips: Record<VoiceReaction,string> = {
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

export const locationClips: Record<LocationCue,string> = { soccer:`${base}soccer.wav`, concert:`${base}concert.wav`, jet:`${base}jet.wav` };
export const recordedClips = { ...voiceClips, ...locationClips };
