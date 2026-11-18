# Home round two, range R-D: chase, bend, archive, footer, the way to About

The owner's feedback of 19 Nov (`docs/superpowers/specs/2026-11-19-home-feedback-request.md`): shorter animations, trigger based scenes with a scroll lock (down and up), live backdrops, check the UX. This note is for the four sections `chase`, `bend`, `archive`, `footer` and the exit to `/about`. Kernel API: `kernel-plays.md`. Backdrops: `fx-backdrop.md`. Older notes of these sections (`section-funny-chase.md`, `section-bend.md`, `section-archive-footer.md`, `integration-W4-D.md`) still describe the beats; the times and lengths below replace theirs.

## 1. What changed, in one table

| section | before                              | now                                                                                     | scroll length |
| ------- | ----------------------------------- | --------------------------------------------------------------------------------------- | ------------- |
| chase   | 4 screens, everything scroll linked | 2 plays (2.4 s, 2.0 s), 3 backdrops                                                     | 4.0 to 2.4    |
| bend    | 9 screens, everything scroll linked | 3 plays (2.7 s, 2.6 s, 2.3 s), 9 backdrops (the four elements, wall, ring, spiral, end) | 9.0 to 2.0    |
| archive | 3 screens, scroll linked            | 1 entry play (1.8 s), the tour and the exit stay linked to the scroll, 2 backdrops      | 3.0 to 2.3    |
| footer  | 1.2 screens                         | unchanged, one calm backdrop                                                            | 1.2           |

Total in the range: 17.2 screens to 7.9. A full pass down locks the page for 13.8 s (six plays), a pass up for about 8 s (each back run is 0.5 to 0.7 of the forward one). Measured with a real wheel in dev: down 26 s for the whole range at 1.6 screens a second, of which the plays are 16 s (the dev frame rate stretches a play by up to 1.3 times, because `dt` is capped at 0.05 s; the production build should be on time).

## 2. Stations, thresholds, durations

Screens are measured from the section's start. The threshold fires the play when the real scroll reaches it going down. Going up the play runs back when the scroll is below it by the hysteresis (`hystOf`: 0.12 screen at these lengths). `back` is the share of the forward time.

**chase** (`sections/chase/index.ts`, `local` is the story's clock `T` of `timeline.ts`, not the scroll)

| station    | local | frame                                                                    | fires at (screens) | play                                                |
| ---------- | ----- | ------------------------------------------------------------------------ | ------------------ | --------------------------------------------------- |
| 0 (J12)    | 0     | empty and light (the funny section's end)                                |                    |                                                     |
| 1          | 0.46  | Tetra stands in the middle, panting (steam, sweat), soft aurora behind   | 0.9 (local 0.375)  | doll, Silverbolt, Tetra run: 2.4 s linear, back 0.5 |
| 2 (to J13) | 0.90  | she reads, the camera is in, COMIC, the two comics, the button, halftone | 1.6 (local 0.667)  | wave, sit, zoom, words: 2.0 s linear, back 0.55     |

The first threshold is after the funny section's tail (0.8 screen, `funny/index.ts`): its duo and words ride up with the scroll, and a play that held the page there froze them half way up (seen on a phone). `plays.test.ts` fails if funny's tail grows past the threshold less 0.05. The words of the chase come in with the second play and leave with the scroll over 0.3 screen after the section's end (`wordsLeave(frame.S, sectionEnd("chase"))`, so a section passed by a jump, replayed at its last station, shows none). Dwell after the second play: 0.8 screen, then the bend starts from the same frame (`bend/joints.test.ts`).

**bend** (`sections/bend/plays.ts`, the clock is `beats.ts`: `local * BEAT_SPAN` beats, `BEAT_SPAN` = `T.goTo` = 7.3)

| station     | beat | frame                                                                                         | fires at (screens) | play                                                                                       |
| ----------- | ---- | --------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| 0 (J13)     | 0    | Tetra reads (the chase's last frame)                                                          |                    |                                                                                            |
| 1 wall      | 2.55 | the wall of 22 fan posters, Tetra standing, "Fan art", "See all fanart", the credits on hover | 0.40               | the book shuts, she stands, earth, air, water, fire throw the posters in: 2.7 s, back 0.55 |
| 2 spiral    | 5.15 | the spiral of splash arts, "Artwork", "See all artwork"                                       | 0.95               | the wall gathers into a ring, it turns and is thrown away, the spiral flies in: 2.6 s      |
| 3 end (J14) | 7.30 | Tetra and the drone at the lower left                                                         | 1.50               | the spiral turns to the paper, the drone comes out, flies to her, pat, hug, they go: 2.3 s |

Dwells: 0.55 between scenes, 0.5 after the last (the archive's lead). Rests are calm on purpose: the pose is `idle` with no stance and no marks (`REST_GRACE` 0.03 beat past each rest; before this the rest frames held an air or water stance with sparkles and wind lines on). The tail is 0.3 screen (was 0.5): the archive takes Tetra and the drone from its start, and a longer tail drew Tetra again after she had run off. The beat table `T` was retimed (the old table ran 9 beats): stances 0.4 beat each, `FLIGHT` 0.5, stagger 0.04, the ring turns 1.3 rad a beat. A test holds that every poster has landed by the first rest and every splash card by the second.

**archive** (`sections/archive/plays.ts`, `route.ts`)

The tour (ten covers, the drone resting over each, the row sliding) is a list the visitor drives, so it stays scroll linked: 1.2 screens, about 0.12 a cover. Only the entry is a play. `routeS(local, S)` is the route's clock: `AT.start + min(local, done) * length + max(0, S - AT.tourFrom)`. Before the entry it rests at the start; while the play runs the scroll is held at the threshold and `local` moves; after it the clock goes on with the scroll, equal to `S`, so the footer's card (the page's flow, read from `frame.raw`) stays glued. Continuous at the threshold both ways, so the entry plays back with no step (tested).

| station | route clock (screens from the start) | frame                                                     | fires at | play                                                                                                       |
| ------- | ------------------------------------ | --------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| 0 (J14) | 0                                    | Tetra and the drone at the lower left                     |          |                                                                                                            |
| 1       | 0.4                                  | the first cover lit, "The archive", "Open the collection" | 0.4      | Tetra waves and runs off, the drone arcs over the first cover, the covers rise: 1.8 s, inOutSoft, back 0.7 |

Then the tour 0.4 to 1.6, then the exit 0.7 (covers lift, the drone flies down to the footer's ring). Tetra's run weight no longer depends on the scroll speed (it was 0.25 when the scroll was held) and she turns by the sign of the clock's change. The archive's `update` gets `local` from the plays and `frame.S` for the rest.

**footer**: unchanged (1.2 screens, the card rises, the drone bows, the hairline, the exit to About at the end of the document). It has the calm backdrop.

## 3. Backdrops chosen

Calls are made every frame the section is in range, from constant `BackdropAsk` objects (no allocation); a change of kind is the backdrop's 0.5 s cross-fade. Each section's file is `backdrop.ts` with a test.

| where                        | kind                               | why                                                                                               |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| chase, the run               | `speed-lines`, `angle: 90` (level) | streaks run past; at 90 degrees they are level with the road (checked)                            |
| chase, pant, wave, sit       | `soft-aurora`                      | a warm soft sky for the breath                                                                    |
| chase, the comic             | `pixel-blast` 0.5                  | halftone dots under COMIC. The bend asks for the same at its start: no cross-fade                 |
| bend, book, then each stance | `earth`, `air`, `water`, `fire`    | the element she bends, 0.85. The four changes are each 0.4 beat apart, so they blend              |
| bend, wall                   | `soft-aurora`                      | calm pools under the posters                                                                      |
| bend, ring                   | `iridescence`                      | marbled thin film; the best frame of the range                                                    |
| bend, spiral                 | `aurora`                           | pink and white curtains                                                                           |
| bend, drone and end          | `particles`                        | bokeh, air to breathe in                                                                          |
| archive, entry and tour      | `squares`                          | a collection grid, cells near the pointer fill; the bend's last kind stays until the entry begins |
| archive (covers out), footer | `iridescence` 0.7                  | the same numbers in both files (`archive/backdrop.ts` `CALM`), so the hand-over has no cross-fade |

Text over them is legible in every frame looked at ("Fan art", "Artwork", "The archive", the footer's words and the legal row). `warm()` is called for each section's kinds in the constructor, so the first frame of a kind does not compile a shader.

## 4. Audit

**Found and fixed**

1. The chase's middle was a screen of Tetra alone on a white page; all of it was scroll linked and 4 screens long. Two plays, a station that is a composed frame, three backdrops.
2. The bend was nine screens long; rest frames carried the last stance (sparkles at her hands, wind lines, dust clouds on the front cards). Three plays, calm rests.
3. Tetra was drawn again by the bend's tail after she had run off the archive: tail 0.5 to 0.3.
4. The chase's words left by a function of `local`, so a seek past the section replayed the comic with its words on. They now leave by `frame.S`.
5. The funny to chase joint: the chase's first play would hold the page while the funny's words were half way up (found on a phone; the funny's tail is 0.8 screen). Threshold moved, test added.
6. The keyboard focus of a bend control moved the page to a beat (screens at the old scroll law). It now moves to the dwell of the right rest (`restScreens`, `data-home-focus-at` on the groups), and the plays rest on the position.
7. The archive's Tetra ran at weight 0.25 when the scroll did not move (a play), and turned by the sign of the scroll's velocity (zero in a play). Both read the route's clock now.
8. The bend's credit plates answered the pointer for three screens; now only while the wall stands.
9. `local * screens()` in the dragon's wobble and `bendScreens()` in the drone's final glide tied beats to the section's length; both read their own constant (`STORY_SCREENS`, `T.goTo`).

**Found and not fixed**

1. The bend has 32 tab stops (15 credit plates with two links each, between "Fan art" and "Artwork"). A roving tabindex is the fix; the plates are also required by the takedown rule, so none was removed.
2. A single very hard flick (a 5000 px wheel event) teleports the page past a section: the machine enters it at `local > 0.5` and treats it as entered from below, with everything fired (`PlayMachine.enter`). A hard hand scroll, a Page Down and the End key do chain each play (all six fired in a wheel of 160 px every 12 ms). That is the kernel's rule; left.
3. No cue at the rests (after a play nothing says "scroll on"). The page has the bar and the hero's cue only. A small cue that fades in 0.6 s after a rest would be right; it is not built.
4. The dev server takes 40 s (once, with the machine busy, 184 s) to mount the bend after a far jump (a keyboard focus from the top of the page): the card layer, Tetra, the drone and the marks load at once, and the words of the focused control stay at opacity 0 until the runtime is ready. Not measured on the production build.
5. The four stances are 0.4 beat each (about 0.45 s) and the backdrop's cross-fade is 0.5 s, so the earth, air, water and fire backdrops are never fully formed in the first play; in the frames looked at each reads (boulders, wind, caustics, flame), but a visitor who wants to see an element in full would need a longer stance. A stance of 0.8 s would add 1.6 s to the play.
6. First-draw hitches in dev: 100 to 217 ms in the first bend play (shader and texture first use), 4 to 7 frames over 50 ms in a play. Median 16.7 ms, p95 17 ms at 1440x900 during bend plays 1 and 2.

## 5. How to look

`D:\ren\aspirant-work\home\R-D\`: `drv.cjs` (open, seek, wheel), `cast.cjs <section> <w>x<h> <prefix> <offset> <wheelScreens> [step] [plays]` (a screencast of a real wheel run, a frame every 0.25 s of the play, then `stitch.py`), `playshot.cjs` (timed screenshots), `sheet.cjs` (rest frames by `seek`, `SCREENS=1` for offsets in screens), `walk.cjs` (a real wheel down or up through chase to footer, logs every play and the longest stall), `ux.cjs` (flick, keys, tab, jump), `perf.cjs`, `run.cjs` (reruns a script when the dev server reloads the page under it). `window.__home.plays()` and `state().playing` say what runs.

## 6. Verified (dev server, real Chrome, the pictures were looked at)

- Down and up with a real wheel at 1440x900 (`walk.cjs`): all six plays fire at their thresholds, forward and back, the page never moves during a play, the wheel is free after each, no stall without a play, no console error. A very hard wheel (160 px every 12 ms) fires all six.
- Page Down x10, End, Home (`ux.cjs keys`): the plays chain and lock; End and Home move at once with no hold. A jump away in the middle of a bend play ends it and lets go of the lock; a reload in the middle of a play comes back at S 0 with no lock.
- Frame sheets by screencast of every play at 1440x900: chase 1 and 2, bend 1, 2 and 3, the archive's entry; rest frames by `seek` of the whole archive and the footer, and at 390x844 the chase's two rests, the bend's three, the archive's tour. The footer and the exit hand-off with `scripts/qa/probes/home-s7b.cjs PARTS=handoff`: by wheel About's phases read wait, title, landing, landed, done; by the button wait, done.
- The credit plate on the wall at the first rest (the window `holdFrom - 0.2` to `holdTo + 0.5` beats): a hover on a poster shows "Fan work", the title, the credit, "View the original" and "Copyright or takedown" (picture looked at); "Fan art", "See all fanart" and the takedown link stand in the rest frame.
- Frame times during bend plays 1 and 2: median 16.7 ms, p95 17.0 and 16.9 ms.
- Tests: `npx vitest run src/features/home` 2123 passed (197 files); `eslint`, `tsc --noEmit` and `prettier` clean for the four folders; `knip` clean for them; `scan-text` 0 problems. New: `bend/plays.test.ts`, `bend/backdrop.test.ts`, `chase/plays.test.ts`, `chase/backdrop.test.ts`, `archive/backdrop.test.ts`, the route's clock in `archive/route.test.ts`.

## 7. Not verified

The production build and `scripts/perf/weak.mjs`; Firefox and Safari; a real phone (the 390x844 runs are desktop Chrome with touch emulation, and the touch drag through a lock was only proven by K5 on the fall); a resize in the middle of a play; a real Tab walk through the bend's plates and the archive's ten covers (focus from far was done with `page.focus`, which is not focus-visible, so the archive's own scroll to the cover was not exercised); `e2e/home.spec.ts` (not run: it seeks to the middle of each section and expects every actor, which the new rests satisfy by reading, not by a run); a throttled network for the fan pictures at the wall (the colour-first card is there, seen only as brown squares after a cold seek on a phone); the N key of the exit probe printed `201ms / null` in one run and was not rerun; the hand-over of the backdrop when the visitor jumps from far above into the archive.

## 8. Numbers to tune

`chase/index.ts` thresholds and seconds; `chase/backdrop.ts`; `bend/beats.ts` `T`, `REST_GRACE`; `bend/formations.ts` `FLIGHT`, `ringTurn`; `bend/plays.ts` `BEND_SCREENS`, `FIRE_AT`, seconds, `back`; `bend/backdrop.ts`; `archive/plays.ts` `ARCHIVE_SCREENS`, `ENTRY_SCREENS`, `EXIT_SCREENS`, seconds; `archive/route.ts` `AT`; `archive/backdrop.ts`. After a length change run `npx vitest run src/features/home` and read the failures: they are the pins (`plays.test.ts` of chase and bend, `route.test.ts`).

## 9. Files

Added: `chase/backdrop.ts`, `chase/backdrop.test.ts`, `chase/plays.test.ts`, `bend/plays.ts`, `bend/backdrop.ts`, `bend/plays.test.ts`, `bend/backdrop.test.ts`, `archive/plays.ts`, `archive/backdrop.ts`, `archive/backdrop.test.ts`. Edited: `chase/index.ts`, `chase/timeline.ts`, `chase/runtime.ts`, `chase/timeline.test.ts`, `bend/index.ts`, `bend/beats.ts`, `bend/formations.ts`, `bend/meet.ts`, `bend/runtime.ts`, `bend/view.tsx`, `bend/beats.test.ts`, `bend/meet.test.ts`, `archive/index.ts`, `archive/route.ts`, `archive/runtime.ts`, `archive/route.test.ts`, `footer/runtime.ts`. No kernel or shared file was edited; the doll helper edited `chase/runtime.ts` (the drawn height of the doll for the marks) meanwhile and it was kept.
