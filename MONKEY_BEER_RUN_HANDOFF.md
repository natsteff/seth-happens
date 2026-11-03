# Seth Happens → The Great Monkey Beer Run

Technical handoff for **The Great Monkey Beer Run: Lil' G in Eau Claire**.
Prepared November 3, 2026 against Seth Happens **v1.0.12**.
Owner/developer attribution: **Nate S**.

## Recommendation: A — independent copy of the clean web game

Copy the clean public Seth Happens repository as the starting foundation for a
new, independently maintained Phaser web game. Keep menus, input, audio and
persistence working together initially; replace the route and game-specific
presentation incrementally. Do not extract a shared engine/library now.

This is faster than individually transplanting interdependent DOM/module code.
The main scene is **not** a plug-in level engine: replacing its gameplay is real
work. Small helper modules are reusable; the complete game is not fully modular.

**Godot boundary:** this recommendation assumes the Monkey project wants a
Phaser/browser implementation. Godot scenes, GDScript, resources and physics do
not execute in Phaser. Reuse exported PNG/audio assets and redraw/reimplement
scene logic. If preserving the existing Godot runtime is a requirement, choose B:
port selected behavior/designs into Godot instead. Do not replace a working Godot
project without Nate's agreement. Its repository/assets were not inspected here.

Keep the Monkey game's own artwork, backgrounds, characters, sprites and logos.
Do not replace those with Seth art or assume identical sprite-sheet geometry.

## Source and acquisition

- Repository: https://github.com/natsteff/seth-happens
- Stable starting point: tag `v1.0.12` (game source commit `061a15e`).
- Download: https://github.com/natsteff/seth-happens/archive/refs/tags/v1.0.12.zip
- Source browser: https://github.com/natsteff/seth-happens/tree/v1.0.12
- Live reference: https://natsteff.github.io/seth-happens/
- Local source workspace: `/Users/nate/Documents/ChatGPT/Abu - 2D Platform Game Development/`
- Clean local source: `.public-release/` within that workspace.
- Clean built site: `.public-release/dist/` (separate `gh-pages` checkout).

Start from the tagged **public source**, not the private workspace/history or the
compiled `gh-pages` branch. Make a fresh Monkey repository with its own remote.
Never push a Monkey change to the Seth remote. Do not copy private AGENTS,
queues/logs, local Firebase backups, reference photographs, credentials or caches.
Preserve applicable licenses and third-party notices; copied artwork/audio has
separate rights/provenance and is not automatically approved for reuse.

## Stack and layout

`package.json` declares:

- Runtime: Phaser `3.90.0`, Firebase `^13.1.0`.
- Build: TypeScript `7.0.2`, Vite `8.3.5`, ES modules.
- Node `>=22.13.0`; pnpm `11.25.0`; committed `pnpm-lock.yaml`.
- Tests: Node's test runner; fake IndexedDB and Firebase rules/emulator tooling.
- Firebase Admin/CLI are development/owner tools, not a browser server.

```text
index.html                 DOM menus, settings, touch controls and bootstrap
src/main.ts                Errand scene + application/menu/input orchestration
src/style.css              desktop/mobile UI, dialogs and control positioning
src/mission.mjs            Seth route constants, scoring and objective helpers
src/controller.mjs         controller sampling and keyboard movement arbitration
src/touch.mjs              touch actions, sliding movement and quick sprint
src/preferences.mjs        validated persistent audio/update preferences
src/audio.ts, src/music.ts  effects/voice and music playback
src/scoreboard.ts           record-book UI and save orchestration
src/scores.mjs              local validation, ranking, backup and retention
public/                    assets, audio, icons, config, manifest, version metadata
firebase/                  deployed game's Firestore rules/index definitions
server/                    optional Node/JSON score API; not used by Pages
scripts/                   owner-only Firebase migration/report tools
tests/                    focused model/input/storage/security tests
```

Related module paths below identify dependencies to carry with a full copy;
only the 12 core files listed under Review limits received fresh inspection.

## Implemented systems and entry points

| System | Actual implementation / entry point | Reuse decision |
|---|---|---|
| Start/menu | `src/main.ts`, `Errand.create()`, `startIntro()`, `positionStartGame()`; matching IDs in `index.html` | Keep the DOM shell and explicit start gesture; replace title/intro/content. No general scene-based main-menu framework. |
| Pause | `Errand.togglePause()`; `openTouchMenu()` / `closeTouchMenu()` around main.ts lines 845–885 | Pauses physics/tweens/audio; update path stops normal timer advancement. Keep coordinated lifecycle, not just a visual overlay. |
| End screens | `Errand.failRun()`, `finish()` and `offerScore()` call site | Implemented, but timeout animation, victory and elevator outcomes are Seth-specific. Replace presentation and end conditions. |
| Settings | `src/preferences.mjs`: `readPreferences`, `savePreferences`, `loadSettings`, `saveSettings` | Good small reusable validation/persistence pattern; rename keys and track-specific constraints. |
| Keyboard | `main.ts` `create()` around line 150 and `update()` around line 561 | Implemented in scene, not a generic action-binding editor. Preserve focus/dialog guards while replacing action mappings. |
| Gamepad | `src/controller.mjs`: `ControllerInput.sample()`, `keyboardOrControllerMove()` | Standard browser gamepad axes/buttons, neutral latch and disconnect handling. Physical mapping acceptance is incomplete. |
| Touch | `src/touch.mjs`: `TouchInput.sample()`, `SlidingMovement`, `QuickSprint`; main.ts `setTouch()` / `applyControls()` | Implemented arrows, slider and circular stick; Action/Jump separate. DOM IDs/CSS must travel with module. |
| Touch settings | main.ts `arrowGap()`, `previewControls()`, `openControls()` | Saved spacing 1–5, optional same-arrow sprint and 1.5× arrows only. Jump/Action sizes stay fixed; no arbitrary drag-layout editor. |
| Fullscreen/scaling | main.ts `new Phaser.Game()` around line 756, `toggleFullscreen()`, `refreshGameLayout()` | Phaser FIT/CENTER_BOTH, density-aware rendering, native fullscreen or expanded-page fallback. Retain mobile viewport helpers too. |
| Effects/voice | `src/audio.ts`: singleton `gameAudio`, `unlock()`, `setPaused()`, `play()` | Web Audio decoding/playback and synthesized effects; replace clip/event mappings. Master mute is shared with music. |
| Music | `src/music.ts`: `MusicRadio`, `setVolume()`, `beginRun()`, `finishRun()`, `setHold()` | Streams selected HTML audio, independent music volume, pause/score holds and outcome tracks. Browser gesture still required. |
| Scores UI | `src/scoreboard.ts`: `offerScore()`, `openScores()`, `render()` | Implemented remembered-name entry, local/Online views, top actions and exact-run highlighting. Strong DOM/audio/game-rule coupling. |
| Local scores | `src/scores.mjs`: `saveScore()`, `compactScores()`, `rankScores()` | Actual 25-normal/5-distinct-shortcut retention, original-data backup and corruption refusal. Schema/formula is not generic. |
| Shared scores | scoreboard config creates `FirebaseScores` and `OnlineScores` | Implemented in deployed Seth game; dependencies include `record-book.mjs`, `firebase-scores.ts`, `online-scores.mjs`, `online-score-store.mjs`, `online-score-model.mjs`, `score-waits.mjs`, rules and owner activation tooling. Do not point Monkey at Seth's backend. |
| Movement/physics | `Errand.update()` around lines 597–625; `create()` collider setup | Phaser Arcade Physics, gravity 1050, normal horizontal speed 275, helper-defined sprint/jumps. Not Godot physics or a vehicle controller. |
| HUD/objectives | `Errand.updateHud()`, scene state (`elapsedMs`, `beer`, `photos`, `mishaps`), imported mission helpers | Implemented, tightly coupled to floors/beer/two photos and current 120-second deadline. Replace rules and labels together. |
| Restart/transitions | `this.scene.restart()`, `create()` reset logic, audio outcome transitions | One `Errand` gameplay scene. No general level loader, campaign progression, checkpoint save/resume or multi-level scene manager. |

### Input and modal behavior worth preserving

Keyboard: A/D/arrows move; W/up/Space jump; second jump press within 300 ms
upgrades to Mega Jump; Shift sprint; F interact; B photo recall; P pause;
S mute; held R restart. Fullscreen/menu handlers also live outside the scene.
These are Seth bindings, not requirements for Monkey's final gameplay.

Controller: left stick/D-pad movement, button 0 jump, 2 interact, 1 recall,
9 pause, 7 sprint. Menu navigation is not a complete controller UI system.
Keyboard remains available; loss of focus/disconnection clears or pauses input.

Touch input returns action samples rather than invoking scene movement directly.
Clear held pointers on blur, hidden documents, modal transitions and rotation.
Retain `touch-viewport.mjs`, `layout-settlement.mjs`, `dialog-rotation.mjs`,
`dialog-input.mjs` and `modal-navigation.mjs` until their behavior is replaced.
Keep letter-entry guards: score names must not trigger gameplay shortcuts.

### Audio dependencies

`audio.ts` imports `voice-clips.ts`, `music.ts` and preferences. Music imports
`radio-playlist.mjs`; `radio.ts` binds playback to DOM controls. Replace the
playlist, URLs, voice mappings, intro and outcome tracks with Monkey's choices.
Do not copy all Seth music merely to preserve playback code.
Retain timing/cancellation safeguards when muting or restarting an intro/ride.
Credits/Jukebox exists (`createAfterparty` in main.ts); its scene/art/branding is
optional game-specific presentation, not a required reusable subsystem.

## Configuration changes required BEFORE running a copied game

1. In `public/game-config.json`, set **both** `onlineScores.enabled` and
   `serverHighScores` to `false` initially. Remove Seth's Firebase configuration
   and `/api/scores` assumptions. This is the simplest working local-score start.
2. Namespace every storage/database key for Monkey. At minimum replace
   `seth-happens.preferences.v1`, `seth-happens-scores-v1` and its backup key,
   `seth-touch-controls`, mobile-setup/name/update preference keys, IndexedDB
   names and Firebase app names. GitHub Pages repositories under the same host
   share an origin: different URL paths do **not** isolate localStorage/IndexedDB.
3. Replace score schema/limits and formula in `scores.mjs`, `mission.mjs`,
   `online-score-model.mjs`, scoreboard result fields and any server rules together.
   Current beer/photo/mishap validation and fixed −10,000 shortcut are Seth rules.
4. Only enable shared scores after a separate Monkey Firebase/game namespace,
   matching rules, budgets, indexes and initial bounded book are configured.
   Search for `games/beer-run`, `beer-run`, `rooftop`, `current-120-v1`,
   `seth-happens` and `SCORE_KEY`; renaming config alone is insufficient.
   Never run Seth's migration script against Monkey or share live score collections.
5. Replace page title/text/links, logo, icons, manifest start URL/scope/identity,
   version metadata, update-check target and README deployment URLs.
6. Export Godot art/audio to browser-supported assets. Update `preload()`,
   sprite frame layouts/animations, body sizes and origin offsets deliberately;
   Godot collision shapes/animation resources do not transfer automatically.
7. Preserve needed DOM element IDs while copying the shell. Modules bind them
   at import time, so deleting menus/inputs first can break startup.

## Development and deployment

```sh
pnpm install --frozen-lockfile
./dev.sh                 # normally http://127.0.0.1:5173/; use printed port
pnpm test                # Node tests; local API tests require loopback access
pnpm build               # TypeScript check followed by Vite build
pnpm preview             # serve the built dist; use the printed URL
```

`dev.sh` contains this workstation's optional Codex-runtime fallback; normal
Node/pnpm works elsewhere. The package engine requirement is authoritative.
`pnpm test:firebase` requires separately running local Auth/Firestore emulators;
it is not a production test command. Skip backend setup for the first playable.

`vite.config.ts` uses `base: './'` for repository-subpath hosting. Publish the
contents of the Monkey build's `dist/`, not its source tree, to its own Pages
site. Preserve `.nojekyll` when using a branch deployment. Update asset paths
and test the actual repository subpath, including manifest and update requests.

Seth's `.public-release/` source and nested `dist/` are two separate Git checkouts,
with main and gh-pages pushed separately. This is a release workflow, not an
engine requirement. Monkey may use its own simple deployment workflow; no new
CI system is necessary. Pages cannot run the optional Node score API or write a
JSON leaderboard on its own; Firebase is an external service, not Pages hosting.

## Limitations and known follow-up

- **Implemented but device-sensitive:** Home Screen/landscape is the supported
  mobile path. Native fullscreen and hiding browser bars cannot be guaranteed.
  Touch rotation fixes exist; new layouts still need actual smaller-phone tests.
- **Open R-140:** owner reported connection unavailable during score sync.
  A successful read is not proof that every mobile save/retry path is healthy.
- **R-141 acceptance:** arrow-only sizing and wider spacing shipped through
  v1.0.11; additional phone fit/position feedback remains possible.
- **Deferred:** physical Mac/Windows controller acceptance, iOS effect/music dip
  and intermittent final-30-second music behavior. Do not advertise these as fixed.
- **Not available:** verified offline PWA/service-worker asset caching, account
  sign-in UI, cross-device preference saves, cloud run-resume, level editor,
  multi-level loader, vehicle physics, multiplayer or a general-purpose engine.
- Local scores/preferences exist; they are **not** a saved world/progress system.
  Home Screen/browser storage may differ. Private browsing/quota failures occur.
- Shared records are casual client-reported scores, not authoritative anti-cheat.
  A browser PBKDF2 clear-password verifier is a deterrent, not server security.
- The existing build has a large-bundle advisory; avoid adding infrastructure
  just to remove a warning. Prioritize the first playable and measure later.

## Suggested implementation order

1. Obtain the tagged clean source in an independent Monkey repository; disable
   online services, namespace storage and replace identity/configuration first.
2. Keep the working menu/input/audio shell. Build one tiny test area with Lil' G,
   Monkey's logo, one background, one platform and one interaction.
3. Replace `Errand` route/hazards/objectives and art assumptions incrementally.
   Remove Seth's 26-floor route, photo recall, elevator Easter egg, timeout angel,
   characters and afterparty only as their references are removed safely.
4. Establish Monkey's movement/vehicle/gameplay rules, then level boundaries and
   transitions. Add a small level-selection/loading layer only when required.
5. Update HUD and score records/formula together. Validate local save/name entry,
   malformed storage protection, restart, pause, audio and touch/gamepad behavior.
6. Test phone Home Screen landscape, rotation with menus open, keyboard entry,
   both arrow sizes/all spacing steps and controller disconnect before release.
7. Configure an independent shared leaderboard later if wanted; deploy only to
   Monkey's own repository/Pages/backend after Nate approves that release.

## Review limits and confidence

Fresh source inspection was limited to 12 core files: `package.json`,
`vite.config.ts`, `dev.sh`, `public/game-config.json`, `src/main.ts`,
`src/preferences.mjs`, `src/scores.mjs`, `src/controller.mjs`, `src/touch.mjs`,
`src/audio.ts`, `src/music.ts`, `src/scoreboard.ts`; plus current queue/log summaries.
Supporting-module paths are dependency pointers, not a fresh exhaustive audit.
Backend deployment facts also use this project's recorded v1.0.9 release checks.
No new builds, tests, browser trials, asset conversions, refactors or Monkey
repository inspection were performed for this documentation-only handoff.
