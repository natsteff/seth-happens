# Credits/Jukebox afterparty

Included in v1.0.3.

Open **Credits/Jukebox** from the desktop controls or game menu. The game pauses while the presentation runs; Close or Escape stops/unloads the jukebox stream and returns to the game menu. Resume continues the preserved run. Opening from the title or an ended run also returns to its appropriate menu. No scores, objectives, route or physics change.

The BT-AI DJ booth sits under the game logo. A generated photorealistic venue includes a static DJ resembling the owner-supplied reference, with the supplied BT-AI artwork on the booth and shirt. The DJ/booth are smaller and farther back, and the game logo is integrated into the lit back-wall banner. The DJ remains with the booth until the stage goes dark. Allison, Oakey, Ellowyn, the clown, scruffy pedestrian, fictional soccer star and both concert fans reuse existing game art. The crowd has three clowns and four drunks total; the pigeon is omitted. Seth's five new 12-frame full-body sprite sequences randomly change among air guitar, moonwalk, headspin, awkward shuffle and standing, without immediate repeats. Standing lasts only1–2seconds; moving dances last3–5seconds. Allison reacts to headspins. Reduced-motion preference removes beat-driven movement and light sweeps.

| Time from opening | Scene |
| --- | --- |
| 0–20 seconds | Credits scroll over the full party. |
| 20–30 seconds | Party continues without credits. |
| 30–40 seconds | Crowd and cats have left; Seth and Allison remain in front of the DJ/booth. |
| 40–50 seconds | Allison leaves, switches off the stage lights; a spotlight finds Seth still dancing. |
| 50 seconds onward | Black background with a large game logo, afterparty/stay-a-while taglines; persistent controls remain below, until Close. |

**Eye of the Stairwell** is the default on every visit. All 11 shipped music tracks are selectable, including both countdown and champion choices, failure and cheater music. Music loops in jukebox mode; this does not change the in-game outcome loop rules. Previous/next wrap the complete catalogue. Ordinary sound effects and voice recordings are not songs.

The jukebox initially honors music on/off, master mute and music volume. Play/Pause and jukebox volume are independent of the gameplay station and its saved volume; Sound toggles the existing master-mute preference. Closing pauses gameplay audio until the menu is resumed/restarted. Tracks stream one at a time through one reusable media element and gain node, with browser gesture/autoplay rules respected. Leaving the page pauses playback and the scene clock. The story clock waits for the lazy-loaded scene assets. The render loop is capped at 30 fps and stops at the final static logo; the underlying game scene is paused and hidden during the visit.

The owner-supplied credits text is in `src/afterparty-model.mjs`. Source originals are unchanged. New raster art was generated with the built-in imagegen tool from owner-supplied references; original references remain private. See [art prompts and inventory](afterparty-art-v2.md). No stock assets, backend or analytics were added.
