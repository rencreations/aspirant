# Home round two, R-B: bolt, fall, hand, list (triggered scenes, backdrops, shorter)

The owner's feedback of 19 Nov (`docs/superpowers/specs/2026-11-19-home-feedback-request.md` and `...-feedback-2-request.md`): shorter animations, trigger based scenes with a scroll lock (down and up), live backgrounds, a longer threshold where there is text, a UX pass. This note covers the four sections `bolt`, `fall`, `hand`, `list`. It replaces the beat tables of `section-bolt-fall.md` and `section-hand-list.md` (the files, the actors' joints J4 to J8 and the interactions there still hold). The actors' looks (toon shading, the doll's size, the dragon's straight head) are other helpers' and were composed with, not touched.

Two passes. The first converted the four sections to plays and added the backdrops (it was cut off). This second pass audited every scene again with a real wheel and screencasts, finished the open defects and changed the dwells.

## 1. What changed, in one paragraph

Every big scene of the four sections is a play (`kernel/plays.ts`): the visitor scrolls to a threshold, the scene runs by itself on a clock, the page is held until it ends, and scrolling back across the threshold plays it backwards (shorter). The sections are written in beat time, no longer in screens. Each section has a live backdrop (`fx/backdrop`) that changes with the beats. This pass: the plays wait for the dragon, the doll, the hand and Selena to be built (the ready gate), the text sections ask for more scroll (0.55 of a screen for a pair name or a list name), the fall lost its two stray cloud marks, the dragon no longer hides the doll on a phone, and Selena's first draw is spent at a still frame.

## 2. Stations, thresholds, durations

Positions are screens from the section's start. `at` is where the play fires going down, the back run fires `hyst` below it (0.12 screens for bolt, fall and hand, 0.2 for the list). Lengths: bolt 3.0, fall 1.2, hand 1.4, list 6.5 (12.1 screens in all, was 10.3 after the first pass and 18.6 before).

| section                                | play           | fires at                     | beat time (from to) | seconds (measured)  | back | what the visitor sees                                                                                                                                                         |
| -------------------------------------- | -------------- | ---------------------------- | ------------------- | ------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bolt (3.0 screens, lead 0.5, no tail)  | arrive         | 0.25                         | 0 to 1.3            | 1.6 linear (1.59)   | 0.7  | the dragon comes in fast along the tib path from the lower right, one barrel roll, brakes at the middle; the doll screams, is dizzy, grins; the first pair rises on the wheel |
|                                        | wheel 2 to 5   | 0.8, 1.35, 1.9, 2.45         | 1.3 to 3.3 by 0.5   | 0.6 each (0.58)     | 0.7  | the wheel turns one pair; the doll's face changes (grin, smug, sparkle, determined, heart eyes)                                                                               |
| fall (1.2 screens, lead 0.5, no tail)  | throw and fall | 0.2                          | 3.3 to 6.6          | 3.0 inOutSoft (3.1) | 0.6  | the dragon rears, the sneeze throws the doll, the camera follows and zooms, "5 Phases" then "10 Characters" stands, the doll hangs at the middle top (J6)                     |
| hand (1.4 screens, lead 0.5, tail 0.4) | rise           | 0.2                          | 0 to 2.1            | 2.1 linear (2.13)   | 0.7  | the hand rises, the doll falls into the palm and lands (poof), stands up, sits; "2022 - Present", the description and the hint come in; the fingers go live                   |
| list (6.5 screens, lead 0.4, tail 0.5) | toss           | 0.5                          | 0 to 1              | 2.0 linear (1.98)   | 0.7  | she stands up in the palm, crouches, is tossed to the frame's top edge and sits; the hand sinks away; the first name comes in                                                 |
|                                        | frame 2 to 10  | 1.05, 1.6 ... 5.45 (by 0.55) | 1 to 2 ... 9 to 10  | 0.7 each (0.68)     | 0.7  | the strip turns to the next frame; she hops and lands on the edge; the name slides; the backdrop turns to the picture's colours                                               |
|                                        | grow           | 6.0                          | 10 to 11            | 1.8 linear (1.78)   | 0.7  | Selena's frame grows into the whole screen, she plays her way out and idles, the doll stands and hangs from the top edge (J8)                                                 |

Dwell, the scroll between two triggers (the owner: "put a scroll threshold, so user need to scroll more"). Bolt: 0.55 between turns of the names (was 0.45), 0.75 from the last turn to the throw. From the throw to the hand's rise: 1.0 screen (about 0.55 of it at "10 Characters" before the fingertips come up). From the rise to the list's toss: 1.7 screens, about 1.3 of them at "2022 - Present" and 0.4 of join. List: 0.55 for each frame (was 0.4) and 0.5 after the grow. A wheel notch is 100 px (0.11 of a screen at 900 px): a name takes five notches. Deviation from the brief, which asks 0.8 to 1.3 screens for text sections: the pair names and the list names are one word each, ten frames at 0.8 would make an eight screen list, and the owner's first word was "too long". The hand's words get 1.3. `stations.test.ts` of the bolt and the hand hold these (at least 0.5 between two names).

Rests (each looked at): bolt before the arrival (aurora only), the five wheel stations, the fall's rest ("10 Characters" with the doll between), the hand's rest (words, hint, live fingers), the join frame (the hand holds her under the arrived frame), frame 0 to 9, the grown frame.

Joined by the scroll (a few tenths of a screen, kept scroll linked on purpose: they are the way from one rest to the next trigger): the strip to bolt lead (the backdrop rises), the fall's last half screen (the fingertips come up, "10 Characters" leaves upward, `CHARACTERS_OUT` in `fall/runtime.ts`), the hand to list join (`JOIN_AT` in `hand/timeline.ts`).

Longest hold: one trigger holds the scroll at most 3.0 s (the throw), a turn of the wheel 0.6 s, a turn of the strip 0.7 s. A hard flick that never lifts chains the plays: the longest continuous hold in the real wheel flick was 2.99 s per play, the whole bolt and fall is 7.0 s of scenes in one go, each locked.

## 3. The API other helpers use

```ts
// kernel/beat.ts (pure, no registry: a section's index.ts may import it)
playsOf(first, last, screens, steps: BeatStep[]): HomePlay[]
beatOf(v, length, screens): number
beatFor(v, first, last, screens): number

// The ready gate (kernel/types.ts SectionRuntime.ready?, wired in kernel/run.ts by K6)
BoltRuntime.ready()  FallRuntime.ready()   // scene.gate.done: the dragon and the doll are built and warmed
HandRuntime.ready()                         // the hand and the doll are built (setCarry was called, with or without them)
ListRuntime.ready()                         // the carry and Selena are built (or failed for good)

// sections/bolt/build-gate.ts
class BuildGate { done; hurry(); hurried; pause(quiet: () => Promise<void>): Promise<void>; finish() }

// sections/hand/carry.ts: the hand and the doll are one carry
carry.drive(t, ts, u, frame, withDoll)   // t: the hand's beat (0..2.1), ts: screens past the hand/list joint, u: the list's beat (0..11)
carry.apply(_t, frame, withDoll)         // the END of the list (joint J8), what the selena section asks for

// sections/*/backdrop-plan.ts: pure plans, one per scene
planBackdrop(t, plan), planHandBackdrop(t, plan), planListBackdrop(index, growth, plan)
```

A build that fails is finished too (`finally`), so one missing actor never stops the plays for ever. `BoltScene.update` calls `gate.hurry()` while the build is not done: a section is running, so the visitor is there, and every pause for a quiet scroll in the build ends at once, including the ones inside `warmCast` (a small additive option `WarmOptions.quiet` in `actors/shared/warm.ts`, the only shared file edited). Measured on the dev server with a wheel that never lifts: the bolt's plays waited (`waiting`, nothing held, the page free) for about 3 s after the first frame of the section, down from about 7.4 s before the hurry reached `warmCast`. A visitor who keeps wheeling meanwhile has passed the thresholds when the gate opens, and the kernel then chains the due plays in a row (the arrival and three wheel turns, 3.4 s, each locked): the gate delays, it does not rest the scene. The list's gate is per beat: the toss and nine turns need the hand and the doll only, Selena is waited for only from the turn to her frame (`this.u < SELENA_AT`).

Files: `bolt/stations.ts` (beats, wheel, `BOLT_STEPS`, `FALL_STEPS`), `hand/stations.ts` (`HAND_STEPS`, `LIST_STEPS`, `frameRestScreens(i)`), `list/palettes.ts` (the ten backdrop palettes, apart from `frames.ts` which a test holds equal to `picks.json`). The stations files import no registry (the registry imports the sections' `index.ts`, which import them).

Rules that make the pair of sections safe: bolt has no tail and its last threshold is 0.55 screens before its end, so the fall's lead (0.5) only draws the same moment (the last wheel station, `t = 3.3`) and the scene is never fed two different times in one frame; the fall has no tail for the same reason against the hand; the toss of the list fires after the hand's tail (0.4) is over.

## 4. Backdrops chosen (all `storm`, all transform free, all behind the stage)

| where                                       | kind        | colours                                                                         | notes                                                                                                                       |
| ------------------------------------------- | ----------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| bolt, every rest                            | aurora      | mint to deep green                                                              | rises in the lead; its speed lifts during the arrival; amount 0.85, text stays readable (checked at the wheel, phone too)   |
| the sneeze and the throw (beat 3.45 to 4.3) | lightning   | pale mint, cyan, white                                                          | the dragon is frightened; the kind strikes every 2.2 s, in 0.85 s the visitor mostly sees its vein net, not a strike        |
| the fall (4.3 to 6.2)                       | speed lines | white, ice blue, pink                                                           | speed follows the play (the scroll is held, so the kind's own scroll speed is 0): `planBackdrop` sets `speed` from the beat |
| the fall's rest, the hand before it rises   | aurora      | blue, violet, cyan                                                              | the doll hangs in it; "10 Characters" stands on it                                                                          |
| the hand from its rise                      | galaxy      | pink, violet, cyan, white                                                       | the deep nebula behind the palm and the words                                                                               |
| the list                                    | silk        | four stops per picture from the picture's dominant colours (`list/palettes.ts`) | turns with the strip (the backdrop follows at 7 a second); amount 0.6; speed lifts as Selena's frame grows                  |

A change of kind cross-fades 0.5 s of the clock. The kind never changes on a station, only between them (`BACKDROP_AT`). Selena's section (R-C) takes the backdrop over at its start.

## 5. Audit (as a demanding art director)

Looked at with a real wheel and a CDP screencast of every play (frames 0.15 s apart, read as contact sheets) at 1440x900, and the rests at 390x844.

Found and fixed, first pass:

1. Scenes were scroll linked: the fall, the dragon's flight and the strip stepped with the wheel's speed, and a stop mid scene froze a half drawn composition. Now plays with rests.
2. Dead scroll: bolt 4 + fall 2.6 + hand 3.4 + list 8.6 screens. Now shorter (section 2).
3. The green tint, glow and band layers sat over the backdrop slot. Removed, the aurora does the work.
4. The wheel's lower neighbour name ran across the doll at the rest: wheel moved up (`--wheel-y` 20 percent), the dragon's centre key 0.07 lower (`path.ts`).
5. The fall's middle column was sized for the old doll; column 0.24 and the font clamp follow the smaller one.
6. The fall's air streaks never ended at the rest: they are gone by the last half beat and the loop stops.
7. Comic marks of the carry (the palm's poof, the frame's poof and dust) were sized for the old doll: scaled by `drawnHeight`.
8. The rear and fright of the dragon began half a screen before the last name: they begin after the last station.
9. The doll's faces ran at a scroll rate in the fall: `moodT` is two a beat now, resigned only at the very end.
10. A hop between frames was missing: she hops (3 percent of the screen) with a flail and a knock on every frame.
11. The keyboard: a focus on a name moves the page to that frame's rest (`frameRestScreens`).
12. The doll's face clock in the list used the wrong time (`t + u`).

Found and fixed, this pass:

13. A play fired before its actors were built. Seen on a fresh page: the arrival fired while the dragon was still loading, one frame took 7 s, and the play's own safety cut it short (the dragon jumped to the end). Now `ready()` in the four runtimes, `BuildGate` and the `quiet` option of `warmCast` (section 3). On the real page, a seek to the bolt right after the opening and a real wheel: the bolt's play reported `waiting` for about 3 s, nothing fired and nothing held the scroll until the build was over; then the due plays chained (see section 3). A hurried cold build is about 3 s on the dev server; the hero's opening on the production build normally builds it long before the bolt.
14. Two white cloud marks stood still in the lower middle of the fall for 1.5 s and read as a stray blob over the speed lines (the first pass listed them as not fixed). Removed (`makeClouds` and its loops are gone from `scene.ts`); the air streaks stay. The owner's word for the loader was "only the effects that are necessary".
15. On a phone the dragon faced the lens straight on, the head pitched up 31 degrees turned its back over the doll, and she was hidden behind the mane at every wheel rest. The turn of the head now counts the width as at least 1.6 heights (`turnX` in `journey.ts`): 1440x900 and 1706x950 are unchanged to the digit, a phone gets yaw -0.54 and pitch 0.30, like a laptop. A test holds the pitch at the rests under 0.3 on all three sizes. Looked at on 390x844: her face shows at all five names.
16. Text sections needed more scroll: bolt 0.55 between names, list 0.55 between frames (section 2), two tests.
17. Selena's first real draw cost one long frame (0.88 s on the dev server) in the middle of the turn to her frame, and the frame 9 turn is where the real wheel reached it. It is spent earlier now: once the strip has sat on the third frame for half a second, she is drawn for three frames with a window of zero width (`PRIME_AT`, `PRIME_AFTER`, `NO_WINDOW` in `list/runtime.ts`), which shows nothing. A real wheel walk through the list (11 plays, long frame log, `listwalk.cjs`): the only long frame is that one (306 ms, at the rest after the third frame, not inside a play), and the turn to her frame, the frames after it and the growth have none above 110 ms. It is moved, not removed: the cause (clip, skin or ink) was not found, and a visitor who flicks past the third frame without resting still meets it at her turn.
18. The list's plays no longer all wait for Selena (the gate is per beat, section 3): a late model cannot hold the toss and nine turns and then chain ten seconds of scenes.
    Found and not fixed:

- The fall's rest has the text row high on the screen (J6 pins the doll there, the hand's first frame starts from it) and the lower 60 percent is the aurora and the fingertips to come. Moving it needs `END_FEET_Y` in `bolt/journey.ts`, `J6` and `airY` in `hand/timeline.ts` together. It reads as a poster with the hand to come; left.
- The doll that leans back about 55 degrees in Silverbolt's mouth is the funny section's, not done here and not handed to a person (no helper could be messaged from this session): `sections/funny/runtime.ts` (about line 397) seats her on the `mouth` socket, which turns with the straightened head. The dragon actor already has the cure for the head's seat: `seatFix` and `uprightFix` (`actors/silverbolt/actor.ts`, `straight.ts`) turn `headTop` back by the head's turn. The same is needed for `mouth` (an upright mouth seat in the actor), or the funny section can add the opposite pitch to `doll.place`. Nothing in bolt, fall, hand or list uses the mouth: the doll rides `headTop`, upright (looked at in every rest).
- The first frame's arrival is not a play: it fades in with the scroll over 0.4 screens of the join with the hand's words leaving (two runtimes cannot share a clock without a state that a jump into the list would lose).
- The strip's last play fires at 0.25 screens before the bolt's arrival threshold (inside the bolt's lead): the arrival is two triggers after the strip's end, 0.25 screens apart.
- A resize in the middle of the list moves the page by the ratio of the heights, which fires plays on the way. The kernel treats a resize as a scroll.
- The sky panel of the list's end (`SKY`, J8) is opaque, so the backdrop is hidden under it for the last second.
- The reverse of the throw puts the doll back on the dragon's head with a small pop (a free doll becoming a riding one).
- In the reverse of the fall the dragon's tail trail draws an angular pale loop for about 0.4 s: its samples are sparse at the dev server's 20 frames a second. At 60 frames it has three times the points; not measured there.
- The lightning kind rarely shows a strike inside the 0.85 s it is on (a strike every 2.2 s): the veins carry it. A strike on the sneeze needs a way to set the kind's clock (`fx/backdrop`, not mine).
- At the end of the list Selena's limbs overlap in her reclining pose (R-C's composition work).
- No cue was added on the rests (the owner asked for a calm cue where the next step is not obvious). Another helper added a hairline `rest-cue` for the whole page while this ran (`home/rest-cue.tsx`); a hairline at the foot of the phone shot of the last bolt rest is probably it.

## 6. UX checks (real Chrome, dev server)

- Wheel against a running play: the page does not move (10.906 before and after twelve wheel notches up). A hard flick that never lifts chains the plays through the bolt, the fall and into the hand (longest hold 2.99 s). Touch (CDP touch on 390x844): a swipe fires a play; two swipes during it moved the page 0.1 screen (the glide of the swipe that fired it, not told apart from a leak).
- Up and down at every threshold: down the arrival, four wheel turns, the throw, the hand's rise, the toss, nine turns of the strip and the growth; up the arrival (1.2 s), the throw (2.3 s, the doll goes back to the head, sheet read) and the hand's rise (1.5 s, sheet read). The back run of the toss, the strip and the growth was walked in the first pass and not again. The lock lands on the visitor's own position.
- Jumps: a seek into any section rests on the right station (rest sheets). A seek into the list shows Selena in the frame 9 rest, in the grown frame and at the end (looked at).
- Keyboard: a focus on a name from outside the list lands on its frame (checked in the first pass, `focus.cjs`; the thresholds changed, the arithmetic is `frameRestScreens`).
- Phone (390x844): the wheel at the first and last pair, the stacked "10 / doll / Characters", the hand, the list frames 0, 1, 8, 9 and the end were looked at.
- Contrast: white names over the aurora at amount 0.85 stay readable (a dark halo on the wheel), "2022 - Present" over the galaxy, the names over the silk (the pink Obsidia silk is the loudest, 0.6).
- One version only: no device or connection check, no reduced variant.

## 7. Numbers to tune

`bolt/stations.ts` (every beat, `BOLT_STEPS` thresholds, `FALL_STEPS`), `bolt/backdrop-plan.ts` (`BACKDROP_AT`, amounts), `bolt/path.ts` (the centre key's y), `bolt/journey.ts` (`turnX`: the 1.6), `bolt/bolt.module.css` (`--wheel-y`), `fall/runtime.ts` (`IN`, `PHASES_OUT`, `CHARACTERS_OUT`), `fall/fall.module.css`, `hand/stations.ts` (`HAND_STEPS`, `STEP` 0.55 and `FIRST_AT` of the list), `hand/timeline.ts` (`HAND_AT`, `LIST_AT`, `JOIN_AT`), `hand/carry.ts` (`HOP`, `ARC`, `TOSS_FLICK`), `list/runtime.ts` (`PRIME_AT`, `PRIME_FRAMES`), `list/palettes.ts`, `list/backdrop-plan.ts`, the sections' `screens`, `lead`, `tail` in their `index.ts` (bolt 3.0 and list 6.5 follow the thresholds: the last threshold plus the rest before the tail).

## 8. How to look

Dev server `http://localhost:3100`; set `BASE` (the probe library defaults to port 3000, the owner's). Scripts, outside the repo, in `D:\ren\aspirant-work\home\R-B\ws\`: `play.cjs` (one play at a time with a real wheel, `JOBS="bolt:0.25:down,fall:0.2:up"`, a screencast and a gap log, `NOCAST=1` for timing only; it reloads itself when the dev server does), `rests2.cjs` (stills of every rest, `SIZE`, `ONLY`), `listwalk.cjs` (a real wheel walk through the list with the long frames), `gate.cjs` (the ready gate), and in `R-B\` the first pass's `ux.cjs` (`CHECK=flick|pagedown|wheelup|resize|touch`) and `focus.cjs`. Contact sheets: `lead\stitch.py`. `window.__home.plays()` says where every play is and whether it `waiting`.

Checks run: `npx vitest run src/features/home` (212 files, 2313 tests: one failure, `sections/rows/preload.test.ts`, the strip and rows helpers' work in progress; everything of the four folders and the kernel passes), `eslint` and `tsc` (no error in these folders), `prettier`, `scan-text` (0 problems), `knip` (nothing of these folders: its findings are the strip, rows, aspirants and image field helpers' work in progress).

## 9. Not verified

- The production build (no build was made: the owner's server on port 3000 must not be touched). Frame times on a weaker GPU. The long frames above are the dev server's, two to three times slower than production.
- Firefox, Safari, a real phone, a weak machine, sound.
- The cause of Selena's long first draw (moved, not removed) and of the 130 to 250 ms frames at the throw (the first draws of the sneeze's marks, probably) and at the start of the reverse fall.
- The first loading screen and the opening (boot, tap gate, intro) were not run in this work; the probes run with `aspirants:intro` off. A long task log of the hero's opening on the production build is the check to make before the push (the bolt mounts from the top of the page and builds in pauses).
- The reverse of the fall frame by frame at 60 fps (the screencast slows the dev server to about 20 frames a second).
