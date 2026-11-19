# Round seven, SEL-anim: Selena's state machine and her interaction (20 Nov 2026)

Request: `docs/superpowers/specs/2026-11-20-home-feedback-7-request.md`. Code: `actors/selena/states.ts` (pure, tested), `actors/selena/actor.ts` (the machine runs inside `update`), `actors/selena/look.ts` (the gentle gaze), `sections/list/runtime.ts` (`selenaStates`) and `sections/selena/scene.ts` (the room). Work files and probes: `D:\ren\aspirant-work\home\SEL-anim\` (`lib.cjs`, `timed.cjs`, `mid.cjs`, `gaze.cjs`, `phone.cjs`).

## API (what the other helpers use)

```ts
sl.drive(expand: number)   // every frame she is shown in the frame or the room. The machine takes (back) the control.
sl.jump(expand: number)    // a seek, a reload, a draw after she was hidden: the matching loop, cross fade 0.2 s, no transition.
sl.state(): "pose" | "toIdle" | "idle" | "toPose" | "free"
sl.handOver()              // the machine lets go ("free"). She keeps playing what she plays.
```

- `expand` is the list's `b.expand` (eased 0 to 1). The target becomes idle past 0.12 going up and pose below 0.04 going down (`TO_IDLE_AT`, `TO_POSE_AT`).
- Any direct `sl.clip`, `sl.blend` or `sl.play` makes the machine "free" (SEL-out scrubs the out clip with `sl.clip("city_intercation02", t)`). `sl.drive` takes the control back with a 0.2 s cross fade to the loop that matches. In the room the scene calls `sl.drive(1)`.
- `playRelease`, `interactive`, `socket("rightHover")` hooks and every hit target are gone. `sl.debug()` returns `{ state, look, view }` (the weights of the cursor) for the probes.
- The cursor view turn: the actor computes the cursor as a share of the screen from its middle (eased) and the weight (1 in idle, 0 in pose and in the transitions, eased 5 per second) and calls `setView(nx, ny, weight)` of SEL-camera-sky at the end of its own `update` (`pushView`, through a cast: it does nothing until the method exists in the class, and it is the only call).

## The four states

| state  | clip                               | plays            | cursor                           |
| ------ | ---------------------------------- | ---------------- | -------------------------------- |
| pose   | `city_interaction_R_loop`          | loops            | head and eyes                    |
| toIdle | `city_interaction_back_R` (3.21 s) | once, to its end | nothing                          |
| idle   | `city_idle`                        | loops            | head and eyes, and the view turn |
| toPose | `city_interaction_R` (3.29 s)      | once, to its end | nothing                          |

- A transition clip runs on her own clock at speed 1, never scrubbed or cut by the scroll. At its end the machine looks at the target again: if the visitor reversed meanwhile, the opposite transition starts at once (`toIdle` then `toPose`, as the probe `timed.cjs` D shows).
- **The visitor stops half way.** The growth is a scroll zone with an idle snap: half or more goes on to the end, less goes back. The clip that began finishes by itself in either case, then the loop that matches where the frame rested. A push that ends below 0.12 never starts a transition at all. Seen in `mid.cjs`: a stop at about 40 percent of the growth, the snap carried the frame to full, `toIdle` played its 3.2 s in 3.3 s of wall time and the idle looped.
- A jump (a seek, a reload, the list drawing her again after she was off screen) uses `jump`: the matching loop, no transition. The list calls `jump` when the growth moves by more than 0.3 in one frame or when she was not drawn the frame before (`JUMP_STEP`).
- Joins are cross fades (`STATE_FADE`: 0.12 into a transition, 0.15 into a loop). The seams the notes measured are all under 4 cm.

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

Not done or not verified: the sheet next to the reference video frames (the composition, the camera and the rendering are the other helpers' parts), the head turn in measured degrees, a touch drag on a real phone (the seeks were used), Silverbolt's head in the room (it only plays its clip: `follow(0)`, no hit targets; not compared with the reference).

Not done in `scene.ts`: the old film is SEL-out's to remove (they own that rewrite). I only changed the lines that called the removed `interactive`, the idle branch (now `sl.drive(1)`) and `sb.follow(0)`.
