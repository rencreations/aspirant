# Round seven, SEL-camera-sky: the cameras, the skybox and the parallax (20 Nov 2026)

Request: `docs/superpowers/specs/2026-11-20-home-feedback-7-request.md`. Code: `actors/selena/camera-r7.ts` (pure, tested in `camera-r7.test.ts`), `actors/selena/sky.ts`, `actors/selena/actor.ts` (the calls below), `actors/shared/cast.ts` (the two draw mode), the wiring in `sections/list/runtime.ts` and `sections/selena/scene.ts` and `out-camera.ts`. Data: `public/models/home/cameras-r7.json` (built by `scripts/home/models/cameras-r7.mjs`, how the fit was made is in `scripts/home/models/cameras-r7/README.md`), the sky `public/img/home/selena-sky.webp` (the owner's `skybox.png`, 1774 by 887, 266 KB). Work files: `D:\ren\aspirant-work\home\SEL-camera-sky\`.

## API (what the other helpers use)

```ts
// The easy way: ask for her picture. The actor draws it itself in update(), after the pose of this
// frame is written, so the camera and the pose never differ by a frame. Call it every frame she is
// shown in a frame or a room. The sky, the view turn and the pair (see below) come with it.
sl.frame(vp: { w, h }, { portrait?: number | boolean; rect?: Rect | null });
//   portrait 1 (or true): the portrait camera's frame covers `rect` (the list's 4:5 window).
//   portrait 0 (or false): the recording's whole frame on the screen (contain).
//   a number in between mixes the two lenses in pixels and the two poses, so the window can grow.

// The camera itself, for a clip at a clip time (a section that wants the object).
sl.cameraFor(clip: ClipName, clipTime: number, vp, { portrait?, rect?, draw? }): PerspectiveCamera;
//   `draw` (default true): the cast is drawn through it for the next frame, with the sky.
//   `draw: false` only returns it (the out zone uses it as its base camera).
sl.cameraFor(clipTime, vp, options)      // the old call (the baked camera of city_intercation03) still works
sl.hasFittedCameras(): boolean           // cameras-r7.json loaded
sl.cameraClip(): ClipName                // the clip the last cameraFor followed

// The cursor turns the whole model, slightly (SEL-anim calls it every frame from update()).
sl.setView(nx, ny, weight)
//   nx right and ny up, -1..1, from the middle of the screen. weight 0..1 (1 in the idle, 0 in the
//   pose and the transitions) fades the turn in and out on springs that do not overshoot.

// The sky and its companions.
sl.sky: Sky | null                       // the screen quad of the skybox; sl.skyVisible(on)
sl.pointSky(camera)                      // a camera a section set itself (a zoomed window): point the sky through it
sl.frameWith(root: Object3D)             // draw this root (Silverbolt) through her lens too
```

The clip names are the `ClipName`s of the player: `city_idle`, `city_interaction_R_loop`, `city_interaction_R` (idle to pose), `city_interaction_back_R` (pose to idle) and `city_intercation02` (the out clip). `cameras-r7.json` has all five.

How a section draws her: it does not place a camera. It calls `sl.frame(vp, ...)` and keeps calling `sl.place(...)` (the scale and the position are what the world is in, the picture does not depend on them). A frame in the list passes `portrait: 1 - e` and `rect` (the growing window); the room passes `portrait: 0`; on a phone the room passes `portrait: 1` with no rect (the frame covers the screen).

## The two draw mode of the cast (`cast.setCamera(camera, framed)`)

The drone and the doll are placed in the screen's pixels (the pixel camera). A baked lens would put them in the wrong place, and the scissor of the list's window would cut them. So a fitted camera draws in two steps: the framed roots (hers, with the sky child, and Silverbolt's after `frameWith`) through the fitted lens, cut to the window by the scissor; then the depth is cleared and everything else in the pass is drawn through the pixel camera, uncut, in front. The cast keeps the old one draw path for every other caller.

## The camera data and the fit: NOT 1:1 with the recording

**What ships is the game's own cameras** (`cam_city_*`, no correction), about 1.7 times tighter than
`horizontal.mkv`, with the paths of the two transitions and of the out clip. The fit to the recording
was attempted and did not succeed (details, what went wrong and what would finish it:
`scripts/home/models/cameras-r7/README.md`). The runtime does not depend on it: a fitted camera is
four numbers per loop in `scripts/home/models/cameras-r7/fits.json` (`matrix`, `vfov`, `shy`) and a
rebuild. Open points that need the owner or a next pass:

- the camera, the lens and the framing are not the reference's (the recording is a wider lens from
  nearer her; in the idle it shows the dragon's head at the left, which the game's camera crops);
- the portrait camera (`vertical.mkv`) was not fitted: the 4:5 window uses the same camera covering
  the window (`portrait` data table is supported by the code and empty);
- Silverbolt is not drawn in the list's frame (only in the room, through `frameWith`).

## The sky

An equirectangular picture read by a shader (`sky.ts`): a screen quad at the far plane, drawn before everything (`renderOrder` -1000, no depth), each pixel finds its ray from the inverse of the frame's projection, turns it by the camera's world rotation, her own turn and `sky.fromFilm` (one matrix for the whole scene: the sky is fixed to the world) and reads the picture at its longitude and latitude. No tone mapping, sRGB in and out, no mip maps (an atan seam would show). It is a child of her root, so it hides with her, and it is drawn only in frames a fitted camera was drawn (`filmDrawn`, like the clip rectangle). Because it reads the camera as it was before the view turn, the turn orbits the camera round her and the sky does not move.

## The view turn (parallax)

`setView` drives two critically damped springs (6 per second) and a weight (5 per second). The camera orbits her anchor by up to 4 degrees about her vertical axis and 2 degrees about the camera's right axis (`VIEW_TURN` in `camera-r7.ts`, `orbitAbout`), the other way round from the cursor, as if she and Silverbolt turned toward it. The sky stays still.

## The sky: placed by its star only

The skybox does not agree geometrically with the recording's background (see the README of
`cameras-r7/`), so there is no honest 1:1. `fits.json` `sky` turns it so the star lands where the
recording has it for the idle camera (yaw -0.429, pitch 0.446, no roll). It does not change between
clips (the sky is fixed to the world), the loading list has it (`selenaItems`, deferred with her).

## Looked at, and how

Real Chrome on the dev server (1440 by 900, the real wheel and `__home.seek`), shots in `D:\ren\aspirant-work\home\SEL-camera-sky\shots\`:
enspirant-work\home\SEL-camera-sky\shots\`:

- The list's 4:5 window at rest (seek 25.6, the pose loop) and the room (seek 27.4, the idle): the sky
  sits behind her and Silverbolt (`m_sheet.png`), the drone and the doll stay in their pixel places
  (the two draw mode of the cast), the window cut by the scissor. The growth of the window mixes the lens
  in pixels (not watched frame by frame).
- The parallax (`probe-parallax`, an earlier camera): the cursor at the four corners and the middle of
  the room: the sky did not move and she and Silverbolt turned against it (`par_sheet.png`). Not
  measured in pixels, and not re-run on the final camera.
- Numbers: `camera-r7.test.ts` (12 tests, passing), `tsc --noEmit -p apps/web` clean.
- NOT done: a side by side with the recording frames at the final camera (there is none to compare
  because the camera is not the recording's), the phone size, the out zone's boundary shots (the first
  notch of the out zone now draws the out clip's own camera, which starts on the idle camera), the
  transitions' camera against the recording (the recording's camera seems to swing less than the
  character does; the game's path is kept).

## Notes for the others

- Anything that must share depth with her (SEL-out's white sheet) must go in through `frameWith`,
  otherwise the two draw mode draws it after the depth clear, through the pixel camera. The sheet
  is drawn by `closeIn` through `cast.setCamera(this.show)` (one draw, everything through that
  camera), which is unaffected.
- `scene.ts`: the room asks `sl.frame(vp, { portrait: 0 })` (a phone: portrait 1), the out zone asks
  `sl.cameraFor("city_intercation02", t, vp, ...)` until the swing is complete, then the old branches
  (`outCameraFor`, which now reads my out camera) take over with `sl.pointSky(camera)`.
- `room.ts`: the dragon rests where its clip puts it (offsets zero) so the composition is the
  game's. `room.test.ts` was changed for it.
- The list passes the whole card as the lens rect and the visible part as `clip` (the scissor).
