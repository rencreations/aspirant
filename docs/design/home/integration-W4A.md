# Home, wave 4 integration: W4-A (loader, intro, hero, aspirants, rows, strip)

Range: the drone loader, the tap gate, the intro, and S 0 to 11.3 (joints J0 to J4). Walked with real Chrome at 1440 by 900, 1706 by 950, 390 by 844 (and 1024 by 700, 1280 by 720, 768 by 1024 for the words of the aspirants), with `__home.seek` frame sheets and with a real wheel. Scripts of this run (not in the repo): `D:\ren\aspirant-work\home\W4A\`.

## Changed

- **The wall's cut edge is soft.** The wall (S 3.3 to 5.3) was cut by a hard scissor line, with the words flush against it. The composite shader now thins the picture toward the cut (`uClip`, `uSoft` in `fx/image-field/shaders.ts`, set in `actor.ts` `draw`, arithmetic in `math.ts` `clipSoftEdges`, tested). `setClip(rect, soft)` takes the widest soft part in CSS px; an edge on the screen's border gets none and the soft part shrinks with the edge's distance to the screen's edge, so the clip that opens at S 3.3 to 3.95 and again at 5.05 to 5.3 loses it smoothly. `sections/hero/scene.ts` passes 7 percent of the width, 120 px at most. No new pass, no extra draw.
- **The words of the aspirants keep a gap from the wall.** `aspirants.module.css`: the box is `42vw - 1.65 * gutter` (it was `42vw - gutter`, so the title stood on the cut). On an upright screen the words are left aligned at the gutter, up to 36rem (they were shrunk and pushed to the right by `justify-self: end` on an absolute box).
- **The drone's route has a compact table** (`drone-route.ts`, `isCompactView`: width under 700 px, or taller than wide, the same rule as the layout's tall rule). Same scroll stops, a drone 22 percent smaller, x kept 0.12 W at J0 so the wing is on the screen at rest (reach about 1.2 of the height; the test holds it), y -0.27 H at J0 so it stays under the scroll cue, and over the wall's upper right during the aspirants' hold (the words stand under the wall there; at 390 the drone was covering "A part of ... as the first" and the button). The intro follows `routeAt(0)`, so its last frame moved with it: checked equal to the open page's first frame at 390.
- **The strip's `.ambScrim` no longer widens the plain page** (`strip.module.css`: `display: none` outside the stage rule). Checked with WebGL removed: `scrollWidth` equals `clientWidth` at 1440 and 390.
- **The corner brackets of the HUD fade with the bar's controls** (`components/hud/hud-frame.tsx`, `hud.module.css`: `data-hidden` from `useNavLock().hideControls`, opacity only, same durations as the bar).

## Walked and found right (no change)

- Intro, loader to the open page, at 1440 and 390 (frames at 0.6 to 13.19 s): the order of beats, the shock mark, the struggle, the help, the pull, the thanks and the leaving all read. At 1440, 1706 and 390 the drone of the last intro frame and of the open page's first frame are the same picture (1 to 2 px, and the blink); the logo's outline differs by a pixel of chromatic fringe (the intro's end ripple against the hero's `REST_WAVE`, both 0.3).
- Hero beats S 0 to 4.2 at 1440 and 390; the logo morph into the bar; the ring; the land.
- The ground from S 5.3 to 6.1: a smooth ramp from the daybreak ground to the storm, grey in the middle for a third of a screen, no flash.
- Rows (S 5.8 to 8.2) and the strip (8.2 to 11.3) at 1440: the small frame with the owner's words, the expand, the window with the play button, the pull, the ten previews, the fly-off. The words and the layout read like the reference.
- A jump (`seek`) against a real wheel scroll to S 4.6, 7.0 and 9.0 at 1440: the same layout. At 7.0 the rows' cards stand differently, because the wall's glide is time based (a visitor who stayed on the wall longer has slid further); the film rides the right gap in both. At 9.0 only the video's own time differs.
- The film and the bolt's tint at S 11.1 to 12.1: previews fly off over the green-black ground, a bare stretch with only their lines at S 11.7, then Silverbolt at 11.9. No overlap of a preview with the dragon's tint seen at 1440.

## Still wrong, or not looked at

- **First draw stalls on the dev server** (real wheel at about 2 screens a second, 1440 by 900): 0.3 to 0.5 s at S 7.8 to 7.95 (the strip's first frames: its letters and the bolt's `warmCast` 143 ms), 100 ms at 8.14 to 8.21, a 0.7 to 1.0 s stall once at rest after a jump to S 4.6, and `getProgramInfoLog` stalls of 100 to 735 ms while the loading screen is up (shader links, three.js checks the link status at once). The 0.8 s stall seen at S 2.95 in the first two runs did not come back after the dev server had compiled the chunk, so it is the dev server's own. None of these were measured on the production build. Frame times otherwise: median 16.7 ms, p99 17.0 ms. A parallel compile (`renderer.compileAsync`) of the bolt's and the film's materials at the end of the hero would remove the first-draw links.
- The entrance of the hero cards: 0.3 s after the open the ring of cards shows under the logo with thin vertical slivers (the smear of a card that is just starting to move). It reads as a glitch at 390 for a few frames. Starting the burst from behind the logo would hide it.
- At S 11.7 the screen is bare (only the flexible lines of the fly-off) for about a third of a screen. The lines outlive their previews.
- The strip's "VIDEO" touches the line above it (the reference does too).
- `sections/archive/route.test.ts` has two failing tests (the title once the first cover rises: 0.94 against 1, and Tetra's goodbye at J14: 0.9999999999998815 against 1). W4-D's range, being edited at the same time.
- Not checked: the production build, `scripts/perf/weak.mjs`, a real phone and real touch, Firefox and Safari, a slow connection through the bar, the loader's drone at 1706 (frames taken, not studied).
- The dev server reloaded the page whenever another helper saved a file, so every measurement was repeated until it ran through; numbers above are the runs that did.
