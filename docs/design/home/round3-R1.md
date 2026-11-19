# Home round three, R1: bolt, fall, hand, list as scroll zones

The owner's third message (`docs/superpowers/specs/2026-11-20-home-feedback-3-request.md`): scenes are scroll based again, with a snap when the visitor stops in the middle of one. This note covers `bolt`, `fall`, `hand` and `list`. It replaces the stations and thresholds of `round2-R-B.md` section 2; the beats, the composition, the backdrops and the actors' looks are unchanged. The kernel side is `kernel-scrub.md` (zones, the idle snap).

## 1. What changed

Every clock play of the four sections is a ZONE: `v` follows the scroll through the zone (up and down, the same both ways), the page is never held, and a visitor who stops inside a zone is carried to its nearer end by the idle snap. No clock play remains in this range. The stations files (`bolt/stations.ts`, `hand/stations.ts`) now write `{ atScreens, spanScreens, to, seconds, ease }` and the sections' `screens` come from `zoneLength(steps, dwell)`, so a number is changed in one place.

Other edits:

- `ready()` and its flags are gone from the four runtimes (the ready gate only ever held clock plays; a zone is a pure function of the scroll, so a scene that is not built yet just shows its text and the models appear when they are built).
- `bolt/scene.ts` and `hand/carry.ts` judge a jump from the scroll (`|S - lastS| > 1.2` screens), not from the beat. Before, a step of 0.3 or 0.5 beats was a jump; with zones one frame of a normal wheel can be that. The throw (the sneeze) and the one shots (poof on the palm, knock on the frame) now fire on a quick scroll and are skipped only on a seek or a drag of the bar.
- `fall` is `restOutside` (its lead is the bolt's last rest drawn again), so there is no joint snap in the bolt's last half screen.
- `list` has `focus` at the first frame's rest, and `frameRestScreens(i)` is the middle of the rest after the zone that brought frame `i` (a keyboard focus lands in a rest, never inside a zone).
- Tests: `bolt/stations.test.ts` and `hand/stations.test.ts` were rewritten for zones (passing, 15 tests). Nothing else was run.

## 2. The tables (screens after the section's start)

| section | zone                                       | at (to end)                       | beats (from to)    | snap seconds | ease      | rest after it                                        |
| ------- | ------------------------------------------ | --------------------------------- | ------------------ | ------------ | --------- | ---------------------------------------------------- |
| bolt    | arrival (dragon, roll, brakes, pair 1)     | 0.15 to 1.15 (1.0)                | 0 to 1.3           | 1.0          | linear    | 0.4                                                  |
|         | wheel turn 1 to 4                          | 1.55, 2.35, 3.15, 3.95 (0.4 each) | 1.3 to 3.3         | 0.5          | inOutSoft | 0.4 between, 0.6 after the last (the fall's lead)    |
| fall    | rear, sneeze, throw, fall to "5 Phases"    | 0.1 to 1.0 (0.9)                  | 3.3 to 4.85        | 0.9          | inOutSoft | 0.45 on "5 Phases"                                   |
|         | "5 Phases" leaves, "10 Characters" arrives | 1.45 to 2.35 (0.9)                | 4.85 to 6.6        | 0.9          | inOutSoft | 0.3, then the hand's lead (0.5, scroll linked)       |
| hand    | rise, landing, sitting, the words          | 0.1 to 1.3 (1.2)                  | 0 to 2.1           | 1.0          | linear    | 0.9 on the words, then the join (0.4, scroll linked) |
| list    | toss, the hand sinks, first name           | 0.4 to 1.2 (0.8)                  | 0 to 1             | 0.8          | linear    | 0.55                                                 |
|         | strip turn 1 to 9 (one per frame)          | 1.75 + 0.9 k (0.35 each)          | 1 to 2 ... 9 to 10 | 0.5          | inOutSoft | 0.55 on every frame                                  |
|         | Selena's frame grows into the screen       | 9.85 to 10.85 (1.0)               | 10 to 11           | 0.9          | linear    | 0.5 (the next section's lead is on it)               |

Lengths: bolt 4.95, fall 3.15, hand 2.6, list 11.35: 22.05 screens in all (round two had 12.1, the clock version before it 18.6). The longer page is the price of a scroll driven scene: a pair now needs 0.8 screens (it was 0.55 screens plus 0.6 s of clock), a frame 0.9 (was 0.55 plus 0.7 s). The owner's "short" is kept in the zones (0.35 to 1.2 screens); the rests are the knob, and the list's frames and the hand's words have the long ones the brief asks for (0.55 and 0.9; round two had 0.55 between frame triggers, so a frame is never asked for less scroll than before): `TURN_REST`, `BOLT_DWELL`, `FALL_REST`, `FALL_DWELL`, `HAND_REST`, `FRAME_REST`, `LIST_DWELL` in the two stations files.

Rules the tables obey (the tests hold them): the last bolt zone ends 0.6 before the section's end (the fall's lead, half a screen, is a rest); the fall's last zone ends 0.8 before its end (0.3 of rest, then the hand's lead); the hand's zone ends 1.3 before its end (the join and the list's lead are 0.4); the toss starts 0.4 into the list (the hand's tail is over); the last list zone ends 0.5 before the list's end (Selena's lead). No zone is inside a lead or a tail.

## 3. Choices made without the owner

- The fall is two zones with a rest on "5 Phases" (the owner's "one or two"): the number is information, so it stands, and the doll hangs in mid fall with the speed lines. The rest is at beat 4.85 (`BEAT.phases`).
- The join between the fall and the hand, and between the hand and the list, stay scroll linked (the hand's fingertips and "10 Characters" leaving; the hand coming down, the words leaving and the first frame arriving). They are the kernel's joints and the joint snap carries a visitor who stops in one to the nearer rest. They were not turned into zones.
- Pairs and frames are one zone each, not a continuous mapping: Selena's priming, the open buttons and the doll's seat on the frame all need a rest where the strip's index is exactly an integer.
- Rests: 0.4 on the bolt's pairs and 0.45 on the fall's "5 Phases" (short, animated scenes), 0.9 on the hand's words (the brief's "about 1"), 0.55 on every frame of the list (text that links). A full screen for each of ten frames would make the list 14 screens. The bolt's pair rest (0.4) is a choice: the brief names the hand's words and the list as the long ones.
- Selena's growth is a zone the visitor can take back, so her clips are not a pure function of the scroll: scrolling back, once the frame has shrunk below half of the way and she is in the idle, she goes back to the hands at the mouth (`BACK_TO_LOOP` in `list/runtime.ts`; only while the scroll moves back, so a slow scroll forward never flips her). Looked at with a screencast going up: the reclined pose turns to the standing loop at about 70 percent of the growth.
- The speed lines kind still boosts its speed and length with the scroll's velocity (`uVel` in `glsl-lines.ts`) on top of the beat term of `planBackdrop`. In the fall the lines now run faster the faster the visitor scrolls. Left on purpose (it reads as the fall answering the scroll); not looked at frame by frame.

## 4. Looked at (real Chrome, dev server, 1440x900)

- Seek frame sheets of every zone end and middle: bolt (arrival, first rest, turn 1), fall (both zones and both rests), hand (rise, rest, join), list (toss, frames 0, 1, 8, 9, growth). Same pictures as round two at the rests.
- Real wheel with a screencast, 20 to 25 px every 30 ms: the fall going down (the throw, the fall, "5 Phases"), Selena's growth going back, and the fall going UP (the doll goes back to the dragon's head: no pop seen in a screencast of frames about 100 ms apart, then the lightning and the aurora), the list going up (strip turns back, the hand and the doll return to the palm).
- The idle snap with a real wheel (`snap().scrub`): forward from a quarter of a zone, back below it, up from the far end goes back, in the bolt arrival, the fall, the hand and the list (one case each at least). Landing exactly on the zone's end; no second move.
- A hard flick (9000 px down from the bolt, 9000 px up, 6000 px in the fall, 12000 px in the list): no console error, the page settled in a rest or a joint, nothing held.
- Joints: seek sheet across the fall to hand join (the characters leave, the fingertips come up, the doll stays), and the hand to list join (earlier sheet).

## 5. Not verified

- Phone (390x844) and touch fling for this range (the layouts and beats are unchanged; K7 proved the touch snap on a scratch zone).
- Production build and weak machine frame times. A scroll driven scene draws the dragon, the doll, the marks and the trails at the scroll's pace, with no hold in which to hide a hitch: the first draws of the dragon and of Selena (one long frame each on the dev server) now land inside a scroll.
- A very fast scrub across the throw skips its sneeze when one frame moves the scroll by more than 1.2 screens (the flick limiter hands the scene one screen a frame, so a hard flick still plays it).
- The strip's button ("See collections") is still on screen over the first 0.5 screen of the bolt (the strip's tail, helper H3's), and the dragon's arrival zone starts at 0.15: the dragon enters while the button is still there.
- The idle snap's rule "up from p above a quarter of the zone's far end goes all the way back" (kernel, `ZONE_BACK_UP` 0.75): a nudge of 0.1 screens up from the end of the arrival sends the page back to its start. A kernel number, not changed here.
- Unit tests of the other files of these folders were not run (`journey.test.ts`, `timeline.test.ts`, `list/*.test.ts`, `kernel/layout.test.ts` and `snap-registry.test.ts` read the registry): the cleanup pass.

## 6. Looking at it

Scripts, outside the repo, in `D:\ren\aspirant-work\home\R1\`: `seekshots.cjs` (seek to offsets after a section's start and shoot: `SEC=fall OFFS="0.05,1.0" TAG=f OUT=...`), `cast.cjs` (a real wheel scroll with a screencast: `SEC=fall FROM=1.2 TO=0.05 DELTA=-25`), `snap.cjs` (`JOBS="bolt:0.1:300"`: section, start offset, px to wheel, then the page's positions every 0.3 s with `*` while the snap moves), `flick.cjs`, `joints.cjs` (the sections' starts and the joints). The dev server reloads the page whenever another file is saved, so every script retries.
