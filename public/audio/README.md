# Owner-supplied voice recordings

Provided directly by Nate October 26, 2026; copied byte-for-byte from the named Downloads files. Originals untouched. Local prototype use only; no GitHub upload or public distribution authorized. No voice cloning or robotic browser TTS.

| Runtime file | Supplied file | Trigger | Duration |
| --- | --- | --- | --- |
| grunt.wav | jump.wav | Jump | 0.50s |
| fall.wav | fall.wav | Falling off a balcony | 0.89s |
| person.wav | excuse you.wav | Bumping a pedestrian/clown | 1.30s |
| beer.wav | mmm, beer.wav | Six-pack pickup | 1.85s |
| start.wav | lets go.wav | BEER RUN intro on load/restart | 3.32s |
| win.wav | great success.wav | Completed level | 1.57s |

All are mono PCM16, 44.1 kHz. Combined files: 831,866 bytes (~0.83 MB). No conversion or destructive trimming. src/voice-clips.ts resolves local files using Vite’s relative base. Decode in parallel once after audio unlock; reuse decoded AudioBuffers. MP3 conversion is unnecessary for this small set.

A browser gesture is required on first load before audio can start. The intro overlay freezes physics and disables gameplay until the actual clip-ended event, including when muted. The Sound button/S mutes both voices and original synthesized effects. Higher-priority reactions interrupt lower-priority grunts; grunts cannot cut off intro, beer, fall, collision or win lines. Voice level and small effects level use separate gain stages through the same master mute.

## Additional owner-supplied effects

| Runtime file | Supplied file | Trigger | Duration |
| --- | --- | --- | --- |
| ahh.wav | ahh sfx.wav | Random non-person collision reaction | 0.50s |
| ouch.wav | ouch sfx.wav | Random non-person collision reaction | 0.76s |
| soccer.wav | soccer chant sfx.wav | First Loon Zone arrival each run | 6.07s |
| concert.wav | guitar effect.wav | First concert arrival each run | 2.37s |
| jet.wav | jet sfx.wav | First approach to each baggage location (floors 13 and 22) each run | 2.24s |

Copied unchanged from Nate’s supplied Downloads files. The full eleven-file set totals 2,339,046 bytes (~2.34 MB). Location cues play on a separate, quieter layer so grunts and other voice reactions do not cut them off. Master mute and restart stop location playback. Per-location guards reset with the run. Object-reaction random choice excludes people and falls, which retain their dedicated clips. No format conversion was needed.

## Arrival and falling-object clips

- `hero.wav`: copied unchanged from Nate’s `my hero.wav` (1.23s). Plays once on first landing on floor 26. Delivery is locked until the actual playback-end event; mute silences it without shortening the lock. Higher priority prevents grunts interrupting the line. Restart clears the arrival gate safely.
- `squish.wav`: copied unchanged from Nate’s `squish sfx.wav`. A piano hitting Seth uses this clip instead of the ordinary object-bump reaction. Other objects keep random ouch/ahh, people keep excuse-you, and the early ledge-fall scream remains separate.

Intro autoplay is attempted immediately; browser policy may require a first gesture. S toggles all sound. Original supplied files are untouched and runtime recordings are included in the public game.

Additional owner recordings: elevator.wav (ride, arrival synchronized to end), goal.wav (Easter egg kick), crashing.wav (cooler debris), quick-jump.wav (tap jump), cheater.wav (shortcut arrival). Originals preserved.

Soundtrack: owner-supplied unmodified MP3 files in music/ (Arcade Staircase, The Beer of Destiny, Twenty-Six Floors of Celts, Go Seth Go, The Haunted Happy Hour). Runtime copies from Nate’s provided files; original intake hashes are retained privately by the project owner. No third-party download in this update. Countdown/outcome tracks are also owner supplied: The Final Warning, System Failure Imminent, Failure - Twenty-Six Floors for Nothing, Big Stupid Cheater, 26 Floors of Glory, Eye of the Stairwell. All runtime MP3s preserve supplied bytes; no Beer Delivery World Champion track is used.

Version0.3.14: Mega Jump uses owner-supplied spring-boing.wav. Former Mega Jump grunt.wav joins ouch.wav/ahh.wav in equal-third ordinary object reactions; people and squishes remain separate. Countdown/champion use fixed defaults The Final Warning/26 Floors of Glory; alternate audio files retained.

Version0.3.15: Mega Jump uses mega-jump-v2.mp3 at60%clip gain, leaving other effects unchanged. Previous spring-boing retained unused. Owner source audio preserved.
