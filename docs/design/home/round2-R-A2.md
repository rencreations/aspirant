# Home round two: R-A2 (the wall, the rows, the preview, the sharp edge)

Brief: the owner's second message of 19 Nov (`docs/superpowers/specs/2026-11-19-home-feedback-2-request.md`): more rows and smaller pictures that repeat like premotio and fill the whole left frame, a sharp edge, the words moved and re-set, rows that never stop and go faster with the scroll, a space in the rows for the film, a longer threshold where there are words.

## 1. What changed

**One plane, many small cards** (`fx/image-field/grid.ts`, new). The wall and the rows are now the same plane of cards over the whole screen. The wall is the plane seen through the clip of the left frame (the top 56 percent on a tall screen), the rows are the same plane with the clip open. So the aspirants' close is only the clip opening (a hard edge sweeping out) and the glide goes on without a hand-off. `rowsPerWall` is 1.

- `wallGrid(vp)` (memoized per size): odd number of rows with one through v = 0 (the middle row, the film's), per row just the cards that span the screen plus a margin and a card (`coverPlan`: the screen's four corners grown by 40 px are inverted through the 2000 lens onto the plane, then each row takes the widest slice of its band). A row wraps in a window of its own length centred on `rowCenter`, so the slide never ends and no card leaves or enters where it can be seen (tested exactly: the wrap seam is off screen for every card and both sides of the jump).
- Card size `GRID_SIZE` (wide 0.15, tall 0.18 of the square root of the wall frame's area): 130 px tall on the plane at 1440 by 900 (was 312). 19 rows, 134 cells, 32 of them in the wall's frame; 1706 by 950: 135 cells, 32 in frame; 390 by 844: 23 rows, 120 cells, 33 in frame. About 9 rows cross the wall at 1440.
- Cells: the story's cards (the hero's, count `n`) land on slots inside the wall's frame (`story.ts` takes `grid`, prefers `inFrame` slots, nearest to where the card leaves the ring). Every other slot is a wall-only cell (`formations.ts`: `total`, `extraSlot`, `extraRank`, `extraIn`): hidden in the scatter, gather and ring, fading in from the middle of the frame outward while the cards land (story p 0.58 to 0.98), the ones outside the frame (under the clip, for the rows) coming in once the clip has closed. `FieldActor` has `total` cells (grown and shrunk with the screen, `growCells`); a cell wholly off screen or outside the clip is not drawn (`seen`).
- Pictures per slot (`slotPicture`): even rows use the even pictures of the pool, odd rows the odd, so two rows that slide past each other never show the same picture side by side, and a row repeats a picture only after the whole of its half of the pool. The pool is the 18 splash arts plus the tiles.
- **Tiles** (`tiles-data.ts`, new): 50 official scene stills of the collection (480 wide thumbnails, 738 KB in all, `canon: "official"`, picked round robin over the ten Aspirants from `arts-scene.json` by `D:\ren\aspirant-work\home\R-A2\tiles.cjs`, outside the repo). Pool 68, so about two repeats on a screen. One loading item `field:tiles` (waited, one entry for fifty pictures so the bar's list stays short). A press on one opens the preview (`preview/tile-pictures.ts`, `ALL_PREVIEW_PICTURES`, 68 pictures; the full size of a tile loads on the press, the 18 splash arts still preload deferred). The window's labels are now neutral ("View the art", "Official art", "More official art": `content.ts` `PREVIEW`).
- The preview's flight back goes to the instance of the picture that is seen (inside the clip) and nearest the card pressed (`hero/scene.ts`), since a picture is on the plane more than once.

**Sharp edge.** `FieldScene` passes no soft width to `setClip` (the pictures end at the frame, hard). The soft-edge shader code (`uClip`, `uSoft`, `clipSoftEdges`) is still in the actor, unused: delete it or reuse it, not wired.

**Words** (`aspirants.module.css`, `view.tsx`, `runtime.ts`). The game's logo 1.05em (was 1.35), TheMLabel's 0.92em with 0.2em of room each side (the home stylesheet's `.lead img` rule was beating the old class: the new rules use two classes). The second description is indented by 30 percent of the column (22ch wide), 16 percent on a tall screen, so the block reads left, right, left (title, game line and button flush left). The block is lifted 7vh on a wide screen (it was centred; the drone rests at the foot). On a tall screen the block keeps its old place under the wall (a lift made the title touch the wall's edge: looked at and reverted). The words leave by sliding to the right (0.16 of the screen's width) and fading, the first line first, in 0.28 of the close; they no longer fold.

**The close** (`hero/timeline.ts` beats, `aspirants/index.ts`): words out S 4.5 to 4.78, the clip opens S 4.55 to 5.1, the glide never stops (`slideRate` has no stop; `slideOut` is gone). The close is 1.2 s (was 1.5). The ground stays light (no dark cue).

**Thresholds.** `ASPIRANTS_SCREENS` 1.3: the close fires one screen of scroll after the hero's play (it was 0.63), the rows have 0.7 screens of dwell (it was 0.3). Table in section 3.

**The rows** (`rows/`):

- Endless glide: `rowsRate(frame.input.wheel)` (`speed.ts`): 80 px/s of the plane (the wall's own rate) plus 0.4 of the scroll's size, in either direction, capped at 1300. The carousel eases toward it (0.3 s). `setHoldOnHover(false)`: a hovered card lifts but never stops the rows. The wake still ripples.
- The transition is one play of 3 s (`ROWS_PLAY_SECONDS`, the strip's first play runs in step): the film is the next thing that scrolls in on the middle row.
  - `slide` (s 0 to 1.5): the rows come to rest with a cubic that starts at the speed they had (`slideShape(s, a)`, `a` = speed times seconds over the ride), so nothing jumps at the trigger. All rows slide by the same ride in their own ways.
  - `gap` (s 0 to 0.55): the cards of the middle row on either side of the film slide apart by one push (`gapPush`), a clear space the film's size, attached to the row (so it holds while the rows move).
  - `appear` (s 0.25 to 0.8): the film shows in the space. `rideDistance` picks the ride so the film's place falls half a pitch off the card grid (between two cards) and ends at the middle of the screen; `rideReach` starts it half way to the screen's edge.
  - `clear` (s 1.1 to 1.8): the other cards clear from the film outward (the old clearing, now over any number of rows). `morph` (s 1.8 to 2.4): the film turns upright into the strip, J3 unchanged.
  - Proof that the film is never in front of a picture: `clearing.test.ts` (the film's plane rect, as `heroBase` sizes it, against every card's rect after the space, for the whole play up to the clearing, at 7 starting phases and 5 starting speeds: a positive clearance always). The film is on the same plane as the cards, so no overlap on the plane is none on the screen. Looked at in real frames at 1440 and 390.
  - Interaction is off during the play (a lifted card could reach the film).
- Ground: stays light through the wall and goes a little dark as the visitor scrolls the rows' dwell (`DWELL_DARK` 0.2, scroll linked, reversible), then the play finishes it (`groundDark`, `setGroundCue`), so nothing steps. `bg` and `nav` of the rows are daybreak; the strip's storm takes the bar at the trigger.
- Backdrop: silk (light) through the wall and the dwell; `BACKDROP_AT.ink` moved from 4.95 to 5.7 (inside the play, 0.4 screens in), `backdrops.test.ts` updated.
- In its lead (`v < 0`) the rows runtime leaves the field to the aspirants' close; from `v >= 0` it drives it.
- Drone (`drone-route.ts`): a stop `["rows", 0, 0.38, -0.34, 0.13]` keeps it at the lower right through the dwell, and a stop `["rows", 1.3 / 2.4, -0.3, -0.32, 0.12]` sends it round the film along the lower left (it crossed in front of the film before). Compact route the same.

## 2. Audit of my sections

Found and fixed: the wall had 18 giant cards in 3 rows with empty corners (`fx-image-field.md` called it a known gap); the cut edge faded; the logos were the wrong size because a stylesheet rule beat the class; the second line was flush left; the block sat dead centre over the drone's place; the glide stopped at the close and the rows were static; the film appeared small over the neighbours; the drone crossed in front of the film; the ground went dark at the close; the dark backdrop was on before the transition; the film's ride and the rows' stop depended on a whole number of pitches.

Found and not fixed:

- The cards streak and split colour at speed (the field's own smear): at the peak of the transition (about 600 px/s of the plane on a wide screen) the pictures are visibly smeared. It is the premotio look the owner asked to keep; a lower `STREAK_*` in `live.ts` or a shorter ride would calm it.
- The film shows faint in the first frames it appears (opacity follows `appear`).
- The top-left controls (Menu, sound) and the logo sit over cards (the bar is bare on the wall).
- A hover over the wall in the rows state does not show VIEW and a press does nothing (as before: the press is the wall's, `viewable`).
- On a phone the plane's far rows are very small (about 25 px tall) at the top: a perspective effect of the tilt, kept.

## 3. Stations and thresholds (registry, in screens of scroll)

| section   | start | screens | trigger                                           | dwell before the next trigger  |
| --------- | ----- | ------- | ------------------------------------------------- | ------------------------------ |
| hero      | 0     | 0.3     | play at 0.3 (2.8 s: logo, ring, land, words in)   | 1.0 (words: long)              |
| aspirants | 0.3   | 1.3     | close at 1.3 (1.2 s: words out, clip opens)       | 0.3 to the rows' lead          |
| rows      | 1.6   | 0.7     | transition at 2.3 (3 s: space, film, clear, turn) | 0.7 of scroll answers the rows |
| strip     | 2.3   | 2.5     | (R-A3)                                            |                                |

Durations: entrance of the wall's cells 0.3 s inside the hero's play; close 1.2 s; transition 3 s (the film arrives at 1.9 s, the strip's small state stands at 3 s). The scroll is held only while a play runs.

## 4. API others use

```ts
import { wallGrid } from "fx/image-field/grid";   // { geom, wall: Frame, inFrame }; geom.midRow, rowV, rowCenter
field.holdSlideAt(x);   // put the slide exactly at x and stop the glide (a scene that drives the rows by hand)
field.slideSpeed;       // px/s of the plane now
field.count;            // every cell (story cards + wall-only cells); cardInfo(i).slot is the plane slot
filmStateAt(S, startU, state, a?)  // strip/film-state.ts: startU is signed, a the slide's first slope
rowsGeom(vp)            // video-plane/hero.ts: now wallGrid(vp).geom, the very object the cards stand on
```

The hero's story card count `n` must stay at or under the in-frame slots (32 at 1440 by 900 and 1706 by 950, 33 at 390 by 844): a card past that lands outside the frame and is hidden by the clip.

## 5. Numbers to tune

`grid.ts`: `GRID_SIZE`, `COVER_MARGIN`. `formations.ts`: `extraIn` (0.58, 0.24, 0.16, 0.95). `speed.ts`: `IDLE_RATE`, `BOOST_GAIN`, `BOOST_MAX`, `DWELL_DARK`. `rows/journey.ts`: `ROWS_BEATS`, `ANGLE_SIZE` 1, `GAP_MARGIN` 0.2, `MIN_RIDE_PITCHES` 1.5. `rows/clearing.ts`: `ACROSS`, `FEATHER_PITCHES`, `PUSH_WIDTHS`. `aspirants/index.ts`: `ASPIRANTS_SCREENS`, the dwell, the close's seconds. `aspirants/runtime.ts`: `EXIT_SHARE`. `aspirants.module.css`: the indent, the logo heights, `translate` of `.box`.

## 6. How to look

Scripts in `D:\ren\aspirant-work\home\R-A2\` (not in the repo): `rest.cjs` (wall and rows at rest, `THROUGH=1`), `play2.cjs` (screenshots with the play's progress for the transition, `SIZE=390` for the phone), `prev.cjs` (hover, press, step, close of the preview), `perf.cjs` (frame times through every state), `timing.cjs`. They block the HMR socket so another helper's save does not reload the page. A video recording drops frames of a play: use the timed screenshots. By hand: a real wheel through `__home.state().play` (`hero`, `aspirants`, `rows`).

## 7. Checked

- Real Chrome, dev server, real wheel at 1440 by 900, 1706 by 950 and 390 by 844 (wheel on a touch context): the wall, the rows at rest, the close (66 frames at 16.7 ms, one 57 to 69 ms frame early in it), the transition (frames with progress at 1440 and 390), the rows' speed with the wheel, the preview (hover, press, step to a tile, Escape; the hold is taken and given back).
- Frame times on the dev server (median / p95): wall idle 16.7 / 18.4, wall pointer 16.6 / 18.6, rows idle 16.7 / 18.5, rows wheel and pointer 16.7 / 19.5, transition 16.7 / 18.5. Stalls of 66 to 114 ms: the close's first frames and the first wheel in the rows (first draws).
- Tests: `grid.test.ts` (coverage at five sizes and five slides, wrap seam off screen, picture rule), `formations.test.ts`, `sets.test.ts`, `rows/journey.test.ts`, `rows/clearing.test.ts` (the no-overlap proof), `rows/speed.test.ts`, `hero/timeline.test.ts`, `backdrops.test.ts`. `npx eslint` clean on my paths, `scan-text` 0 problems.

## 8. Not verified

- The production build, a weak GPU, Firefox, Safari, a real phone (a touch context in desktop Chrome with the wheel was used), a slow connection through the bar (`field:tiles` was never watched going through it), a scrollbar drag into the middle of the rows, a resize while the transition runs, a lost context with 134 cells.
- A touch swipe through the close and the transition (the kernel's own touch proof covers a play, not mine).
- The first-use stalls on a production build; the field draws up to 134 cells (off-screen ones are skipped) at about 0.6 ms of CPU, not timed on its own.
- `ready()` (kernel-snap): not implemented in the aspirants or the rows. Their runtimes are made only after `ensureField` and `ensureFilm` have resolved, and the tiles are waited for by the list; a play can still fire before the wide pictures have been uploaded (a card shows its portrait for a moment).
- The loading list's `field:tiles` bundle is untested beyond the list's own tests.
- Not mine and failing when last run: `sections/rows/preload.test.ts` (the strip loop's name changed under it), `kernel/snap.test.ts` (one case), `fx/video-plane/data.test.ts` and `preload.test.ts` (R-A4's data change).

## 9. Shared files edited (small, with Edit)

`fx/image-field/{wall,story,formations,actor,pictures,sets,preload}.ts` (and their tests), new `grid.ts`, `tiles-data.ts`; `fx/video-plane/hero.ts` (`rowsGeom` delegates to the grid); `sections/strip/film-state.ts` (`a`, `ANGLE_SIZE`, `perWall` 1); `sections/hero/{scene,timeline}.ts` (sharp clip, the visible instance, no stop of the glide, the close's beats); `sections/backdrops.ts` and its test (the ink moves into the transition); `drone-route.ts` (two stops); `content.ts` (`PREVIEW` labels); `preview/{pictures,preview}.ts(x)`, new `preview/tile-pictures.ts`; `preload-items.test.ts` (allows `field:tiles`). The others' notes to read: R-A1 (the story's card count and the in-frame slots), R-A3 (the ink backdrop now starts at S 5.7), R-A4 (`rowsGeom`, `ANGLE_SIZE`).
