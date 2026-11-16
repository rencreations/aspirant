# The About page, rebuilt (15 Nov 2026)

Request: `2026-11-15-about-page-request.md` (word for word). The owner asked for everything to be thought through, so the calls below are mine. Each can be reversed. The studies behind them (the two reference sites, the drone's rig, the footage, the facts) were made on 15 Nov 2026 and their numbers are quoted here where they matter.

## Intent

`/about` stops being the world explainer of the old story. It becomes the page that says what The Aspirants is: the anime skin series of Mobile Legends: Bang Bang, its five phases from 2022 to 2026 ("Aspirant 1.0 to 5.0" in the owner's words), and what was made around the skins. The story is only pointed at. The page is visual first: one 3D drone flies through the whole scroll, as the helmet does on landonorris.com/on-track and the coaster on oryzo.ai.

## Goals

- A first screen laid out like the reference: a giant "ABOUT" at the very top, "Aspirant" in another face and colour below and to the right of it, the drone big at the lower left, a short description and a small reel on the right. All of it on one screen on a desktop.
- An opening played by the drone: the page is empty, the drone crosses the title from right to left and the title appears in its trail in under two seconds, the drone turns back at the left edge and comes down to its place with a flourish, then the description and the reel appear.
- A drone that is alive at rest: it floats, breathes with its wings, blinks, turns its body to look at the pointer, and answers a press.
- The reel grows from its small preview into a big window as the visitor scrolls, as "02 The film" does on Vexana's page, coming from the right. Meanwhile the drone flies to a perch behind the window, small, doing tricks.
- Then the drone comes down and toward the visitor, rolls in the middle of the screen with a big statement behind it, and sits in a marked place, as the helmet does.
- A stop anywhere leaves a sensible picture: the film settles to one end after a second and the drone hovers, upright, alive. Scrolling up flies the drone up, nose first, never a film played backwards.
- After that the drone stays the visitor's company down the page: the five phases, what was made around the skins, TheMLabel, and the way to the story.

## Non-goals and anti-goals

- No lite or reduced variant of anything (the one-version rule). A phone gets the same parts in a phone layout.
- Nothing animated but transform and opacity in the page. No filter, backdrop-filter or blend over the canvas or the film. No clip-path written per frame (Vexana's reel does that: copy what it does, not how).
- No scroll cue, no timer that pretends, no cap on loading.
- No fan-story fact presented as a fact of the game. No invented lore: the drone has no official name that we could find, so it is "the drone".
- Not a second collection: the page links to the rooms, it does not copy them.

## Approaches

**How the drone moves.** (a) Stateless, as on oryzo: every pose is a function of the scroll, so a scroll up plays the flight backwards and a stop can leave it upside down. The owner asked for the opposite. (b) Free flight toward goals with no path: lively, but it cannot be tested and can leave the screen. (c) A stateless target with a physical follower: where the drone should be is a pure function of the scroll and of measured anchors; the drone follows that point on a spring, its attitude comes from its own velocity (it leans and points where it is going), tricks are timed one-shots that always finish, and with no movement it eases upright and looks at the pointer. I took (c). The path stays pure and tested, a stop is always a hover, and a scroll up is a flight up.

**How the drone is placed.** (a) Move the mesh in a wide perspective view: it shears near the screen edge. (b) Draw it to a texture on a moving plane, as the reference does: a second pass and a soft edge. (c) Keep the drone at the origin under a narrow lens and slide the picture with the camera's view offset, scaling the group for size. I took (c): no shear at any place on the screen, one pass.

**How the title appears.** (a) Letter by letter as the drone passes. (b) One wipe edge that follows the drone. (c) Horizontal bands, each a window that opens from the right behind the drone with its own small lag, so the edge of the reveal is a comb of streaks, the drone's trail. Each band is two nested boxes that only translate in opposite directions, so the letters never move and nothing but transform is written. I took (c). When the pass is over the bands are swapped for the plain title.

**The film.** (a) Vexana's cloth (a projective matrix and a clip-path per frame). (b) The preview and the window share one shape (1920 by 810, the trailers' own), so the morph is one `<video>` under a translate, a uniform scale and a small tilt. I took (b). The window is inside a sticky stage in a track that also holds the first screen: (first screen) + 0.9 screen of morph + 0.8 screen of hold.

**The model.** (a) Ship the FBX and three's FBXLoader (79 KB of code, 112 ms to parse). (b) Convert once to a GLB with three's own exporter: unlit, WebP pictures, no morph targets (the eight faces are cells of one atlas, chosen by a UV offset in the shader, which also gives a smooth blink and eyes that look around). 250 KB with its pictures kept lossless (the thin lines of the armour broke up when they were squeezed), 20 to 35 ms to parse, GLTFLoader 44 KB. I took (b).

## The page, top to bottom

Paper `--bg` (`#f4f6f9`), ink `--text`, the site pink `--accent` as the one accent, and the drone's own cyan only on the drone and on the few marks that belong to it. Giant words in the display face (Big Shoulders, the `display` utility). Eyebrows and numerals in mono caps. Leads in Instrument Serif italic. Hairlines, round pills, no cards, no glow.

1. **Opening** (`features/about/opening/`). One track, `TRACK_SCREENS` tall (`layout.ts`).
   - The first screen (one screen tall, in flow at the top of the track). "ABOUT" from the gutter, cap height about a quarter of the screen. "Aspirant" in Instrument Serif italic, pink, a little tilted, overlapping the lower right of ABOUT and running on to the right. Under them, on the right half (from 49.5 percent of the width): a row of three mono labels, an eyebrow, the description (four lines, the last words in serif pink), then the reel's preview with a column of three figures beside it. The left half under the title is empty: the drone sits there, cut by the left and bottom edges, in front of the foot of ABOUT.
   - The reel's stage (sticky, one screen, `LAYER.film`). The big window: the width between the gutters, 1920 by 810, centred in the space under the bar. At the top of the page a transform puts it exactly on the preview's slot; the morph brings it home over `MORPH_SCREENS`. A flat tint of the paper colour lies over the picture in the preview (opacity only) and lifts on hover, on focus, and with the morph. In the big window: the play control (opens the site's player with sound) and five small pills, one per phase trailer. A stop inside the morph settles after one second (`useScrollSnap`, `idleMs: 1000`). The window then stands for `HOLD_SCREENS` and leaves with the page.
2. **Statement** (`sections/statement.tsx`). About 1.3 screens, in flow. Six centred lines in the display face at about 7.4vw, with serif accent words. The drone arrives in the middle of the screen, big, in front of the lines, turns with the scroll, and lands in a small ring at the foot of the section.
3. **Phases** (`sections/phases.tsx`). "Aspirant 1.0" to "5.0", each with its official phase, date, the two skins and their titles, the draw event, its films and music, and art of the pair. The drone waits at an anchor of each.
4. **Ledger** (`sections/ledger.tsx`). What was made around the skins, as big figures in hairline rows, each a link to its room of the collection or to the story.
5. **Label** (`sections/label.tsx`). TheMLabel: what it is, in the official words.
6. **Outro** (`sections/outro.tsx`). The line that says what this site is, and the drone's credit with the takedown link (every 3D model carries one).
7. `NextFooter` to Story.

## Contracts between the parts

Each part owns a folder and they do not import each other. They meet in three files.

**`features/about/layout.ts`**: `MORPH_SCREENS`, `HOLD_SCREENS`, `TRACK_SCREENS`, `REEL_ASPECT`, `LAYER` (`text` 1, `drone` 2, `film` 3). Text sections must not make a stacking context above 1. The drone's layer is `position: fixed; inset: 0; z-index: 2; pointer-events: none`. The film's stage is `z-index: 3`.

**`features/about/stage-bus.ts`**: `useAboutStage` (`phase`, `engine`), `stageRefs.title` (a `TitleReveal`: `rect()`, `setEdge(x)`, `finish()`), `stageRefs.gaze`. The director sets the phase; `AboutRoot` writes it on the page root as `data-about-intro`. A part hides itself for a phase only in CSS and only under `:root.js`, for example `:global(:root.js [data-about-intro="wait"]) .lede`. The values, in order: `wait`, `title`, `landing`, `landed`, `done`. The description and the reel appear at `landed`. Everything is visible at `done`.

**Anchors.** An empty, `aria-hidden` element with `data-drone-anchor="<id>"` says where the drone goes: its centre is the drone's centre and its width is the drone's width on screen. The engine measures them (with the document's scroll) on mount, on resize and when the page's height changes, and reads only the scroll each frame. In order down the page:

| id        | owner     | where                                                                                                                                                                                                      |
| --------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hero`    | opening   | first screen, lower left, in flow. About `width: min(46vw, 82vh)`, centre near 14 percent of the width and 70 percent of the height                                                                        |
| `perch`   | opening   | inside the sticky stage: over the top edge of the big window, toward its right end, so that about a third of the drone is behind the window. `clamp(84px, 9vw, 150px)` wide. It must clear the bar (80 px) |
| `center`  | statement | a box the section keeps in the middle of the screen while its lines pass (sticky), about 30vw wide                                                                                                         |
| `dock`    | statement | the ring at the foot of the statement, in flow, about 8vw wide (not under 84 px)                                                                                                                           |
| any other | sections  | in flow. Optional `data-drone-face` (`normal`, `happy`, `squint`, `scan`, `alert`, `sleepy`, `angry`, `ecg`), `data-drone-turn` (degrees of yaw at rest, positive faces the right of the screen)           |

The first four have their own logic in the path. Every other anchor follows one rule: the drone is at an anchor while the anchor's centre is in the middle band of the screen and rides with it, and flies to the next one in between.

**The scene's module.** The lazy chunk is `features/about/drone/drone-scene.ts`. The loading list and the layer import that same module.

**Test and probe hooks.** `window.__aboutDrone`: `state()` (phase, the pose, the target, the uncovered fraction), `freeze(on)`, `seekIntro(seconds)`, `skipIntro()`. `sessionStorage "aspirants:intro" = "off"` (set by `skipGate`) skips the opening, as it does for the roster.

## The drone

**The file.** `scripts/about/drone/` turns `D:\ren\aspirant\3d\angela\drone.fbx` into `public/models/about/drone.glb` and renders `public/img/about/drone.webp` (the still for a browser without WebGL). The rig: `body`; `wing_L`, `wing_R` (rigid, the long axis is local +Y; a flap is a spread about local Z, opposite signs on the two sides, then a raise about local X, the same sign); `fin_L`, `fin_R`; the two `antenna` chains, which are only the glowing strips behind the fins and are attached to the fins at load. The front is +Z. The rig file's spring solver is not used on bones that are animated: the wings, fins and strips are driven by the flight itself (a small spring per bone, fed with the drone's acceleration).

**The look.** Unlit, as painted, `toneMapped = false`, with a thin ink outline (an inverted hull that follows the skin) so the pale wings read on paper. The face is one atlas of nine drawings: the shader picks the cell, squashes the eyes for a blink and slides them to look.

**The layers of motion.** (1) The target: where the path says the drone is for this scroll. (2) The follower: a critically damped spring on position and size. (3) Attitude from velocity: bank into a turn, pitch along the climb, with the nose toward the direction of travel when fast. (4) Tricks: barrel roll, flip, spin, loop, a wiggle: one-shots on their own clock, started while the drone is travelling, never cut short. (5) Rest: when the speed falls, ease upright to the anchor's own turn, float, flap slowly, blink at uneven intervals, and turn the body and the eyes toward the pointer (or `stageRefs.gaze`). (6) A press on the drone: a happy face, a hop and a spin; a second kind of answer on the next press.

**The opening.** A clock, not the scroll. The director (not in the lazy chunk) waits for the loading screen to be gone, then: `title` (the pass, 1.7 s at most), `landing` (the turn back at the left edge and the descent with a flip and a soft overshoot), `landed`, `done`. It goes straight to `done`, with the title shown, when the opening is off, when the page is opened part way down, and when the visitor scrolls during the flight (the flight is not stopped: the drone simply flies on to where the scroll puts it). Without WebGL the title still appears in its bands, without the drone, and the still picture stands in the drone's place on the first screen.

**Input.** The canvas takes no pointer events. One round, transparent `button` follows the drone by transform for hover, press and the keyboard. Nothing takes focus on load.

## Loading

`aboutItems()` in `features/about/preload-items.ts`, used by `lib/route-preloads.ts`. Waited: the scene's chunk, the model (with bytes), the reel in the display's size (whole, in memory, with bytes), its poster, and the pictures of the sections near the top. The scene calls `expectReady("about-drone")` and marks itself after its first drawn frame, or when it cannot draw. On a visit where the list never ran (a returning tab, Back) the scene and the reel load themselves.

## Facts the copy may use

From the official account's captions and the game's own texts (the study's sheet is kept outside the repository):

- "MLBB's very first anime-themed skins" (10 Jan 2022). The draw event is always "Aspirants Unite".
- Phase by phase: Layla "Miss Hikari" and Fanny "Blade of Kibou", on sale 22 Jan 2022, film "Go For It! Aspirants!", EP 01 "We Believe". Ruby "Mecha Maiden" and Angela "Cyber Cherubin", 3 Dec 2022, films "A Friend", "A Way Out", "Awakening", EP 02. Lesley "Deadeye Spectre" and Chang'e "Tech Tensai", 4 Mar 2024, film "Rekindled Light", EP 03. Guinevere "Daybreak Halo" and Vexana "Twilight Star", 3 Oct 2025, films "Connection Lost", "Re:Link", EP 04 "Cross×Credo". Selena "Silverbolt Raiko" and Obsidia "Imperatrix Arashi", 9 Oct 2026, films "Day of Enders", "The Pawn's Gambit", "The Queen's Endgame", EP 05 "Gray New World" and EP 06 "Lullaby of Oblivion".
- The official word is "Phase" ("phase 2", "Phase V"). "1.0 to 5.0" is the owner's and the community's way to say it: the page shows both.
- TheMLabel (one word): "a dedicated gallery for MLBB's signature skin series", launched 16 Sep 2026, "The Aspirants is the first series to be featured". Its parts: one hall per series with its own visuals and theme music, four perks (a golden skin name, an animated skin tag, a collection crest, a showcase display), and the skin story (lore, cinematic trailers, character designs).
- Figures: 10 skins, 5 phases, since 2022; 10 official films; 7 tracks on 6 EPs; 380 voice lines in Japanese and English; 2 official webtoons; an interactive drama of 6 chapters; 28 official lore texts.
- The two official webtoons are "The Aspirant" (Layla and Fanny) and "Guinevere and Vexana" (the collection's Comic room holds both).
- The drone: the game files of the skins of Layla, Fanny, Ruby and Angela each carry the same drone model (the same mesh and the same three pictures). That is a fact of the files, not an official statement about the drone, and it is all the page says about it.

Not to be stated: other series in TheMLabel, the skin tier, the voice cast after phase one, a name or a role for the drone, a sixth phase. The taglines in `content/pairs.ts` are the site's novel, not the game's.

## Calls I made

- **The drone goes on after the statement.** The brief cites oryzo for the whole scroll, so the drone keeps the visitor company to the end. It costs only anchors.
- **"Aspirant 1.0" and "Phase I" together.** The big numeral is the owner's wording, the small label the official one.
- **The reel is our own cut** of the five phase trailers in release order (about 28 s, no subtitle and no logo in any shot, a dissolve back into the first shot). The only official film with all ten is a soft 45 s social reel. The play control opens the phase trailers the site already holds, with sound, in the site's player.
- **The page's scrollbar is hidden** (`BareScrollbar`), as on the long character pages, because the player stops the scroll.
- **The bar is bare for the whole page** (`useNavLock`), as on Vexana's page: its blurred plate would lie over a live canvas and a film.
- **Old parts removed with the page:** `components/ui/{meter,hud-panel,tag,reveal}` and `components/text/scatter-text`, which only the old page used. `content/world.ts` stays (Home uses it).
- **Home** pointed at the old page as "the world". Its link and its footer line are reworded to match.

## Left to check

Firefox, Safari, a real phone (the touch tests were synthetic, and the address bar of a real phone changes the height of the screen), a weak graphics chip, and a display wider than 2560 pixels below the opening (the sections keep to the site's column there while the first screen is as wide as the page). `docs/HISTORY.md` (15 and 16 Nov 2026) lists what was found and fixed on the way.
