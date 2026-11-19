# Round seven, CAM-portrait: the portrait window, Silverbolt in the list frame (20 Nov 2026)

Request: `docs/superpowers/specs/2026-11-20-home-feedback-7-request.md`. Work files: `D:\aspirant-work\home\CAM-portrait\`. Code: `actors/selena/camera-r7.ts` (`R7Crop`, `DEFAULT_CROP`, `cropFor`, `lensForCrop`), `actors/selena/actor.ts` (`cameraForClip`), `sections/list/dragon.ts` (new), `sections/list/runtime.ts`, `sections/list/preload.ts`, `sections/selena/scene.ts`. Data: `scripts/home/models/cameras-r7/fits.json` key `portrait`, shipped as `portraitCrop` in `cameras-r7.json`.

## What I found: there is no separate portrait camera

- `vertical.mkv` is 3840 by 1728, the same 20:9 shape as `horizontal.mkv`. It is not a portrait file.
- The two recordings share one static camera. The idle frames are identical (same pose, same dragon, same
  framing at 2 s). In the pose frames the background (the red star, the ring at the left, the towers) is at the
  same place, and a pixel difference of the background strip (x under 120 of 960) is 7.3 between the two
  recordings against 6.6 between two times of the same recording. So the camera that CAM-landscape fitted
  to `horizontal.mkv` is also the camera of `vertical.mkv`.
- The two recordings show different pose clips. `horizontal.mkv` at 14 s is `city_interaction_R_loop` (heart
  pin, grin, the swords lower left, the dragon top right: checked against our render of the clip, side by
  side and as a 50 percent overlay, `shots/cmp_pose.png`). `vertical.mkv` at 14 s is another clip: she leans
  forward, the left hand at her mouth in a kiss, the hair to the right. It is almost certainly
  `city_interaction_L_loop` (the source has `_L`, `_L_loop` and `cam_city_interaction_L_loop`; the owner's list
  names only the R clips and the glb has no L clip). So `vertical.mkv` cannot be used to fit the R pose, and it
  needs no camera of its own.
- I tried the landmark fit first against `vertical.mkv` (eyes, bones, skinned vertices projected into the
  frame, `camlib.py`, `ov*.py`). It was the wrong target for the reason above, and the head is the part of the
  loop that moves most, so the eyes made a bad anchor (a 33 degree roll came out of it). Dropped.

So the portrait camera is the landscape camera, and a portrait window is a crop of the recording's frame. It is
the recording's perspective and lens exactly, with another window onto it.

## The crop

`portrait.crop` in `fits.json` (and `DEFAULT_CROP` in code, used when the json has none): `[fx, fy, h]` for the
`idle` and the `pose`.

- `fx`, `fy`: the window's middle as a share of the recording's frame width and height, from the top left.
- `h`: the window's height as a share of the frame's height (more than 1 shows sky above and below the
  recording's frame, which the sky quad fills).
- The window's width follows from its shape, so the same numbers serve the 4:5 frame and a phone's screen.
- Pose `[0.545, 0.5, 1.2]`: she is in the middle, the dragon's jaw and the right claw come in behind her
  (the window shows x 0.33 to 0.76 of the frame). Idle `[0.6, 0.45, 1.3]`: head and body, the dragon at the left.
  The transitions blend the two ends with a smooth step over the clip. The out clip keeps the idle crop.
- `lensForCrop` is `lensFor` with the window's middle moved to (`fx`, `fy`) of the frame. The focal length is the
  recording's, the optical axis stays where the key has it. 16 tests in `camera-r7.test.ts` pass (4 new).
- A new fit of the landscape camera needs no change here: the crop is in the recording's own frame, so it
  follows whatever camera the key holds.

Compared with the recording: the window of `hp_14` (the crop above, black where the frame ends) beside our
frame at the same crop and as a 50 percent overlay. The swords, the legs, the right claw and the dragon agree
within about 3 percent of the window height. The head differs by the loop's phase (the clip's head tilt, the
grin). It is a comparison at one phase, not a measurement of every frame.

## Silverbolt in the list frame

`sections/list/dragon.ts` `showDragon(sl, sb, time)`, called every frame she is drawn by the list and by the
room (the same function, so nothing changes at the handover). It places the dragon in her own space (as the
room did), draws it through her fitted lens (`frameWith`), so it is cut by the same window and stands in front
of the sky, and plays the clip that matches hers at her time: `city_interaction_R_loop` with hers, `city_idle`
with hers, and for her two transitions (the dragon has no twin clip) its idle and pose loops cross faded by the
progress of her clip. Its head stays still (`follow(0)`), no touches.

- The room no longer glides the dragon in (`GLIDE`, `roomPlace`, the beat `dragon` are unused): it was already
  behind her. `room.ts` is only read by its own test now.
- The list preload has `silverboltItems({ priority: 41 })`, deferred, after hers. The dragon joins when it is
  built, as she does; a failure leaves the frame without it.
- Cost (dev server, real Chrome, 1440 by 900, the pose frame with both drawn): Selena `update` 0.24 ms, Silverbolt
  `update` 0.12 ms, frames 16.66 ms average at 60 Hz (p95 17.5, max 18). The draw is one more framed root in the
  same pass. Not measured on the production build or a weak machine.

## The growth and the phone

- Wide screen: the lens mixes in pixels from the crop (4:5) to the whole recording frame as the window grows,
  and the pose mixes with it. Looked at in a sheet of nine points of the growth (`shots/g_sheet.png`, seeks from
  25.4 to 27.4): the sky and the model keep one relation, no jump of the framing, the dragon stays with her. Seeks
  are jumps for her state machine, so the sheet shows loops, not the timed transitions.
- Phone: the list passed `portrait 1 - e`, which ended on the recording's whole frame, while the room asks for the
  portrait crop on a phone: a jump of the lens at the handover (she became a thin strip, then jumped large). The
  list now keeps `portrait 1` on a phone while its lens rectangle grows to the screen, so it ends on exactly the
  room's picture. The old "legs large and cut" came from the cover lens centred on the optical axis; the crop
  centres on her head and body (`shots/ph2_sheet.png`, 390 by 844). The out camera takes the same crop
  (`outCameraFor` goes through `cameraFor`), so the swing from the room to the out clip starts on the same picture.

## Still wrong, or not done

- The portrait window is not a 1:1 match of anything the owner recorded in a portrait: no such recording exists.
  The crop is my choice (above). It is data, four numbers: change `fits.json` `portrait.crop` and the json.
- The pose of `vertical.mkv` is a clip the glb does not hold. If the owner wants that kiss pose, the L clips must
  be exported (`scripts/home/models/blender/selena.py`).
- Seen on a phone only at rest and at a few seeks, not as a timed scroll with the transitions. The idle crop on a
  phone still shows a close up of the head and chest (cover by height of a 20:9 frame).
- Not looked at: the out zone on a phone after the first notch, the first appearance of the dragon (a shader
  compile could cost a frame; `ensure` warms it), the dragon's tail and wing springs through the pose to idle
  transition (cross faded, not watched).
- The sky is the landscape helper's and still does not agree geometrically with the recording's background.
- `json` was patched with `portraitCrop` directly (no Blender run) to avoid racing the landscape rebuild; the
  build script now writes the same key, so a rebuild keeps it.
