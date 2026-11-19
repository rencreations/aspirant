# Round seven, SEL-camera-sky: the cameras, the skybox and the parallax (20 Nov 2026)

Request: `docs/superpowers/specs/2026-11-20-home-feedback-7-request.md`. Code: `actors/selena/camera-r7.ts` (pure, tested), `actors/selena/sky.ts`, `actors/selena/actor.ts` (the calls below). Data: `public/models/home/cameras-r7.json` (built by `scripts/home/models/cameras-r7/`). Work files: `D:\ren\aspirant-work\home\SEL-camera-sky\`.

## API (what the other helpers use)

Written first, the numbers are filled in as the fit finishes. The names will not change.

```ts
// A matched camera for a clip at a clip time. Clip names are the ClipName of the player.
sl.cameraFor(clip: ClipName, clipTime: number, vp: { w: number; h: number }, opts?: {
  portrait?: number | boolean; // 1 or true: the portrait camera (vertical.mkv), 0 or false: the horizontal one. A number blends the two.
  rect?: Rect | null;          // CSS px (top left origin): the window the frame is shown in. null = the whole screen.
  draw?: boolean;              // default true: cast.setCamera(camera) for the next draw (call it every frame).
}): PerspectiveCamera;
// The old call sl.cameraFor(clipTime, vp, opts) (the baked camera of city_intercation03) still works.

sl.cameraClip(): ClipName;       // the clip the camera follows (the one she is playing)
sl.setView(nx, ny, weight);      // the cursor (-1..1) turns the model group; weight 0..1 fades it in and out (SEL-anim calls it)
sl.sky: Sky;                     // the skybox sphere; sl.sky.visible, sl.sky.setAngles(yaw, pitch)
```

How a section draws her with these: no `place` is needed for the camera (the picture does not depend on `place`, as before). While a rect is given the sky and she are clipped to it (`clipRectangle(rect)`, the same rect), so the frame grows with the clip and the camera window grows with it.

(Filled in below as the work goes on.)
