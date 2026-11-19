# Home round five: S-strip (light mode, the mist, no overlay, the pull as a zone, the exit with no snap)

The owner's words: `docs/superpowers/specs/2026-11-20-home-feedback-5-request.md`, the strip paragraph. Code: `sections/strip/`, `sections/backdrops.ts`, `fx/backdrop/glsl-ink.ts`, `fx/video-plane/`, and a small kernel option (`noSnap`). This note replaces what `round3-H3.md` says about the overlay and the ink field, and what `round2-R-A3.md` says about the dark ground.

## 1. What changed

| part                   | before                                                                      | now                                                                                                                                                                                                                                                              |
| ---------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ground and theme       | `bg: "storm"`, `nav.theme: "storm"`                                         | `bg: "daybreak"`, `nav.theme: "daybreak"`. The words, labels, hairlines, marks and the button take the daybreak tokens (`--text`, `--bg`, `--accent`)                                                                                                            |
| the mist (ink field)   | a dark luminous mist, edge light, vignette                                  | a very soft pastel mist: pale blue, a hint of lilac, low coverage (a 5 percent tint and up to 47 percent where dense), two octave noise so the forms are broad and smooth, no edge light, no bright spot. Same lean toward the pointer, same parallax, no scroll |
| the mist's entrance    | a 0.5 s cross fade, at full strength                                        | 4 s of real time, `INK_ENTRANCE_S` in `sections/backdrops.ts`, a smootherstep on the amount (0 to `INK_LEVEL` 0.9). It runs on its own clock, stepped once a frame by the strip (`stepInkEntrance`), so it is never tied to the scroll speed                     |
| overlay over the film  | scanlines, grain, a sweep, a vignette, a fringe, the tint and the dark wash | gone. The film is always the clean picture                                                                                                                                                                                                                       |
| the shine on hover     | a band and a spot of light following the pointer (`sweep`)                  | gone. The lens, the colour split and the tilt stay, with the cursor label and the click                                                                                                                                                                          |
| the pull to the orbit  | a clock trigger (1.8 s)                                                     | a scroll ZONE of 1.0 screen (`STRIP_ZONES.pull`), with the idle snap like every zone. The window growing out of the small frame stays a trigger                                                                                                                  |
| the exit               | a zone with the idle snap                                                   | a zone with NO snap (`noSnap: true` on the play): a plain scroll linked passage                                                                                                                                                                                  |
| the drone and the text | the bands above and below the window were DOM text over the canvas          | the two bands are in the `below` layer (under the canvas), so the drone is drawn in front of them                                                                                                                                                                |
| the orbit on the light | cards flat on the page, pale trails                                         | a soft shadow under each card (the shader, `uShadow`), ink blue trails                                                                                                                                                                                           |

The section is now 4.75 screens (was 3.75): words zone 0.45, rest 0.7, window trigger, rest 0.6, pull zone 1.0, rest 1.0, exit zone 1.0. Every later section starts one screen later in the scroll (the story axis, `STORY`, is unchanged: the beats still run on `stripS(v)`).

## 2. The mist (`fx/backdrop/glsl-ink.ts`)

Colours: the `ink-field` daybreak palette in `palettes.ts` (`#b4d0f5`, `#a3caf2`, `#c8bcf2`, `#e4edfa`, intensity 0.5). The strip asks for amount `INK_LEVEL` (0.9) and intensity `INK_INTENSITY` (1.7), which is exactly what the bolt carries the same kind on with (`bolt/backdrop-plan.ts`), so nothing changes hue or strength at the joint. Measured on a real wheel arrival (1440 by 900, the mean colour of an empty 400 by 200 patch, distance from the paper `#f4f6f9` as the sum of the channels): 0.9 at 0.2 s, 5.5 at 1 s, 15.9 at 2 s, 24.3 at 3 s, 28.2 at 4 s, 30.9 at 5.5 s. It starts so gently that the first second is under a fifth of the level.

The clock (`backdrops.ts`): `stepInkEntrance(dt, on)` once a frame (the strip's runtime, `dt` capped at 0.1 s, a frozen frame holds it), `resetInkEntrance()` when the strip is left upward (the next arrival brings it in again). Left downward it stays at its level, so coming back up from the bolt shows no dip. The cross fade from the silk (already at 0 by the rows' end) to the ink field is the backdrop's usual 0.5 s and shows nothing, because the amount is 0 when it starts.

## 3. The film plane

`shader.ts`: the `uEffect` block (flow, tint, wash), the `uOverlay` block, the `nearP` fringe and the sweep are removed, and the noise helpers they used. The rim hairline no longer brightens on hover. `uFx` is a `vec2` (lens, split). `hover.ts`: `HoverWeights.sweep` and the `"sweep"` mode are gone. `types.ts`, `plane.ts`, `actor.ts`: the `effect` and `overlay` fields are gone. `strip/journey.ts`: `overlayAmount` and the `clean` beat are gone (and their tests).

Soft shadow: `uShadow` (0 to 1) and a 28 px margin for a plane that has one (the previews always, the trailer as `pull` rises, so the leader and the ten agree). A blurred copy of the card's shape, pushed a little down and to the right, premultiplied behind the card.

## 4. The pull and the exit (`dwell.ts`, `index.ts`, kernel)

`index.ts` plays: the words zone, the window trigger, the pull zone (`ease: "linear"`, because the dolly eases itself), the exit zone with `noSnap`. `dwell.ts` names the three zones and three rests; the focus places (`STRIP_FOCUS_AT`, `STRIP_FOCUS_RANGE`) follow.

`noSnap` is a new option of a zone (`HomePlay.noSnap`, `kernel/plays.ts`): the table rejects it on a clock play; `ZoneRange.snap` carries it; `ZoneSnap.step` returns early with the block `"free"` for such a zone (`kernel/scrub.ts`, `SnapBlock` in `snap.ts`). The zone still counts as a zone for the joint snap (`inside()`), so the joint snap keeps out of it too. HELPER L1: use `noSnap: true` on the bolt's zone, or on any zone that must be a plain passage. The strip's exit covers the bolt's whole lead (0.5 screens), so the joint to the bolt is a plain scroll passage already.

Looked at with a real wheel (1440 by 900, dev server): the pull zone from 1.5 to p 0.41 then still: the idle snap carried it to the zone's end (y 2.750, `v` 3). The exit zone at p 0.52 then still for 4 s: no move (y stayed 4.267), `scrub.blocked` was `free` and the joint snap's `blocked` was `zone`. Scrolling up in the exit, stopped at p 0.22: no move for 4 s either.

## 5. The drone in front (what was done and why it is not (a) or (b))

The drone is drawn in the canvas, under the DOM text layer. The only text that meets it in the window is the two bands (the marks and the running words), which hang outside the picture, at the lower right the last mark of the bottom band stood under the drone's wing. So the bands moved into the layer under the canvas: a second box (`deckBelow`, `data-strip-deck-below`) inside the strip's `below` markup, the same box as the deck (same `--sw`, `--wa`). `WindowDeck` takes the second root (`new WindowDeck(text, options, below)`) and writes both boxes' opacity. The words, the button and the readout pill stay in the text layer: they stand on the picture, away from the drone's place. This is exact (the drone's real pixels over the band), has no flicker and costs nothing per frame. No mask is written per frame and the deck's animations are untouched. Looked at: 1440 by 900 (the last mark is behind the wing), 1706 by 950 and 390 by 844 at the window rest and mid pull: no text of the picture meets the drone.

## 6. Numbers to tune

`backdrops.ts`: `INK_ENTRANCE_S` 4, `INK_LEVEL` 0.9, `INK_INTENSITY` 1.7. `glsl-ink.ts`: the base tint 0.05 and the density 0.42, the flow speed 0.7, the lean 0.06, the parallax 0.05 and 0.11, the vignette 0.45. `palettes.ts`: the four stops. `dwell.ts`: `STRIP_ZONES.pull` 1.0, `STRIP_DWELL`. `index.ts`: the pull's snap seconds (1.4). `shader.ts`: the shadow (blur 8 to 24 px, strength 0.5), `plane.ts` `SHADOW_PAD` 28, `actor.ts` the trail colour and alpha (0.32). `strip.module.css`: `.ambScrim` (88 percent of the page colour), `deck.module.css`: `--deck-mark-ice`.

## 7. Calls made without the owner

- The tint and the dark wash on the small frame (the original "effects overlay" of the reference) are removed with the round three overlay: "remove the preview video effects overlay" read as all of them. The hover lens, colour split and tilt stay. To bring the old tint back, it is the `uEffect` block in git history.
- The pull is one screen of scroll and the section grows by one screen (4.75).
- The pull's words (the heading, the line, the button) come in during the second half of the zone (the beats `pull` then `hold`), and the orbit rest after it is a full screen.
- The mist's intensity is shared with the bolt through `INK_LEVEL` and `INK_INTENSITY` (the bolt's own constants are 0.9 and 1.7, equal by hand: a change here needs the same change in `bolt/backdrop-plan.ts` and `bolt/journey.ts`).

## 8. Not done, not verified

- The small state on a phone: the drone (compact route) still passes behind the big words "ASPIRANT 5.0 TRAILER" at the lower left (390 by 844). Only the window was asked for. The same fix (the words into the layer under the canvas) would do it.
- Not looked at: Firefox, Safari, a real touch or trackpad on the pull and the exit, the production build, a weak GPU, the shadow's cost on an integrated GPU (a few more fragments around each of eleven planes).
- `PointerTrail` (`fx/backdrop/trail.ts`, its test, `uTrail`) and the `extras` plumbing in `params.ts` are still unused by every kind (from round three) and can go in the cleanup pass. The storm palette of the `ink-field` is still in `palettes.ts`, unused.
- `docs/design/home/fx-video-plane.md` and `fx-backdrop.md` still describe the effects overlay, the sweep and the dark ink field.
- Tests run: `kernel/scrub.test.ts`, `sections/backdrops.test.ts`, `sections/strip/*`, `fx/video-plane/*`, `fx/backdrop/*`, `kernel/plays.test.ts` (all pass after the edits above). No full run, no check, no e2e.
