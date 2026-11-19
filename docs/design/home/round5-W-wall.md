# Round five, W-wall: the eased wall, the 35 percent words, light only (20 Nov 2026)

Brief: `docs/superpowers/specs/2026-11-20-home-feedback-5-request.md`, the wall and rows parts. Code: `fx/image-field/scroll-slide.ts`, `fx/image-field/wall.ts`, `fx/image-field/grid.ts`, `sections/aspirants/aspirants.module.css`, `sections/rows/` (`slide.ts`, `ground.ts`, `runtime.ts`).

## What changed

**The wall's speed is eased.** `scrollSlide(g, S)` was a straight line (2 pitches a screen from the wall's landing). It is now an ease in: `SLIDE_PITCHES` (4) pitches times the progress to a power (`SLIDE_EASE_POWER` 2), where progress runs from `SLIDE_ORIGIN` (2.9, the wall has landed) to `SLIDE_EASE_END` (5.5, where the rows' zone starts). The speed grows in a straight line from nothing: slow at the first scroll, faster over time. `scrollSlideSpeed` is its derivative. The ease out is the rows' own cubic (`slide.ts`, `slideShape`), which already started at the speed the scroll gave the plane: `planRide` now reads `scrollSlideSpeed` at the zone's start instead of the old constant, so it starts at exactly the speed the ease in arrives with and ends at rest where the film's space reaches the middle (scroll 6.19). One function serves the wall and the rows: no step of speed at their joint (the rows' `anchor` stays 0).

Numbers at 1440 by 900 (a pitch is 401 px). Real wheel through the slide (`D:\ren\aspirant-work\home\W-wall\speed.cjs`, plane px for each screen of scroll, per 0.25 screen bin): S 2.75 8, 3.0 102, 3.5 343, 4.0 578, 4.5 813, 5.0 1052, 5.25 1172, 5.5 1409, 5.75 1276, 6.0 400, 6.25 0. That is 0.0 to 1.3 pixels of slide for a pixel of scroll up to the zone, a peak of about 1.6, then rest. The old speed was a constant 0.9. Four wheel notches (0.44 screens) from the landing move the wall 46 px, then 140, 234 and 324 px for the next four notches each (`wheelshots.cjs`). The largest step in one frame was 46 px.

**The words window is 35 percent.** `WALL_SHARE` is 0.65 (was 0.5). The cards keep the size they had (`GRID_SIZE.wide` is multiplied by `sqrt(0.5 / WALL_SHARE)`: 358 by 201 at 1440, 74 cells), so the wider frame shows more pictures, not bigger ones: 18 slots have their centre in the frame (was about 11) and 8 rows cross it. The hard edge is at 65 percent. The text box is `35vw - gutter - 2.4vw` wide (`--col` in `aspirants.module.css`); the title is one line sized from the column (`--col / 4.95`, 2.2 to 6.2 rem) and the paragraph from it (`--col / 20`, 1.05 to 1.6 rem). The narrow window (under 56.25 em) and the tall screen keep the stacked layout and the old sizes (rules at the end of the file, so they win).

**Light only.** `rows/ground.ts` lost `groundDark` and the rows runtime lost its `setGroundCue("daybreak", "storm", ...)` call, so the paper stays the daybreak off white through the whole transition and the film turns upright on it. `silkShare` stays: the light silk of the rows goes out as the pictures clear, ahead of the strip's own backdrop. The aspirants and the rows already used daybreak ground, nav and no dark backdrop.

## The joint with the strip (for S-strip)

The rows end on the daybreak paper and no longer call `setGroundCue`. The silk is at 0 by the end of the clearing (`silkShare`). The rows' rest (scroll 7.0 to 7.3, `v` 1) already asks for `backdropAt(7.7)`, which is the strip's `INK`, so its daybreak theme and its slow entrance govern those 0.3 screens too. Looked at on a fresh load at scroll 7.2: the film stands upright on the light paper with a faint mist, nothing dark.

## Looked at

Real Chrome, dev server on 3000 (`D:\ren\aspirant-work\home\W-wall\`): 1440 by 900 at the rest (S 4.0), in the close (5.0), through the rows' zone (seeks at 5.5, 5.75, 5.9, 6.05, 6.2, 6.4, 6.6, 7.0 after the rows had mounted; the film stands in the middle row's gap, rides in, the pictures clear, the film ends upright on the light paper), the hero's landing (1.6, 2.2, 2.6, 2.9: the cards land in the wider frame, no bare place), 1706 by 950 at the rest, 390 by 844 at the rest (stacked, as before). No console errors in any run.

## Tests

`rows/slide.test.ts` was rewritten for the new function: no slide before the origin, the full 4 pitches at the end, a slow first screen, continuity of position and speed at the zone's start, rest where the slide beat ends, monotone slide over the whole run, no step of speed at the wall to rows joint, `SLIDE_EASE_END` equal to the rows' zone start in the registry. That file passes (7 tests, after the origin speed assertions were added). `fx/image-field/grid.test.ts` was edited by hand (the frame is 0.65 of the width, the card width stays 358) and not run. `clearing.test.ts` passes zone starts that are not the real one (0, 0.37, 1.6 ...): with the new `planRide` those start with no slide speed, which is allowed (slope 0). Not run.

## Not verified, not done

- Not run: `grid.test.ts`, `formations.test.ts`, `sets.test.ts`, `clearing.test.ts`, `journey.test.ts`, `words.test.ts`, `backdrops.test.ts` (the process rule). `formations.test.ts` and `sets.test.ts` could pin the in-frame counts of a half wide frame.
- The ease out is the rows' cubic, so it lasts the slide beat (about 0.7 screens of scroll). A longer ease out would need the film's appearance moved later in the zone (`ROWS_BEATS` in `journey.ts`): the film appears while the wall is still moving by design. Left alone.
- The speed has a small second rise right after the zone starts (the cubic's start slope is about 1.1, so it gains about a third before it slows). It is smooth, not a step.
- 1920, a landscape window under 900 px wide (the column is then the full width, as before) and a real phone were not looked at. Touch scrolling was not tried.
- `sections/backdrops.ts` still has the strip's `INK` backdrop in the storm theme and a comment about a dark ground at `BACKDROP_AT.ink`. That belongs to S-strip and L2.
- Knip will say `SLIDE_PITCHES` and `scrollSlideSpeed` re-exports in `rows/slide.ts` are used by a test only (the old constant was the same).
