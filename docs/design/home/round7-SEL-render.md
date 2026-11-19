# Round seven, SEL-render: Selena's rendering (20 Nov 2026)

Request: `docs/superpowers/specs/2026-11-20-home-feedback-7-request.md` ("The outline are TOO THICK ... make sure the outline DIDN'T DISTURB the model, especially the face ... match the final output EXACTLY like the video reference"). Code: `actors/selena/toon-look.ts` (new, her numbers), `actors/selena/actor.ts` (`dress`), `actors/shared/toon.ts`, `toon-glsl.ts`, `toon-math.ts` (surgical, nothing changes for the actors that do not ask), `actors/silverbolt/materials.ts` (the ink only). Work files and every frame sheet: `D:\ren\aspirant-work\home\SEL-render\`.

## API (what the other helpers use)

Nothing new is needed to draw her: `ensureSelena` and `place({ height })` are unchanged, the ink sizes itself from the height as before (`updateOutline`). For another actor that wants the same look:

```ts
import { toonify, INK_TINTS } from "../shared/toon";
toonify(scene, {
  fineInk: true, // the in-game hairline (0.65 px small, 1.1 px at the most)
  pick: (mesh, source) => ({
    inkTint: INK_TINTS.body, // the line takes the colour of the picture (hair | skin | body)
    inkFace: [0.12, 0.42], // a face: no line inside it, only on its outline
    inkFloor: [0.1, 0.045, 0.04], // the darkest the line may be (linear)
    inkCopies: 4, // for ink: "card" (alpha cards): shifted copies, default 6
  }),
});
```

`outlineFor(h, out, fine)` has the third argument. `InkMaterial` takes `options` `{ map, tint, face, floor, fine }`. Untinted hulls (every other actor) draw as before (one colour, the cast's line); only their vertex program has one more uniform (`uInkFace`, off).

## What the reference is made of (horizontal, idle, vertical and welcome recordings, 3840 by 1728, looked at at full size and at 4x)

- **The line.** A hairline: about 2 to 3 px at 3840 wide on the hair, 3 to 4 px on armour, so about 1 px at 1440. It is not one colour. It is a darker, more saturated tint of what it outlines: orange brown on the gold hair, rose brown on the skin, deep lavender grey on the white armour and Silverbolt, near black on the black gloves and the red crystal. No dark halo. The face has no line inside it at all (nose, lips, sockets): only the painted eye and brow lines, and the thin lines where a lock lies over the face.
- **The shade.** A soft cel. The face is lit almost flat (a pale pink shade with a wide soft edge). Hair is warm gold with deeper orange where it turns away, thin painted strand lines and a pale sheen, no violet shade. White armour has a light lavender shade with low contrast. Black armour shades smoothly from navy to a violet sheen.
- **Post processing.** None that can be seen: no bloom, no vignette, no colour grade over the picture (the frames are the scene itself, bright and saturated). So nothing was added to the cast pass.
- **The sky and the light.** The light is high and in front; the sky behind is the `skybox.png` (SEL-camera-sky).

## What was done

- **A line that is a third of the old one.** `FINE_LINE` in `toon-math.ts`: 0.65 px at a figure 120 px tall, 0.0004 px per px of height, 1.1 px at the most (it was 1.1 to 3.3, hair 0.6 of that). The line round the fringe's alpha cards is 0.75 of it. Selena and Silverbolt use it (`fineInk: true`); the doll, the hand, the gramophone and the crate keep the cast line.
- **A line in the colour of the surface.** `InkMaterial` with a `map` and a tint (`INK_TINTS`, `toon-glsl.ts` `inkTint`): the picture's colour pushed in saturation, raised to a power (gold goes to orange brown, white to deep grey) and scaled by a share that grows with the saturation. The hull and the copies of the card ink both read the picture. A floor (`INK_FLOORS`) keeps it from going black on the edge texels of a lock.
- **No line inside the face.** The head's hull is pushed only where the surface turns away from the viewer (`inkFace`, `smoothstep` on the facing): the nose, the lips and the sockets get no push, the jaw, the ear and the outline do.
- **The shade of the reference.** `SELENA_TUNE` in `toon-look.ts`: the face (soft edge 0.22, one pale pink band, almost no rim), the hair (warm orange shade, deep band only far from the light, sheen 0.2, a little deeper gold), the body (soft edge 0.15, light lavender shade, faint rim: the old pale rim read as a white outline on the black armour).
- **Fewer draws.** The fringe's card ink is 4 copies, not 6 (`FRINGE_COPIES`): at 0.75 px shifts four read the same (looked at 3.6x and at 420 px). Selena is now 16 meshes and about 97k triangles a frame (it was 20 and about 108k with six, 122k with eight); `update` 0.46 ms average in the dev server with the other helpers running, 61 fps at 1440 by 900.
- **The armour's line was black (second run).** At 3x the line on the white armour was pure black (0,0,1) and heavy beside the recording's. The armour's picture is painted black along its edges, so a line that takes its colour from the picture went black there. The recording's line on the armour is a soft dark grey (the dragon about 60 of 255, Selena's black armour about 25). `INK_FLOOR_BODY` in `shared/toon.ts` (linear 0.03, 0.026, 0.036, about 48 of 255) is now the darkest a body line may be, Selena's body and Silverbolt's armour use it, and the grey share of `INK_TINTS.body` went from 0.07 to 0.1 (white armour gets about 68 of 255). Seen at 3x before and after: soft dark grey hairline, no black. The width was not changed: measured on the recording (profile across a line, 3840 wide) the armour line is 3 to 4 px, hair 2 to 3 px, that is 1.1 to 1.5 px and 0.75 to 1.1 px at 1440, and ours is 0.65 to 1.1 px, so it is at the thin end of the recording's, as the owner asked.
- **Silverbolt**: `silverbolt_body` takes the fine tinted line (weight 1, `INK_TINTS.body`): a thin lavender grey on the white and a brown on the gold, no navy rim. Its shape, its look and its step cut are as they were.

## How it was looked at

A probe (`cmp.cjs`, `crops.py`, `mk.py`) puts her on the real stage with `place`, a clip and a time, at 1920 by 864 (the recording's shape), on a crop of the skybox, and puts a frame of the recording at the same size on the left and ours on the right, then crops and zooms 1.5 to 4.5 times. The pose at the same size and place (`h_21` against ours): the face, the hair, the line at 3.6x, the torso and the legs. The idle (`i_8`): the face. Small (420 px tall) and 4300 px tall figures for the line. Final numbers: face soft and flat like the recording, hair orange gold with thin orange lines, armour lines hairline, no black on the hair at any size.

## Looked at in the second run

Ours against the recording at the same scale (the recording's 3840 by 1728 frames `h_1`, `h_20`; ours at 3840 by 1728 through a device pixel ratio of 2, on a transparent page, `omitBackground`): the face, the hair, the white sleeve and the claws at 3x. Selena small (420 px figure, zoomed 2.4x) over the skybox: clean hairline, no black halo. Live in the real list (1440 by 900, the real renderer, the 4:5 frame at 25.8 screens and the expanded room at 27.1 with the sky): the frame shows the hairline, the face has no line inside it (nose and mouth are painted only), the hair has thin orange brown lines. Silverbolt's head at 2x: a dark hairline on the white and the gold, no navy rim.

## Not done or not verified

- **The frames are not at the recording's camera.** The pixel camera of `place` is a 48 degree lens, the recording's is another, so the legs and arms of the idle are far larger than in the recording. SEL-camera-sky owns that; the look was compared at the same size of face and torso, not at the same camera. Re-compare when `cameraFor(clip, t, vp)` (the matched camera) is wired: `D:\ren\aspirant-work\home\SEL-render\cmp.cjs` can be given a case that calls it.
- The dark armour is still flatter than the recording's navy to violet sheen (a multiplied shade cannot lift a black); the bracer's gold is paler than the recording's brown gold (the picture itself); the horns are a little dimmer and more purple than the recording's bright crimson (they share the hair's three bands).
- The 4:5 list frame was looked at at the size of a 420 px figure with `place`, not inside the real list section (its clipping planes are untouched). The phone was not looked at. Silverbolt was looked at only for the line (a 3/4 view of the head at 1500 px; the framing was off, so the side by side with the recording's dragon head is not exact); its step cut against the recording's smooth shading was left as it is (not the ink).
- GPU time is not measured (no timer query); `updateAvgMs` and the frame rate are.
- Tests: `outlineFor` fine line (`toon-math.test.ts`, run, 19 pass) and the tinted ink anchors (`toon-glsl.test.ts`, written, not run: the rule of this round is one test file). `tsc` filtered to the shared toon files, `selena/actor.ts`, `toon-look.ts` and `silverbolt/materials.ts`: no error.
