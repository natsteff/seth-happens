# Seth Happens - Beer Run, Elevator Out of Order

![Seth Happens - Beer Run, Elevator Out of Order](public/assets/title-logo.png)

<p align="center">
  <a href="https://natsteff.github.io/seth-happens/"><img src="docs/play-now.svg" width="400" alt="Play Now! Launch Seth Happens Beer Run"></a>
</p>

Fullscreen highly recommended.

One six-pack. Two photos. Twenty-six floors. Get Seth home to Allison, Oakey and Ellowyn before the three-minute deadline. See if you can find the 'easter egg'!

## Controls

| Action | Key |
| --- | --- |
| Move | A / D or ← / → |
| Jump | Space, W or ↑ jumps immediately; press twice within 0.3s for Mega Jump. Holding has no extra effect |
| Sprint | Hold Shift |
| Pause / resume | P or Pause button |
| Photo / finish | F |
| Return to a missed photo | B |
| Sound | S |
| Fullscreen | V or fullscreen button; Esc exits |
| Jump clues | C |
| Restart | Hold R |

Floor 01 is the first rooftop. Only its drop to the road is safe. Falling from any higher floor screams, costs one fall penalty, and retries that rooftop. The road stays open beneath the route.

Rolling and walking obstacles patrol the whole floor. Pianos, anvils, window AC units and beer coolers drop at distinct intervals in the middle of their platforms. Watch their warning and aftermath, then choose your jump.

## Scoring and records

- Finish within **180 seconds**: 1,000 base points.
- Each photo: +250; photos first recovered after reaching floor 26: +125.
- Deliver the six-pack: +500.
- Each fall, squish or bump: −10, counting each incident once.
- Finish under **120 seconds**: +100 for each whole second saved. A 90-second finish earns +3,000. Fractional seconds round up before calculating the bonus.
- At 180 seconds, the run fails and no score is saved.
- Intro and high-score dialogs pause the clock. P pauses gameplay, countdown, animations and audio. Resume continues from the same point.

Names and scores stay in that browser, including earlier versions’ records. The top 10 and full history show dates, times, objectives and mishaps. Clearing requires the configured password and confirmation. The browser stores a password verifier, not the readable password; this deters casual clearing but is not server authentication. Browser storage can be cleared independently.


## Screenshots

![New logo start screen](docs/screenshots/start-screen.png)
![Rooftop beer run](docs/screenshots/beer-run.png)
![Organized run details and scores](docs/screenshots/high-scores.png)

## Local development

Node 22.12+ and pnpm 11.25.0:

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

The repository uses relative asset URLs for GitHub Pages. Source is on main; the compiled playable site is on gh-pages. No backend, accounts, analytics or shared scoreboard.

Owner-supplied character references, logo and audio; generated character artwork and original code-drawn props/effects. The Minnesota United crest is owner supplied for an unofficial fan scene; no affiliation or endorsement. Raw reference photographs are not included. See [asset and dependency notices](THIRD_PARTY_NOTICES.md).
