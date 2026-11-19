# Home round two: R-A1 (loader, tap gate, intro, hero, the drone's dialogue boxes)

The owner's words are in `docs/superpowers/specs/2026-11-19-home-feedback-2-request.md` ("Loader", "Hero", "Remove all the dialogue box"). This note replaces the intro table of `round2-R-A.md` (8 s) and the facts of `boot.md` sections 2, 3 and 7 that it names. Code: `features/home/boot/`, `components/home-boot/`, `sections/hero/`, `actors/drone/`, `fx/logo/`, `fx/image-field/` (the origin formation and the entrance only), `scripts/home/media/hero_cards.py`.

## 1. What changed

| Owner's word                                                       | What was done                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| loader: drone smaller, in the centre, the words under it           | `loaderPlace`: x 0, y 0, height 0.12 H (`LOADER_DRONE`). The mark stands above it, the bar, the real percent and words, the bytes and the groups under it, the gate's words in the status line's place. Layout in `home-boot.module.css` (`--boot-drone-half` 6.4 dvh).                                   |
| loader: comic effects too much, cut off, necessary ones only       | No speech bubbles anywhere (section 4). The pair draw no marks (their sink is null). The only mark of the opening is the drone's shock mark when it sees the pair (0.55 s, over its head, nowhere near an edge at 1440x900 and 390x844). No bang, sweat, stars, hearts, sparks.                           |
| hero: set up in 2 s at most                                        | `boot/timeline.ts`: `INTRO_SECONDS` 1.85 (section 2). Dev server click to `open` measured 2.1 s at 1440x900 and 2.5 s at an emulated phone with 2x pixels (first frames of a cold load are slow; the clock is the page's own, `dt` capped at 0.05).                                                       |
| hero: logo stiff, not wiggly, still at rest                        | `REST_WAVE` (hero) and `LOGO_REST_WAVE` (intro) are 0. The logo is taut for the whole intro (tension 1, wobble 0, struggle 0, no jolt, no overshoot, carried tilt at most 0.05 rad). The pointer ripple of the logo is now opt in (`LogoPose.ripple`, default false), so nothing moves it at rest.        |
| the morph into the bar keeps its wave                              | `waveEnvelope` (`fx/logo/math.ts`): the morph's own wave is unchanged. The calm ripple the logo used to rest in (0.3) is now the first 8 percent of the morph (`MORPH_KICK`, `KICK_IN`), so from P 0.08 on the wave is the old one to 1e-12 (`math.test.ts`).                                             |
| cards: expand from behind the logo and go out, no ring, no waiting | `origin` formation (`fx/image-field/formations.ts`): every card small (`ORIGIN_SCALE` 0.12), flat, in the logo's band, behind it (the logo is pass 15, the field 12). `sections/hero/scene.ts`: 0.7 s (`ENTRANCE_SECONDS`), nearest the middle first (`centre` rank, spread 0.2), ease out, starts at J0. |
| cards: too many duplicates, more like the splash art               | Eighteen different portraits (section 3). No picture shows twice at once.                                                                                                                                                                                                                                 |
| hero as plays                                                      | Already in `sections/hero/index.ts` (the first scroll past 0.3 screens plays the whole scene for 2.8 s, scroll held, back when scrolled up). Looked at again (section 5).                                                                                                                                 |

## 2. The intro (1.85 s, a clock, no scroll, not skippable)

Seconds since the press, `T` in `timeline.ts`. Everything overlaps the next beat.

| t            | what                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 0 to 0.2     | words and bar fade (DOM, 0.2 s). The drone is where the loader keeps it, the middle.                                                      |
| 0 to 0.58    | the pair swoop in from the left carrying the logo (small, 0.44 of the hero width), ease out, stop in the middle. Logo taut, level.        |
| 0.14         | the drone sees them: the shock mark (0.55 s), the shocked face, `peek` to the left.                                                       |
| 0.18 to 0.5  | the drone dashes under the logo (it follows the logo's target 0.14 s late, `DRONE_LAG`, because the pair follow it on springs).           |
| 0.58 to 0.76 | the three set the logo down (`logoCarried` 1 to 0, the hands lower).                                                                      |
| 0.76         | the pair take the logo's two corners (`pull`).                                                                                            |
| 0.84 to 1.4  | the logo grows to the hero width in one smooth move, no overshoot. The drone steps back to its place at rest (`routeAt(0)`, 0.88 to 1.5). |
| 1.35 to 1.8  | the pair leave (crouch, zip off). Already leaving as the logo reaches its size.                                                           |
| 1.85         | J0: logo at 70 percent (86 on a phone), still; the drone at `routeAt(0)`; the pair gone. `finishIntro()`.                                 |

Cues (`CUES`): the shock mark and four sounds (click, whoosh, star, confirm). Tests (`timeline.test.ts`): length at most 2 s, the beats in order and overlapping, J0 equals the hero at three sizes, the loader's place, the pair on screen once they are in (ten window shapes), no overshoot, the logo stiff at every frame, no jump, the cues make no mark but the shock.

## 3. The pictures

The hero draws one card for each wall picture (18), so a hero of eighteen needs eighteen different portraits. The ten of `cards.py` stay. Eight more are official stills of the collection's Game art room (`arts-game.json`, official only), cut to 4:5 around the character from the 2560 wide `f` picture by `scripts/home/media/hero_cards.py` (`CUTS`: the still and where the character is), 640 x 800 WebP, `public/img/home/cards/<slug>-b-45.webp`, data in `public/data/home/hero-cards.json`. `picks.py` merges them into `picks.json` (`hero.portrait` has 18), `picks-data.ts` and `sets.test.ts` hold the same list. They are one each for Fanny, Layla, Ruby, Angela, Lesley, Chang'e, Guinevere and Vexana (cards 10 to 17): a second picture of the same Aspirant, never the same picture.

- Weight: +369 KB (eight new files), the hero cards are 1.82 MB in all, all waited in the hero's list (+8 items). Under the 4 MB aim.
- GPU: a 960x1200 card is about 6 MB with mips, a 640x800 one about 2.7 MB. The field's textures are now about 61 + 22 (portraits) + 67 (the 18 wide crops) = about 150 MB, up from 128. Estimated from sizes, not measured with a GPU tool.
- **The call on "at least 40 pictures".** The brief asked for 40. The ring, the gather and the wall are built for one card per wall picture (the ring's card is half a radius wide: 40 cards on it would pile up four deep, and the owner called the gather, the ring and the wall perfect). So the hero shows 18 cards and no picture twice, not 40. The wall (helper R-A2) is the place of "lots of images". Going to 40 hero cards means scaling the ring card by 18/n and re-tuning `buildStory`: not done.

## 4. The drone's dialogue boxes

Removed: `DroneActor.bubble()` and its state, the bubble mesh and texture (`flat.ts`), `bubble-place.ts` and its test, `bubbleAt`, `BubbleLook`, the icon names and the three icons drawn in code, `PoseLook.cue`, `THANKS_CUE_AT`, the friendly icons and the question mark of `reactions.ts` (`Answer.icon` became `Answer.shock`), `state().bubble`, the loader brain's `bubble` fields, the intro's bubble cues, the sweat, hearts, bang and burst marks. Kept: the faces, the poses (the thanks bow has no bubble now), the tricks, and the shock mark (`shock(seconds)`, used by the intro and for an annoyed drone). The icons file (`marks.webp`, 25 KB) is still loaded for the bang only. `grep -ri bubble apps/web/src/features/home` finds only comments, unrelated words (`bubbles: true` in `kernel/cursor.ts`, "bubble tea" in a picture's alt text) and the doll's swear bubble in `sections/funny` (another actor, not the normal drone).

## 5. Audit of the hero (as an art director)

Found and fixed:

- The drone drew over the logo's letters while it went under it (the old under place had its head in the plate). Now 0.62 of its height under the plate's foot, and it follows the logo's real place.
- The shock mark lasted 1.15 s and followed the drone across the logo. Now 0.55 s. The hop trick of the shock cue is gone (it lifted the drone into the logo).
- The loader's small print (bytes) overlapped the percent line at 390 wide. Margin fixed.
- The plain cover jumped to its old layout for a moment before the screen took over (the home cover was keyed to `data-arrival`, which the flow deletes at start). The "Reload the page" note of the cover now sits at the foot of the screen (`bottom: 2rem`) so it never lands on the slow note. It is keyed to `data-gate-kind="home"`, which lasts until the cover is dropped. Mark and bar measured equal in the cover and the screen at 1440 and 390 (mark top 310.5 and 307, bar top 539.6 at 1440).
- The cards came out of a ring (the old entrance, 1.7 s). Now the heap behind the logo, 0.7 s.
- Eighteen cards with ten pictures (eight repeats). Now eighteen different ones.
- The logo breathed at rest and rippled under the pointer. Now still.
- The old intro: struggle, drop, thanks, hearts, a bow, an 8 s clock. Now 1.85 s.

Found and not fixed:

- During the 1.85 s the pair's hit targets are live: a pointer over them shows the cursor label "SPAR" or "HELLO" (seen once in a frame sheet with the pointer parked at the lower left). The duo actor has no way to switch its hit off.
- The warm draw of the pair (4 frames, while the loading screen waits) leaves a 12 px speck at the lower right corner, seen in one screenshot. The pair is 1 px tall by request but the actor's smallest drawing is bigger. It lasts 67 ms.
- The hero's first frame after the open uploads the cards' textures (a hitch of a few frames on the dev server, 50 to 70 ms; not measured on the production build).
- 40 pictures (section 3).

Stations of the hero play (`sections/hero/index.ts`, unchanged): rest at scroll 0 to 0.3 screens (the dwell), the play fires at 0.3 screens (270 px at 900), 2.8 s forward, back 0.7 of that, backdrop the pastel aurora of `sections/backdrops.ts`. The hero is a pure function of `v` (0 scatter, 1 wall), the aspirants fire their own play at the same scroll.

## 6. UX checked (real Chrome, dev server, 1440x900 and 390x844)

- Real wheel down through the hero: the play fires at scroll 272, the page holds 2.7 s, the lock class clears, the wheel moves the page again. Wheel up: the play runs back, `hero` v 0.00, scroll 0, no lock left.
- Three PageDown presses: the first crosses the thresholds (the page went 0.875 screens), the play locks, the others do nothing, the lock clears. Home returns to 0 with every play at rest. A hard flick of 3000 px: held at 315 after the play.
- Touch (CDP touch events, 390x844): a swipe up fires the hero play at 271 and holds it; after it the lock is gone; a swipe down plays it back.
- The intro cannot be skipped and holds the scroll (the host's job, unchanged). `aspirants:intro` off still skips everything.
- Not looked at: keyboard focus during the intro (the gate button takes the focus at `tap`, unchanged), screen readers on the new layout, the offline and slow notes at the new layout (the host's notes are unchanged in text and place at the foot).

## 7. Numbers to tune

`boot/timeline.ts`: `T` (every beat), `LOADER_DRONE`, `DRONE_LAG`, `underY` factor 0.62, the carry lift 0.3 and tension 0.7, `MAX_CARRY_ROLL` in `runtime.ts`. `home-boot.module.css`: `--boot-drone-half` and the 2rem and 1.6rem gaps (the cover has the same in `styles/base.css`: change both). `sections/hero/scene.ts`: `ENTRANCE_SECONDS`, `ENTRANCE_SPREAD`, `entranceEase`. `formations.ts`: `ORIGIN_SCALE`. `fx/logo/math.ts`: `MORPH_KICK`, `KICK_IN`. `hero_cards.py`: `CUTS`.

## 8. How to look

`D:\ren\aspirant-work\home\R-A1\`: `intro.cjs` (SIZE, T: frozen scene, `__homeBoot.seekIntro(t)`), `cast.cjs` (a CDP screencast from the tap, real time, 60 fps frames with timestamps), `hero.cjs` (rest frame and a real wheel through the play, screencast), `ux.cjs` and `touch.cjs` (scroll checks), `wall.cjs` (click to open in ms), `cover.cjs` and `cover2.cjs` (the cover against the screen), `loader.cjs`. `node scripts/qa/probes/home-boot.cjs <out>` has the new default times.

## 9. Not verified

The production build and a real throttled link; a real phone; Firefox and Safari; the screen reader; the hero's entrance on a weak GPU; the second visit (cached files) intro; the loader on a slow link with the new layout (the host's slow and offline notes were not looked at after the layout change); the gate at 1706x950; `kernel-snap.md` (K6) was still being written, so the hero's `ready()` gate is not implemented (a play does not wait for the hero's actors; the hero is built when the page is primed, before it opens). The wall and rows pictures are R-A2's. `preload-items.test.ts` (waited count under 70) and two other tests failed in the whole run for reasons that are other helpers' (the wall's tiles, the bolt journey, the rows list); this note's own tests pass.
