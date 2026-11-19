# Round seven, SEL-anim: Selena's state machine and her interaction (20 Nov 2026)

Request: `docs/superpowers/specs/2026-11-20-home-feedback-7-request.md`. Code: `actors/selena/states.ts` (pure, tested), `actors/selena/actor.ts` (the machine runs inside `update`), `actors/selena/look.ts` (the gentle gaze), `sections/list/runtime.ts` (`selenaStates`) and `sections/selena/scene.ts` (the room). Work files and probes: `D:\ren\aspirant-work\home\SEL-anim\` (`lib.cjs`, `timed.cjs`, `mid.cjs`, `snapq.cjs`, `seam.cjs`, `trace.cjs`, `gaze2.cjs`, `phone.cjs`; shots in `shots\` and `shots2\`).

## API (what the other helpers use)

```ts
sl.drive(expand: number)   // every frame she is shown in the frame or the room. The machine takes (back) the control.
sl.jump(expand: number)    // a seek, a reload, a draw after she was hidden: the matching loop, cross fade 0.2 s, no transition.
sl.state(): "pose" | "toIdle" | "idle" | "toPose" | "free"
sl.handOver()              // the machine lets go ("free"). She keeps playing what she plays.
```

- `expand` is the list's `b.expand` (eased 0 to 1). The target becomes idle past 0.12 going up and pose below 0.04 going down (`TO_IDLE_AT`, `TO_POSE_AT`).
- Any direct `sl.clip`, `sl.blend` or `sl.play` makes the machine "free" (SEL-out scrubs the out clip with `sl.clip("city_intercation02", t)`). `sl.drive` takes the control back with a 0.2 s cross fade to the loop that matches. In the room the scene calls `sl.drive(1)`.
- `playRelease`, `interactive`, the `"rightHover"` socket (and the doll offset it computed) and every hit target are gone. `sl.debug()` returns `{ state, look, view }` (the weights of the cursor) for the probes.
- The cursor view turn: the actor computes the cursor as a share of the screen from its middle (eased) and the weight (1 in idle, 0 in pose and in the transitions, eased 5 per second) and calls `setView(nx, ny, weight)` of SEL-camera-sky every frame in `update` (`pushView`, a plain call now that the method is in the class). SEL-camera-sky springs the same three numbers again, so the turn has two light layers of smoothing. Seen live: the idle view weight reaches 1 about one second after the idle starts and is 0 through both transitions.

### The handover to the out clip (SEL-out)

The out zone takes the clip with `sl.blend(...)` and `sl.clip(...)`, which make the machine `free`. Two things keep the join smooth, both new in this pass:

1. The scene (`sections/selena/scene.ts`, `fromClip` and `fromT`) takes the clip she shows, whatever it is (the idle loop, or `toIdle` when the visitor ran on while the way out of the pose still played), on the first frame of the zone, while `sl.state()` is not `free`, and blends the out clip from it. It used to blend from the idle at its last known time. That popped about a metre of pose (head and hands against the pelvis, measured with `trace.cjs`) when the zone began while `toIdle` played, and when a seek skipped the room (the idle time was never set).
2. The actor keeps a short handover fade (`carryClip`, `carryT`, `carryW` in `actor.ts`): the first `clip` or `blend` while the machine had her remembers the clip and time she showed, and that clip keeps running under the new pose for `JUMP_FADE` (0.2 s) and fades out. A flick that skips the scene's own first blend (the zone's progress goes past `OUT_BLEND` in one frame) therefore never pops. No allocation, one extra clip sample for 0.2 s.

A probe note: in a scrubbed (`free`) state `sl.clipState()` is stale (the player keeps the last clip it played itself), so read the pose, not `clipState`, to see what is shown.

## The four states

| state  | clip                               | plays            | cursor                           |
| ------ | ---------------------------------- | ---------------- | -------------------------------- |
| pose   | `city_interaction_R_loop`          | loops            | head and eyes                    |
| toIdle | `city_interaction_back_R` (3.21 s) | once, to its end | nothing                          |
| idle   | `city_idle`                        | loops            | head and eyes, and the view turn |
| toPose | `city_interaction_R` (3.29 s)      | once, to its end | nothing                          |

- A transition clip runs on her own clock at speed 1, never scrubbed or cut by the scroll. At its end the machine looks at the target again: if the visitor reversed meanwhile, the opposite transition starts at once (`toIdle` then `toPose`, as the probe `timed.cjs` D shows).
- **The visitor stops half way.** The growth is a scroll zone (`kernel/scrub.ts`) with an idle snap, and the rule is not "half". Going down, a stop from 25 percent of the zone on goes on to the end (`ZONE_FORWARD_DOWN`) and a stop below 25 percent goes back. Going up, a stop at 75 percent or less goes back to the start (`ZONE_BACK_UP`) and a stop above 75 percent goes on to the full frame. The machine's thresholds sit on those: the eased growth is 0.0625 at 25 percent of the zone and 0.12 at 31 percent, so a stop below 25 percent never reaches `TO_IDLE_AT` and she never leaves the pose, while a stop from 25 percent on is carried past 0.12 by the snap and `toIdle` starts. Going up, 0.04 is at 21.5 percent and 0.9375 at 75 percent, so a stop above 75 percent keeps the idle and a stop at 75 percent or less is carried below 0.04 and `toPose` starts. The clip that began always finishes by itself, whichever way the snap goes, then the loop that matches where the frame rested. If the visitor reverses during `toIdle`, the frame shrinks while she finishes lying down, then `toPose` plays (up to about 6.5 s of transitions in the small frame: the rule is that a clip is never cut). Seen in real Chrome (`snapq.cjs`, `seam.cjs`, `timed.cjs` D): a stop at 17 percent snapped back to the start with the pose loop never interrupted; a stop at 28 to 35 percent was carried to full, `toIdle` played its 3.2 s and the idle looped; a flick down then up played `toIdle` to its end, then `toPose`, then the pose loop.
- A jump (a seek, a reload, the list drawing her again after she was off screen) uses `jump`: the matching loop, no transition. The list calls `jump` when the growth moves by more than 0.3 in one frame or when she was not drawn the frame before (`JUMP_STEP`).
- Joins are cross fades (`STATE_FADE`: 0.12 into a transition, 0.15 into a loop). Measured again on this build with `trace.cjs` (head, both hands and both feet against the pelvis, per frame, in centimetres): at every join (`pose` to `toIdle`, `toIdle` to `idle`, `idle` to `toPose`, `toPose` to `pose`, and `toIdle` to `toPose` after a reversal) the step across the join is the size of the steps on either side (0.1 to 8 cm), with no spike. `toPose` to `pose` and `toIdle` to `idle` are 0.1 to 0.7 cm.

## The interaction (round seven)

Removed: every hit target and cursor label, finger curls (`fingers.ts`), the reactions to hover and press (`reactions.ts`), `hit.ts`, the hair poke, the claw spins, the pat, the hip and the body lean with the gaze. Kept: the hair and skirt springs, the blinks and the face (not interaction). Silverbolt in the room: `interactive(false)` and `follow(0)`, so it only plays its clip and its head stays still.

Added: in pose and in idle her head and eyes follow the cursor, only a little (`look.ts`, `GENTLE`): the head up to 8 degrees sideways and 5 up or down (the neck takes 30 percent of it), the eyes lead it (11.5 and 7.5 degrees), each on a slow spring (head 5 rad/s, eyes 9). The cursor is a share of the screen from her eyes (-1 to 1, clamped). With the cursor outside the window (or a finger up on touch) the target is zero, so she relaxes to the clip's own look. The weights fade with the state (5 per second) and are zero during the two transitions. The look was seen in `gaze.cjs` (cursor centre, left, right, up, down): the turn is small and visible, as asked, not measured in degrees on the screen.

## The model file

`scripts/home/models/blender/selena.py` now bakes six clips: `interaction_R` (80 frames, 3.29 s, idle to pose) and `intercation02` (144 frames, 5.96 s, the out clip) are new. The build ran to a trial folder (`--out D:\ren\aspirant-work\home\SEL-anim\out`), passed its own checks (bone heads against Blender worst 0.84 mm, against the owner's `entrance.glb` worst 0.8 mm) and the two files were copied as `apps/web/public/models/home/selena-r7.glb` (1,984,760 bytes, under the 2.4 MB budget) and `selena-r7.facts.json`. `SELENA_MODEL` points to the new file, so no cache name needed a bump. The old `selena.glb` is no longer loaded by anything: delete it in the cleanup pass. The rig reads `ClipName` entries `city_interaction_R` and `city_intercation02`.

## Looked at, and how

Real Chrome on the dev server, 1440 by 900 with the real wheel, a screenshot every 0.25 s (`D:\ren\aspirant-work\home\SEL-anim\shots\A.png`, `B.png`, `gz.png`, `ph.png`):

- Pose loop in the 4:5 frame at rest: the hands at the mouth loop (`p1.png`).
- The growth with `toIdle` playing, then the idle loop (`A.png`, 21 frames): the standing pose turns and lies down while the frame grows, no pop at either join.
- Back up with `toPose`, then the pose loop (`B.png`).
- A stop at about 40 percent, and flicks down and up (`mid.cjs` and `timed.cjs` D, state log).
- Phone size (390 by 844): the pose in the frame, a seek to the end gives the idle directly, a seek back gives the pose (`ph.png`).

Second pass (the first run was cut off, so its probes were run again on the current build, which has SEL-camera-sky's sky and cameras in it): the growth sheet at 1440 by 900 (`shots2\A_sheet.png`) and at 390 by 844 (`shots2\ph_A.png`), the state log of four runs (`timed.cjs`), the join traces above, the stop below 25 percent, the head follow in pose (`shots2\g2-pose-head.png`: cursor centre, left, right, up, down, a visible but small turn of head and eyes) and the view turn in idle (`shots2\g2-idle.png`).

Not done or not verified: the sheet next to the reference video frames (the composition, the camera and the rendering are the other helpers' parts), the head turn in measured degrees, a touch drag on a real phone (the seeks were used), Silverbolt's head in the room (it only plays its clip: `follow(0)`, no hit targets; not compared with the reference). The handover fade and the scene's `fromClip` were checked with a seek from a playing `toIdle` to the first frame of the out zone and to 44 percent of it (no spike, the steps after it fall as the fade runs). A real hard wheel flick into the zone was not recorded. The dev server reloaded while other helpers edited, so some probe runs needed a retry.

Not done in `scene.ts`: the old film is SEL-out's to remove (they own that rewrite). I only changed the lines that called the removed `interactive`, the idle branch (now `sl.drive(1)`) and `sb.follow(0)`.
