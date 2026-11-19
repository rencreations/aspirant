# Home round two: R-F (selena, voices, music, funny, chase, bend, archive, footer)

Brief: `docs/superpowers/specs/2026-11-19-home-feedback-request.md` and `-2-request.md`. This note adds to `round2-R-C.md` and `round2-R-D.md` (their stations and durations stand unless a row below says otherwise). Plays: `kernel-plays.md`. Gate: `kernel-snap.md`. Backdrops: `fx-backdrop.md`.

## 1. What changed

| area             | change                                                                                                                                                                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ready gate       | `ready()` on the runtimes of selena, voices, music, funny, chase, bend and archive. A forward play waits (and holds nothing) until the section's scene is built. Seen on a fresh load: Selena's film waited 9 s on the dev server with `waiting: true`, then fired when Selena arrived. |
| Selena room      | Composed: Selena smaller (`FILL_IDLE` 0.82), the dragon moved out of her pose to the foot of the frame (`sections/selena/room.ts`), the doll hangs at the top left. They read apart at 1440x900, 1706x950 and 390x844.                                                                  |
| Selena swing     | The camera holds back, then punches in (`travelOf`, `pullOf`, `SWING_POW` 1.8, `SWING_PULL` 0.8 in `scene.ts`). Selena rises to the clip's first pose before the lens lands (pose 1.0 to 1.35 s, camera 1.1 to 1.5 s).                                                                  |
| Selena film      | Story 4.2 to 3.95 s, film play 3.2 to 2.95 s. Clip keys re-timed (hover 2.5x, eat 1.4x, the pass 0.82x), the empty white at the end cut.                                                                                                                                                |
| hand-over        | Selena's white layer leaves by the clock (0.7 s) as soon as the page is 0.04 screen into the tail, so the voices' waves come up behind its title while it enters. The scroll fade stays as the fallback (`stepWhite` in `timeline.ts`).                                                 |
| jump past        | `kernel/run.ts`: a section passed by a jump is replayed at `end + tail / screens`. The list's dusk sky was stuck over the voices after any jump past Selena (seen: the voices page dark navy after a seek, light after a scroll).                                                       |
| funny first rest | Tetra 0.34 to 0.42 of the screen height, at 0.2 of the width, the kite larger and nearer the middle (`geometry()`, wide screens only; `watch` and `centre` are untouched, music depends on them).                                                                                       |
| bend             | The credit plates are one tab stop (roving tabindex, arrows, Home, End: `bend/roving.ts`). The four element backdrops cross in 0.2 s (`ELEMENT_FADE`) so each forms inside its 0.45 s stance.                                                                                           |
| backdrop         | `BackdropOptions.fade` (seconds, default 0.5, least 0.1), `FadeMix.step(dt, want, snap, fadeS)`.                                                                                                                                                                                        |
| cue              | `cue.tsx`, `rest-cue.ts`, `rest-cue.module.css`: a hairline in the lower right corner after 1.8 s of stillness (not at the top, not within 1.2 screens of the foot, not while any hold is on). Rendered by `HomeStage`.                                                                 |
| resize           | `kernel/engine.ts` `onResize` keeps the place in screens when the screen changes size (S 17.4 stayed 17.4 across 900 to 700 and back; before it went to 22.4).                                                                                                                          |
| backdrop on sky  | Selena fades the list's dusk sky only while the backdrop really draws (`backdropOn`), so a missing second canvas never leaves a black void.                                                                                                                                             |

## 2. The API

```ts
// SectionRuntime (kernel/types.ts, K6): a forward play does not fire until it says true.
ready?(): boolean;

// What each runtime waits for:
// selena   actors (Selena, dragon, doll, marks, carry) arrived or failed, and the aurora shader is warm
// music    the gramophone and the crate made (or failed), and the stage's shader is warm
// funny    Tetra, dragon, doll, duo, marks, backdrop all settled, shaders warm
// chase    marks, Tetra, dragon, doll, backdrop settled, shaders warm
// bend, archive, voices: the actors are built before the runtime exists; the gate waits for the shaders

// Backdrop: a quicker cross for a scene that changes the kind every half second.
backdrop.set("earth", { amount: 0.85, fade: 0.2 });

// Selena's swing, pure (selena/camera-blend.ts):
travelOf(k, power); // 0..1, how far along the camera is
pullOf(k, amount);  // 0 at both ends, amount at the middle, share of the camera's distance
```

## 3. Stations and thresholds (what moved since R-C and R-D)

| section | thresholds (screens from start) | plays (seconds)                          | notes                                                                                                            |
| ------- | ------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| selena  | enter 0.18, film 0.99           | enter 1.0, film 2.95 (was 3.2), back 0.6 | story 3.95 s. Beats in `timeline.ts` (`AT`, `FILM_KEYS`). Measured with a real wheel: 1.05 s and 2.93 s of hold. |
| voices  | enter 0.06, leave 1.17          | 0.9, 0.8                                 | measured 0.87 s and 0.73 s. The entrance now has the waves behind it (white leaves by the clock).                |
| music   | arrive 0.12, exit 1.29          | 3.2, 1.5                                 | measured 3.25 s and 1.6 s, the page held (S fixed), free between.                                                |
| funny   | 0.1, 0.64, 1.28                 | 0.6, 2.6, 1.6                            | measured 2.57 s and 1.67 s for the last two.                                                                     |
| chase   | 0.9, 1.6                        | 2.4, 2.0                                 | measured 2.39 s and 1.95 s.                                                                                      |
| bend    | 0.40, 0.95, 1.50                | 2.7, 2.6, 2.3                            | measured 2.71, 2.68, 2.36 s.                                                                                     |
| archive | 0.4                             | 1.8                                      | measured 1.81 s.                                                                                                 |

A full real-wheel walk down from the list to the archive (1440x900, 1800 px a second): 15 plays, each held the page (0.000 screens moved), the longest hold 3.25 s (music's arrival), no stall without a play. Back up: 16 backward runs of 0.4 to 2.0 s, all held, all free after.

## 4. Audit

**Found and fixed**

1. A play fired before its actors were built (Selena's film on an empty aurora): the ready gate, seen working on a fresh load for selena and the bend.
2. The Selena room was cluttered (the dragon lies across her chest in the clip's own space): composed, see section 1.
3. The camera swing passed through Selena's chest and hair: it now holds back and punches in, and she is up before the lens lands. Frame sheets of the swing at 60 fps: wide room, a 0.15 s snap zoom onto her face, then the clip.
4. The film was 3.2 s and ended on 0.4 s of empty white: 2.95 s.
5. The white layer covered the voices' waves until the scroll cleared it: now by the clock, during the entrance.
6. After a jump past Selena the list's dusk sky stayed over every later section (the voices page was dark navy, its text half unreadable): kernel replay with the tail ridden out.
7. Funny's first rest was sparse: composed bigger and nearer the middle.
8. "What's going on?" after a seek to the chase: already fixed by R-D (`frame.S`); verified at 390x844: opacity 0, risen, at the chase's first rest (S 24.8).
9. The bend had 32 tab stops: two (plate links of the plate last used) plus the arrows. All credits and takedown links stay in the page.
10. The element backdrops never formed: 0.2 s cross.
11. No cue at a rest: the hairline.
12. A window resize moved the visitor by screens: fixed in the engine.
13. Music: verified end to end with a real press, sound unlocked in headless Chrome: pick, `fetch` 2 s, `carry`, `place`, `needle`, `back`, `playing`; `beat` reads 0.86 to 0.99 from the analyser; "Another record" returns the disc. Press to song 4.5 s on the dev server.
14. Focus from the top into Selena's link, the voices' chooser, funny's link, the chase's link and the archive's first cover: the page moves to the control's place, no play fires on the way, no lock left on.
15. Touch (CDP touch events at 390x844): a swipe gesture through the Selena film threshold: the page held at 17.910 for the whole 2.9 s play, free after; the voices' play held the same way.

**Found and not fixed**

1. Selena's flip (the clip's 4 to 5 s) is not shown: it would add a second to a scene the owner called too long.
2. The dead scroll between the film's rest and the voices is 0.56 screen of empty white. The bar's early ink (voices `nav.early` 0.45) forbids firing the film later. It is the dwell of an animated section, short by the owner's rule, but empty.
3. The voices' pair sits over the lower part of the art (accepted: faces and the weapon read).
4. The film's first second of the clip is played at 3.4x (the stand-up). It is fast. A longer one costs time.
5. `MUSIC_UI.keep` in `content.ts` is unused data (an object key: knip does not list it).
6. `rows/preload.test.ts` fails (another helper's range, in progress).
7. Fan pictures of the bend are not part of its gate (the colour-first cards cover a late picture). A very slow connection fires the wall's throw with boxes that fill in.

## 5. Backdrops

Unchanged from R-C and R-D except: the bend's four elements ask `fade: 0.2`. Notes on kinds in `fx-backdrop.md` section 8.

## 6. How to look

`D:\ren\aspirant-work\home\R-F\`: `sess.cjs <WxH>` keeps a Chrome session open and runs every new `cmd.js` (`P=ph_` for a second session by prefix), with `cast({ prefix, wheelDy, steps, seconds })` (a CDP screencast of a real wheel run), `shot`, `H.seek/start/actors/state`, `ensure()` (waits out a dev-server reload); `run.sh <file.js>` sends a command and prints the result; `castsheet.py <dir> <out> <cols> <scale> <n> <t0> <t1>` makes the timed sheet; `walk.js` (templated by `sed`) walks a real wheel through a range and logs every play; `gate.cjs <section> <offset>` is the fresh load gate test; `shotrest.sh <section> <offset> <name> [actors]`. The dev server reloaded the page under a probe all day (other helpers saving): `ensure()` and the retry in `sess.cjs` handle it, and some recordings showed no aurora (see `fx-backdrop.md` section 8).

## 7. Not verified

- The production build, `scripts/perf/weak.mjs`, Firefox, Safari, a real phone (the 390x844 runs are desktop Chrome with touch events).
- Back from `/about` and a reload mid page (K5 proved the reload for the plays; not repeated).
- The Selena room and film at 1706x950 and 390x844 as played: the rest frames were looked at there, the film (the swing, the white) only at 1440x900.
- The bend's and the funny's plays at 1706x950; the funny's new first rest on the phone was looked at, the plays after the geometry change were not re-recorded.
- The rest cue on a dark ground (it is a mid grey; seen only on daybreak) and on a phone as a moving line.
- A hidden tab part way through a play; a throttled network for the actors (the gate was seen only on the dev server's own slowness).
- The kernel replay change on every section: the kernel tests, the home tests (2312 of 2313, the one failure is rows) and the voices frame after a jump were checked; a jump past each other section was not looked at one by one.
- The resize fix in a real mobile browser (an address bar that shrinks the page does not change `100lvh`, so it should do nothing there).
