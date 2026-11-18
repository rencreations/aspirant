# Home round two, R-B: bolt, fall, hand, list (triggered scenes, backdrops, shorter)

The owner's feedback of 19 Nov (`docs/superpowers/specs/2026-11-19-home-feedback-request.md`): shorter animations, trigger based scenes with a scroll lock (down and up), live backgrounds, a UX pass. This note covers the four sections `bolt`, `fall`, `hand`, `list`. It replaces the beat tables of `section-bolt-fall.md` and `section-hand-list.md` (the files, the actors' joints J4 to J8 and the interactions there still hold). The actors' looks (toon shading, the doll's size, the dragon's straight head) are other helpers' and were composed with, not touched.

## 1. What changed, in one paragraph

Every big scene of the four sections is now a play (`kernel/plays.ts`): the visitor scrolls to a threshold, the scene runs by itself on a clock, the page is held until it ends, and scrolling back across the threshold plays it backwards (shorter). The sections are written in beat time (a unit of their own, about one second of the scene), no longer in screens, so a length in `index.ts` can change without moving a beat. The four sections shrank from 18.6 to 10.3 screens with no dead scroll. Each section has a live backdrop (`fx/backdrop`) that changes with the beats. The old green `.tint`, `.glow` and `.band` layers of the bolt are gone (they hid the backdrop and could not fade across the section joint).

## 2. Stations, thresholds, durations

Positions are screens from the section's start. Absolute positions are from the registry of this run (bolt 3.3, fall 6.0, hand 7.2, list 8.6); they move with the sections before. `at` is where the play fires going down, the back run fires `hyst` below it (0.12 screens for bolt, fall and hand, 0.2 for the list).

| section                                | play           | fires at             | beat time (from to)             | seconds         | back | what the visitor sees                                                                                                                                                                         |
| -------------------------------------- | -------------- | -------------------- | ------------------------------- | --------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bolt (2.7 screens, lead 0.5, no tail)  | arrive         | 0.25                 | 0 to 1.3                        | 1.6 linear      | 0.7  | the dragon comes in fast along the tib path from the lower right, one barrel roll, brakes at the middle; the doll screams, is dizzy, grins; the first pair rises on the wheel                 |
|                                        | wheel 2 to 5   | 0.75, 1.2, 1.65, 2.1 | 1.3 to 1.8 to 2.3 to 2.8 to 3.3 | 0.6 each, inOut | 0.7  | the wheel turns one pair; the doll's face changes (grin, smug, sparkle, determined, heart eyes)                                                                                               |
| fall (1.2 screens, lead 0.5, no tail)  | throw and fall | 0.2                  | 3.3 to 6.6                      | 3.0 inOutSoft   | 0.6  | the dragon rears (3.3 to 3.9), the sneeze throws the doll (3.9), the camera follows and zooms, comic air marks, "5 Phases" then "10 Characters" stands, the doll hangs at the middle top (J6) |
| hand (1.4 screens, lead 0.5, tail 0.4) | rise           | 0.2                  | 0 to 2.1                        | 2.1 linear      | 0.7  | the hand rises, the doll falls into the palm and lands (poof), stands up, sits; "2022 - Present", the description and the hint come in; the fingers go live                                   |
| list (5.0 screens, lead 0.4, tail 0.5) | toss           | 0.5                  | 0 to 1                          | 2.0 linear      | 0.7  | she stands up in the palm, crouches, is tossed to the frame's top edge and sits; the hand sinks away; the first name comes in                                                                 |
|                                        | frame 2 to 10  | 0.9, 1.3 ... 4.1     | 1 to 2 ... 9 to 10              | 0.7 each, inOut | 0.7  | the strip turns to the next frame; she hops and lands on the edge; the name slides; the backdrop turns to the picture's colours                                                               |
|                                        | grow           | 4.5                  | 10 to 11                        | 1.8 linear      | 0.7  | Selena's frame grows into the whole screen, she plays her way out and idles, the doll stands and hangs from the top edge (J8)                                                                 |

Rests (the frames the visitor stands in, each looked at): bolt before the arrival (aurora only), the five wheel stations, the fall's rest ("10 Characters" with the doll between), the hand's rest (words, hint, live fingers), the join frame (the hand holds her under the arrived frame), frame 0 to 9, the grown frame. Dwell between two triggers is 0.4 screens in the list and bolt, 0.45 in the bolt's wheel, 0.8 from the last name to the throw, about 0.8 at the hand's rest.

Joined by the scroll (a few tenths of a screen, kept scroll linked on purpose because they are the way from one rest to the next trigger): the strip to bolt lead (the backdrop rises), the fall's last half screen (the fingertips come up, "10 Characters" leaves upward, `CHARACTERS_OUT` in `fall/runtime.ts`), the hand to list join (`JOIN_AT` in `hand/timeline.ts`: the hand comes down 0.08 H, the words are left behind above, the frame arrives behind the hand).

Longest hold: one trigger holds the scroll at most 3.0 s (the throw), a turn of the wheel 0.6 s, a turn of the strip 0.7 s. A hard flick that never lifts chains plays: the whole bolt and fall is 1.6 + 4 x 0.6 + 3.0 = 7.0 s of scenes, in one go, each of them locked (the owner asked for this). A Page Down is 0.875 screens and fires what it crosses in a chain.

## 3. The API other helpers use

```ts
// kernel/beat.ts (pure, no registry: a section's index.ts may import it)
playsOf(first, last, screens, steps: BeatStep[]): HomePlay[]   // BeatStep: { atScreens, to (beat), seconds, ease?, back? }
beatOf(v, length, screens): number     // v in 0..1 -> beats; the lead and the tail stay in real screens
beatFor(v, first, last, screens): number

// sections/hand/carry.ts: the hand and the doll are one carry
carry.drive(t, ts, u, frame, withDoll)   // t: the hand's beat (0..2.1), ts: screens past the hand/list joint, u: the list's beat (0..11)
carry.apply(_t, frame, withDoll)         // the END of the list (joint J8), what the selena section asks for; the number is ignored

// sections/bolt/backdrop-plan.ts, hand/backdrop-plan.ts, list/backdrop-plan.ts: pure plans, one per scene
planBackdrop(t, plan), planHandBackdrop(t, plan), planListBackdrop(index, growth, plan)
```

Files: `bolt/stations.ts` (beats, wheel, `BOLT_STEPS`, `FALL_STEPS`), `hand/stations.ts` (`HAND_STEPS`, `LIST_STEPS`, `frameRestScreens(i)`: the scroll that rests on frame i, used when the keyboard focuses a name), `list/palettes.ts` (the ten backdrop palettes, apart from `frames.ts` which a test holds equal to `picks.json`). The stations files import no registry (the registry imports the sections' `index.ts`, which import them).

Rules that make the pair of sections safe: bolt has no tail and its last threshold is 0.6 screens before its end, so the fall's lead (0.5) only ever draws the same moment (the last wheel station, `t = 3.3`) and the scene is never fed two different times in one frame; the fall has no tail for the same reason against the hand; the toss of the list fires after the hand's tail (0.4) is over.

## 4. Backdrops chosen (all `storm`, all transform free, all behind the stage)

| where                                       | kind        | colours                                                                         | notes                                                                                                                       |
| ------------------------------------------- | ----------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| bolt, every rest                            | aurora      | mint to deep green                                                              | rises in the lead; its speed lifts during the arrival; amount 0.85, text stays readable (checked at the wheel)              |
| the sneeze and the throw (beat 3.45 to 4.3) | lightning   | pale mint, cyan, white                                                          | the dragon is frightened                                                                                                    |
| the fall (4.3 to 6.2)                       | speed lines | white, ice blue, pink                                                           | speed follows the play (the scroll is held, so the kind's own scroll speed is 0): `planBackdrop` sets `speed` from the beat |
| the fall's rest, the hand before it rises   | aurora      | blue, violet, cyan                                                              | the doll hangs in it; "10 Characters" stands on it                                                                          |
| the hand from its rise                      | galaxy      | pink, violet, cyan, white                                                       | the deep nebula behind the palm and the words                                                                               |
| the list                                    | silk        | four stops per picture from the picture's dominant colours (`list/palettes.ts`) | turns with the strip (the backdrop follows at 7 a second); amount 0.6; speed lifts as Selena's frame grows                  |

A change of kind cross-fades 0.5 s of the clock. The kind never changes on a station, only between them (`BACKDROP_AT`). Selena's section (R-C) takes the backdrop over at its start.

## 5. Audit (as a demanding art director)

Found and fixed:

1. Scenes were scroll linked: the whole fall, the dragon's flight and the strip stepped with the wheel's speed, and a stop mid scene froze a half drawn composition. Now plays with rests.
2. Dead scroll: bolt 4 + fall 2.6 + hand 3.4 + list 8.6 screens. Now 2.7 + 1.2 + 1.4 + 5.0.
3. The green tint, glow and band layers sat over the backdrop slot (opaque, could not fade at the joint to the fall). Removed, the aurora does the work.
4. The wheel's lower neighbour name ran across the doll on the dragon's head at the rest. Wheel moved up (`--wheel-y` 20 percent) and the dragon's centre key 0.07 lower (`path.ts`).
5. The fall's middle column was sized for the old doll (0.34 of the height); with the smaller doll "10 Characters" stood far from her. Column 0.24 and the font clamp follow.
6. The fall's air streaks never ended at the rest (0.25 stayed); they are gone by the last half beat and the loops stop at the end.
7. Comic marks of the carry (the palm's poof, the frame's poof and dust) were sized for the old doll: scaled by `drawnHeight`.
8. The rear and fright of the dragon began half a screen before the last name and the rest frame showed a frightened dragon. They begin after the last station and the head is down again for the sneeze.
9. The doll's faces ran at a scroll rate in the fall (shocked for 0.1 s); `moodT` is two a beat now, resigned only at the very end.
10. A "hop" between frames was missing: she hops (3 percent of the screen) with a flail and a knock on every frame.
11. The keyboard: a focus on a name moves the page to that frame's rest (`frameRestScreens`). Checked in the real page: a focus on the fifth name (Lesley) from the top of the page lands on its rest with five plays fired, and the next Tab lands on Layla's.

12. The doll's face clock: the carry's mood time is the hand's beat plus the list's (`t + u`), so the list gets its grin, smile, worry and determined (a unit test of the table did not catch the call that still passed `t`; seen in frames).

Failing checks in this tree, not from this work: the e2e "the scene follows the scroll and every section hides what is not its own" fails at `rows` ("too many sections on in the middle of rows: aspirants,rows,strip": the shortened sections of R-A overlap three deep). It stops before it reaches bolt, fall, hand and list, which were checked by hand: in the middle of each, at most two sections run.

Found and not fixed:

- The first frame's arrival is not a play (a deviation from the brief): it fades in with the scroll over 0.4 screens of the join with the hand's words leaving, and only the toss, the strip and the growth are plays. The words are in the hand's runtime and the frame in the list's, and two runtimes cannot share a clock without a state that a jump into the list would lose (the hand is not mounted that far behind).
- The strip's last play (R-A) fires at 0.25 screens before the bolt's arrival threshold, inside the bolt's lead: the dragon's arrival is two triggers after the strip's end, 0.25 screens apart.
- The comic "cloud" marks of the fall (two white blobs that rise from the lower corners) look like cotton balls over the speed lines. They are `fx/comic-marks` and the bolt scene's, not changed.
- A resize in the middle of the list moves the page by the ratio of the heights, which fires plays on the way (frames advance). The kernel treats a resize as a scroll. A visitor who resizes mid page is rare.
- The fall's rest has the text row high on the screen (it must, the hand's first frame J6 is pinned there) and the lower half is the aurora and the fingertips to come.
- The sky panel of the list's end (`SKY`, J8) is opaque, so the backdrop is hidden under it for the last second.
- The reverse of the throw puts the doll back on the dragon's head with a small pop (a free doll becoming a riding one). Looked at in frames, not hard to see, not smoothed.

## 6. UX checks (real Chrome, dev server)

- Wheel against a running play: the page does not move (`S` 9.103 before and after twelve wheel notches up). Hard wheel and Page Down hold the same way. Touch (CDP touch on 390 x 844): a swipe fires a play; two swipes (up and back) made during a running play moved the page by 0.077 and 0.033 screens (70 and 30 px), so touch is not held to the pixel: it may be the glide of the swipe that fired the play, not a leak, and it was not told apart.
- Up and down at every threshold: walked down with the real wheel: the arrival, the four wheel turns, the throw, the hand's rise, the toss, nine turns of the strip and the growth. Walked up: the growth, four turns of the strip, the throw (the doll goes back to the head), the last wheel turn, the toss and the hand's rise. The lock landed on the visitor's own position (`moved` under 0.1 screens of the smooth scroller's last glide). A hard flick chain through the whole bolt and fall reached the throw in one go.
- Jumps: a seek into any section rests on the right station for the position (seen in the rest sheets).
- Keyboard: a focus on a name from outside the list lands on its frame; the next Tab goes to the next frame; the e2e "every section's first and last control shows when the keyboard reaches it" passes on the dev server.
- Phone (390 x 844): the wheel, the stacked "10 / doll / Characters", the hand, the list frames and the end were looked at at rest and during the bolt and fall plays.
- Contrast: white names over the aurora at amount 0.85 stay readable (the existing dark halo on the wheel), "2022 - Present" over the galaxy, the names over the silk (the pink Obsidia silk is the loudest: 0.6).
- A calm cue: none was added. The hero's "Scroll" cue is the page's one cue, the hand has its own hint, and every rest is a composed frame with the next picture or name already visible. Left for the owner.
- One version only: no device or connection check, no reduced variant. Backdrops are the same for everybody.

## 7. Numbers to tune

`bolt/stations.ts` (every beat, `BOLT_STEPS`, `FALL_STEPS`), `bolt/backdrop-plan.ts` (`BACKDROP_AT`, amounts), `bolt/path.ts` (the centre key's y), `bolt/bolt.module.css` (`--wheel-y`), `fall/runtime.ts` (`IN`, `PHASES_OUT`, `CHARACTERS_OUT`), `fall/fall.module.css` (the middle column), `hand/stations.ts` (`HAND_STEPS`, `STEP` and `FIRST_AT` of the list), `hand/timeline.ts` (`HAND_AT`, `LIST_AT`, `JOIN_AT`), `hand/carry.ts` (`HOP`, `ARC`, `TOSS_FLICK`), `list/palettes.ts`, `list/backdrop-plan.ts`, the sections' `screens`, `lead`, `tail` in their `index.ts`.

## 8. How to look

Dev server `http://localhost:3100`. Scripts (outside the repo) in `D:\ren\aspirant-work\home\R-B\`: `cast.cjs` (a real wheel walk with a CDP screencast of every play, `FROM`, `OFF`, `PLAYS`, `DIR=up`, `STEP`, `SIZE`; run it with `run.sh`, which retries when the dev server reloads), `rests.cjs` (stills of every rest), `ux.cjs` (`CHECK=flick|pagedown|wheelup|resize|touch`), `focus.cjs` (keyboard), `palette.py` (the dominant colours of the frames). `scripts/qa/probes/home-s4a.cjs` was moved to the new rests. `window.__home.plays()` says where every play is.

Checks run: `npx vitest run src/features/home` (195 files, 2103 tests, all pass), `eslint`, `prettier`, `tsc` (no error in these folders), `knip` (nothing of these folders), `scan-text`.

## 9. Not verified

- The production build (no build was made: the owner's server on port 3000 must not be touched). The frame times of the plays and the backdrop next to the stage on a weaker GPU were not measured.
- Firefox, Safari, a real phone, a weak machine, sound.
- Mount states at S = 0 (intro off): bolt and hand were `ready` already (their `mountAhead` of 9 and 12 screens reached back past the top of the shortened page), so the dragon, the doll, the hand and Selena were built during the hero. I set the hand's `mountAhead` to 5 (it mounts from S 1.7); bolt cannot mount later than the top of the page with 2.8 screens before it. Not measured with the opening on (the probes run with `aspirants:intro` off): a long-task log of the hero's opening on the production build is the check to make before the push.
- The first loading screen and the opening (boot, tap gate, intro) were not run in this work.
- The reverse of the fall frame by frame at 60 fps; the dev server with a screencast on runs at about 20 frames a second, so the plays last longer in wall time there (the clock is capped at 50 ms a frame).
- `home-s4a.cjs` ran 8 of its checks to the end; the dev server reloaded the page under it (other helpers' edits). The keyboard, the open view and the touch tap were checked by the scripts above.
