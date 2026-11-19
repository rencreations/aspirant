# Round seven, SEL-out: the out animation and the white sheet (20 Nov 2026)

Request: `docs/superpowers/specs/2026-11-20-home-feedback-7-request.md` (the last paragraph of the owner's message). Code: `sections/selena/out.ts` (pure beats), `sections/selena/scene.ts` and `runtime.ts` (the wiring), `fx/sheet/` (the white sheet), `actors/selena/pull.ts` (the pulling arm, pure) with two small hooks in `actors/selena/actor.ts`. Work files: `D:\aspirant-work\home\SEL-out\`.

## API (what the other helpers use)

Written first, filled in as the work goes on.

```ts
// The out zone (sections/selena/out.ts). `o` is the progress of the scroll zone, 0 to 1, both ways.
outAt(o: number, out?: OutBeats): OutBeats   // clip time, zoom, hand target, grip, sheet, the pair's exit, the whites

// The sheet (fx/sheet): an actor "sheet" in the cast pass, so it shares the depth buffer with her.
const sheet = await ensureSheet(ctx);
sheet.drive({ sl, camera, hang, grip, fold, phase });  // every frame the out zone shows it; `sheet.visible = true`

// Selena (actors/selena/actor.ts), two additions:
sl.pin(bone: string, along?: number): Object3D   // a socket on any bone of hers, kept on it every frame (her own space)
sl.pull(p: PullInput | null)                      // the arm pulls: a hand target in view space, the fingers close. null = off
pair.layer("front" | "back")                      // one frame: draw the drone and the doll in front of the cast (the room's sky)
```

- The out clip is scrubbed by the zone (`sl.clip("city_intercation02", t)`), so the state machine of SEL-anim is `free` while the zone runs; `sl.drive(1)` takes her back at the top of the zone (going up).
- The pair (drone and doll) stay docked at the bottom right through the room (the section calls `pair.mode("dock")` every frame) and fly off as the sheet starts to cover. The old J8 handover (the doll hanging from the top edge) is gone from `list/pair.ts` and from the room.
- The old film (`city_intercation03`: the doll falls, Silverbolt eats her, the dragon passes the lens) is gone from the Selena section.

## How the out zone works

The out zone is the last scroll zone of the section (`stations.ts`: 2.4 screens, `u` from `REST_U` to `STORY`). `beatsAt` hands `o`, its progress from 0 to 1, to `outAt` (`out.ts`), a pure function: the clip, the pull, the sheet, the pair and the whites are all functions of `o`, so the wheel plays them both ways and a seek into the zone gives the picture a slow scroll gives. The kernel's idle snap finishes the zone to its nearer end. Nothing here runs on a clock.

| `o`          | what happens                                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0 to 0.07    | The drawer and its words leave. The out clip blends in from the idle that was showing (`OUT_BLEND`, 0.04), so the first notch never pops her pose.                                                           |
| 0 to 0.05    | The pair (drone and doll) fly off to the lower right with a cheer, before the camera leaves the pixel view (the doll is in the cast pass, a baked camera would misplace her).                                |
| 0.05 to 0.15 | The camera swings from the pixel view of the room to the game's out camera (`camera-blend.ts`).                                                                                                              |
| 0 to 0.52    | The clip `city_intercation02` is scrubbed: she turns round and her right hand comes out (`CLIP_KEYS`, `T_EXT` 4.42 s).                                                                                       |
| 0.54 to 0.66 | The reach: the picture closes in on her (`ZOOM` 4.4 and on a phone `ZOOM_PORTRAIT` 2.1, about the wrist, which lands left of centre so her face stays in the picture). The hand rises to the top edge.       |
| 0.62 to 0.72 | The grip: the fingers close, the sheet's edge comes to them.                                                                                                                                                 |
| 0.70 to 0.97 | The pull: the hand takes the sheet down and out of the bottom of the picture, and the picture itself is drawn down with it (`PAN_TO`), so the hand leaves by the foot. The sheet covers her face on the way. |
| 0.94 to 1.0  | The sheet is the whole screen. The white layer (`data-selena-white`, then `front`) takes it, the actors are hidden, the voices come in under the same white.                                                 |

The head and eye interaction is off for all of it: `sl.clip` and `sl.blend` make the state machine "free" and the free weights of the cursor are zero.

## The pull (`actors/selena/pull.ts`, `pull-arm.ts`)

`solveArm` is a two bone solve (shoulder, elbow, wrist) with the elbow kept on the side the clip had it. The actor measures the clip's wrist (`measure`), and while the section calls `sl.pull(...)` it turns the upper arm and forearm so that the wrist reaches a point of the picture (normalised device coordinates of the camera, plus a distance share). The fingers curl by `fingerClose` (the little finger first, the thumb last, so the hand closes in a wave) and `gripAngle`. The target path is `outAt`'s `handX`, `handY`, `depth`. `pull.test.ts` holds the properties of the solve and the grip (bone lengths kept, the target reached or the nearest point, continuous).

## The white sheet (`fx/sheet/`)

An actor "sheet" of the cast pass, so it shares Selena's depth buffer. `cloth.ts` (pure, tested) writes a grid of 41 by 17 vertices in the picture's units from the grip, the tilt of the hand, a trailing lag and creases (`fold`, `phase`), so it is deterministic by `o`. `actor.ts` pins five sockets on the fingertips (`sl.pin`), reads their depth through the camera the cast is drawn with, and puts the plane at the middle of the depth between the thumb and the mean of the other four fingers. Because it is one plane through the hand, the thumb and the nails that curl over the edge are in front of it and the finger bodies above the edge line are behind it: the depth test sorts it, nothing is masked by hand. The paper is the daybreak ground itself (colour and the same 28 px dot grid in screen pixels), a soft lavender band on the creases and a thin ink along the edge, so a screen full of it is exactly the next section's ground. `ensureSheet` warms its program (`warmCast`), so the first frame of the pull does not stall.

## Changed in the resume of this round

- Zoom. At first the picture closed in 3.6 times on the baked out camera, which was a close up of an arm and hair with her face out and the sheet only a line. I made it 2.1 and moved the anchors (`WRIST_AT` (-0.28, -0.2), `REACH_TO` (-0.06, 0.52), `PULL_TO` (-0.14, -0.78)). Then SEL-camera-sky made the out camera the fitted one (`sl.cameraFor`, she is much smaller in its frame), so the zoom is now `ZOOM` 4.4, and `ZOOM_PORTRAIT` 2.1 on a phone, whose fitted camera is already close. With these she stays in the picture, the hand rises beside her face and the sheet comes down over her.
- The first notch blends from what she was showing (SEL-anim wrote `fromClip` and `fromT` in `scene.ts`; `OUT_BLEND` is 0.04 of the zone).
- The sheet's program is warmed in `ensureSheet`.
- The pair is drawn in front of the cast in the room: the sky of the room is drawn in the cast and covered the drone (which draws behind the cast). `BuddyPair.layer("front")` is a new one frame request (`actors/buddies/pair.ts`, three small edits next to the feedback eight work on that file); `scene.ts` asks for it every frame it shows the pair.

## Looked at, and how

Real Chrome (channel chrome, headless) on the dev server, `window.__home.seek` into the zone and the real wheel. Scripts and every frame are in `D:\aspirant-work\home\SEL-out\` (`shots.cjs`, `joint.cjs`, `wheel.cjs`, `stitch.py`, sheets `sheet1.png` to `sheet9.png`, `hand1.png`).

- The zone at 17 points (0 to 1) at 1440 by 900 and at 10 points at 390 by 844 (`sheet1`, `sheet2`, `sheet3`, `sheet4`, `sheet7`): the pair dock and exit, the camera swing, she turns round and her hand comes out, the reach, the grip, the pull, the sheet over her face, the white.
- The depth of the sheet against the fingers (`hand1.png`, crops at 0.70, 0.74, 0.77, 0.80, 0.83): the lavender nails and the thumb show over the sheet, the black finger bodies above the edge line are hidden by it, the glove below the line shows.
- The pair (`sheet5`): docked at 0, the cheer and the flight to the lower right by 0.03, none left at 0.04.
- The joint (`sheet6`): the screens 3.8, 3.95, 4.05, 4.2 are the same white, the voices' title and chooser come in at 4.4 on that ground, with no pair of the Selena section left.
- The real wheel (`wheel.cjs`, `wheel2.cjs`): 40 notches of 60 px down through the zone to the white, an idle of 2.6 s (the snap carried it to 4.118 screens, past the end), 40 notches back up to the rest (1.45 to 1.61 screens), no page error. Frame times of the second pass on the dev server with the other helpers working: median 16.7 ms, p95 33 ms (the first pass had one program compile of 0.5 s, which `warmCast` of the sheet takes now).

## Not done or not verified

- The sheet was looked at with the sky on, at 1440 by 900 (`sheet11`, `sheet12`, `hand2`) and at 390 by 844 (`sheet14`): white over the sky it reads as a canvas, the edge line and the creases carry it.
- The comparison with the game's out clip is the clip itself (the baked camera `cameras-out.json`); there is no recording of the game for this clip, so the frames were not put beside a reference.
- Phone: the zone was looked at with seeks, and a touch drag was not tried.
- The first notch blend is SEL-anim's `fromClip` version now (frames `sheet9` and `sheet10`, o 0 to 0.07, show no pop by eye; not measured).
- `tsc` of the whole app is clean at the end of this step.
- On a phone the swing from the room to the out camera (o 0.05 to 0.15) is SEL-camera-sky's picture: at o 0.1 it shows her legs large and cut (`sheet13`, `m-0100.png`). It is theirs to tune, the zone after 0.5 is fine.
- A probe must wait for the sheet to register (`waitActors` in `lib.cjs`): on the dev server her build takes about 15 s and the first frames after a seek are blank until then.
- The owner's feedback-eight (the descent's doll and drone, and the other pages) is not part of this step.
