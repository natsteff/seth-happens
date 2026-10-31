# Afterparty artwork — v1.0.3

Generated with the **built-in imagegen tool**, using the owner's BT-AI artwork/DJ portrait and the existing Seth character image as references. No CLI/API fallback. Original inputs remain unchanged in the private reference folder; they are not public-release assets.

## Saved assets

All paths below are relative to `public/assets/afterparty/`:

| File | Use |
| --- | --- |
| `venue-dj-v2.png` | Active1672×941venue: smaller distant DJ/booth and lit physical backdrop banner. |
| `venue-dj-v1.png` | Retained privately in development workspace, not released or loaded. |
| `venue-empty-v1.png` | Retained privately in development workspace, not released or loaded. |
| `seth-air-guitar-v1.png` | 12 complete air-guitar frames. |
| `seth-moonwalk-v1.png` | 12 heel-toe/sliding frames. |
| `seth-headspin-v1.png` | 12 upside-down turning/scissoring frames. |
| `seth-shuffle-v1.png` | 12 awkward-shuffle frames. |
| `seth-standing-v1.png` | 12 standing/breathing frames. |

Each dance atlas is a 1254×1254 RGBA PNG arranged 4 columns × 3 rows. Rendering uses alpha-derived frame bounds, a common scale within each sequence and a floor-aligned anchor. Moving sequences play at 12 fps, idle at 6 fps, inside the 30 fps scene loop. The old segmented limbs and flat rotation are removed. Alpha is preserved; a diagnostic on the air-guitar atlas found no opaque bright-red fringe pixels (red visible in the generation preview was transparent RGB).

## Final prompt set

### Venue / static DJ

Use case: photorealistic-natural. Production game background asset, wide 16:9, high resolution. Richly detailed realistic small EDM/rave venue with centered raised stage, professional turntables/mixer/DJ table, large speakers, lighting trusses, purple/teal/amber lighting and gentle haze. Camera from empty dance floor toward stage at eye level. Lower 40% empty for composited characters: no crowd, Seth, Allison or cats. One static realistic male DJ resembling supplied portrait: short spiky brown hair, raised eyebrow, short salt-and-pepper beard, amused expression, black T-shirt, headphones around neck, hands naturally on mixer. Supplied BT-AI artwork as a clear square front-left booth panel and smaller shirt print; text exactly “BT-AI”. Booth about30–70%across,48–62%down; DJ head around32%down. Upper back wall uncluttered for separately composited game logo. Cinematic full color, realistic materials/wood floor/anatomy; no vector/cartoon/UI/credits/extra logos or text.

### Empty-booth edit

Use case: precise-object-edit. Venue image is edit target. Remove only the human DJ, including head, torso, hands and headphones, naturally reconstructing back wall/haze. Keep exact image dimensions, camera, venue, dance floor, lighting, speakers, turntables, booth panel artwork and pixel-aligned object positions. No other people or changes to text/framing/exposure.

### Common dance-atlas constraints

Use case: identity-preserve. Existing Seth image is exact face/clothing/body reference. Heavyset soft build/belly, long brown hair, gray beard, charcoal T-shirt, blue jeans, brown hiking shoes, black camera hanging on neck strap against chest, no beer. Photorealistic connected whole-body anatomy, not cut-up limbs. Square transparent PNG, exactly12chronological frames in4columns×3rows, fixed camera/scale/identity, generous transparent margins, full hair/hands/shoes inside each cell and consistent baseline. No floor, shadow, environment, checkerboard, labels, grid, colored halo or text. Small coherent pose changes, frame12 loops to frame1. Requested1536square; native tool delivered1254square and the renderer uses actual dimensions.

### Dance-specific prompts

- **Air guitar:** one smooth12posecycle, feet planted, naturally rocking knees, imaginary fretting hand and rhythmic strumming hand across belly, responsive shoulders/torso, happy expression; no real guitar. Fixed front three-quarter camera.
- **Moonwalk:**12sequential heel-toe phases, three-quarter side view slightly left, alternate planted raised heel and flat backwards-sliding opposite foot, soft knees, counterbalancing arms and weight transfer; remain centered rather than translating between cells.
- **Headspin:**12sequential breakdance phases, crown at common floor baseline, body upside down, legs scissoring above torso in balanced V, progressive axial front/side/back/front turn, hands may balance near head, complete shoes/head/hair visible. Not an upright cardboard figure rotated flat.
- **Shuffle:**12small alternating lateral heel-toe steps, soft knees, belly/shoulder sway, relaxed arms slightly out of sync, fun awkward but believable dance, coherent weight transfer; front three-quarter camera.
- **Standing:**12subtle breathing/weight-shift poses, planted feet, arms relaxed at sides, soft amused expression, camera hangs on chest rather than held; front three-quarter camera.

## Timing and final view

Credits20seconds; crowd departure30s, Allison/lights40s, spotlight40–50s, then directly to the persistent large logo plus both taglines from50s. The music controls remain at the bottom throughout. The story clock waits for lazy-loaded art; gameplay does not load these assets before opening the feature. Original generated PNGs are copied without modification into the project; all original game art remains intact.

## Perspective/backdrop refinement

Built-in imagegen edit saved as `public/assets/afterparty/venue-dj-v2.png` (original v1 retained). Final edit prompt: use v1 venue as target and original game logo as compositing reference; preserve wide camera/architecture/floor/speakers/lighting; shrink DJ and branded booth together to about65%of their former scale and move them farther back on the raised stage, naturally rebuilding exposed stage/back wall. Preserve DJ likeness and BT-AI artwork. Mount the supplied exact game logo as a fabric backdrop banner behind the DJ, below the truss, with realistic venue-colored lighting, shadows, haze and material texture; DJ may overlap banner naturally. Keep floor empty, no extra people/captions/UI/text.

The renderer now uses this same DJ image in both party/couple phases and no longer draws a separate logo over it. The DJ remains until lights-out. The logo-only pause is removed: at50sgo directly to the permanent logo with both taglines. No dance captions or drawn light-switch/arm overlay. Crowd is3clowns/4drunks plus soccer star and both fans; no pigeon.

Standing moves last1–2seconds; all other dance selections last3–5seconds.
