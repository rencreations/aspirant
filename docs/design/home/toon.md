# The toon system (TOON-CORE, round two, 19 Nov 2026)

Code: `apps/web/src/features/home/actors/shared/toon.ts` (the API), `toon-glsl.ts` (the shader patches), `toon-math.ts` (the pure numbers). Request: "for all 3d model, make sure it's rendered in anime style like Tetra and the Drone" (`docs/superpowers/specs/2026-11-19-home-feedback-request.md`). Selena was converted first and is the reference (`actor-selena.md`).

## What it is

Every lit character of the home (Selena, her hand, Silverbolt, the Obsidia doll, the gramophone, the record crate) is drawn with `ToonMaterial` and an ink hull. Tetra and the drone stay as they are (unlit, painted, their own hull). The cast pass is still one pass; the toon characters read nothing from its rig: no environment map, no scene lights, no metalness or roughness, no tone mapping.

`ToonMaterial` is three's own `MeshBasicMaterial` with its lighting replaced in `onBeforeCompile`. That keeps skinning, morph targets and morph normals, clipping planes, `map`, `alphaTest`, `transparent`, `side` and vertex colours on three's chunks (one patch at four anchors, checked by `toon-glsl.test.ts` against the installed three, so an upgrade that moves an anchor fails a test). It compiles one program per band count (2 or 3) and one more with a glow map.

The shade, per pixel, in the camera's space:

1. `ndl = dot(normal, toonLight.dir)`. Bands: `smoothstep(cut - soft, cut + soft, ndl)` for the lit step (and the deep step with three bands). Edges are soft by 0.03 to 0.06: crisp but anti aliased, never a gradient.
2. Lit colour is the painted colour. The shade is the painted colour times a cool tint (`shade`), pushed in saturation (`sat`). Skin takes a warm tint. The deep band (three bands) is a darker, bluer tint.
3. Rim: a thin pale band at the silhouette (`1 - dot(N, V)` above `1 - rimWidth`), full on the side the light does not reach and a third of it on the lit side (so a light from behind still shows it), added in `toonLight.rim`.
4. Glint: `smoothstep` on `dot(N, H)` around `glintSize` (a cosine), only on the lit side, mixed to near white. A small hard shape, no reflection.
5. Glow: `emissive` (and an optional `emissiveMap`, read with the map's UV) added after the shade.
6. `toonLight.amount` (0 to 1) scales the shade and the rim: 0 is flat colour. A section can ease it for a fade.

The ink is a second mesh of the same geometry, skeleton and morph weights, drawn inside out. Its vertex is moved along the smooth normal in CLIP space by a number of CSS pixels (`uInkPx * 2 / canvas * w`), so the line has the same width on the screen at any distance, and pushed back a little in view space (`uInkPush`) so a one sided card never fights its own ink. The smooth normal (`aSmooth`) is one per place, welded by position, so the hull has no gaps at hard edges or texture seams. Alpha cards (hair fringes) cannot have a hull (a card has no thickness), so they get the CARD INK: eight copies of the card, each shifted on the screen by the line width round the circle, drawn in ink colour and cut by the card's own alpha. It draws the card eight more times: use it only where a card is a main read (Selena's front hair).

## API

```ts
import { toonify, ToonMaterial, InkMaterial, addInk, addCardInk, unlitFrom,
         toonLight, TOON_LOOKS, INK_COLOR } from "../shared/toon";

// 1. The usual way: convert a loaded glTF scene.
const set = toonify(gltf.scene, {
  pick: (mesh, source) => /* ToonPick | undefined */,   // per mesh, by name or material
  clippingPlanes: planes,        // optional: on the skin and the ink
  anisotropy: 8,                 // optional: set on every picture
  ink: sharedInkMaterial,        // optional: one InkMaterial for several sets
});
set.setHeight(heightOnScreenPx); // every frame it is shown: sizes the ink (CSS px of the figure's height)
set.dispose();                   // materials, hulls; NOT the textures or geometry (set.textures lists them)

// ToonPick: { look?: "default"|"skin"|"hair"|"metal"|"soft", tune?: Partial<ToonLookSpec>,
//             unlit?: boolean, ink?: boolean | "card", inkWeight?: number, emissive?: [r,g,b] }
// Default look: "metal" when the source metalness >= 0.6, else "default". Default ink: a hull for an
// opaque mesh, none for an alpha card. `unlit: true` gives a plain MeshBasicMaterial (eyes, screens).

// 2. By hand.
const m = new ToonMaterial({ map, color, look: "skin", tune: { soft: 0.05 }, side, alphaTest, transparent,
                             emissive: [r, g, b], emissiveMap, clippingPlanes });
m.setLook(TOON_LOOKS.metal);     // swap the whole look (a changed band count recompiles once)
const ink = new InkMaterial();   // one per actor, shared by its hulls; ink.setSize(h) / ink.setWidth(px)
const hull = addInk(mesh, ink);  // hull.mesh, hull.remove()
const fringe = addCardInk(mesh, material, ink);   // eight shifted copies for an alpha card

// 3. The light all of them share. getCast(stage).toon is the same object.
toonLight.set(-0.5, 0.55, 0.67); // toward the light, camera space (x right, y up, z toward the viewer)
toonLight.amount.value = 0.4;    // 0 flat, 1 full
```

`ToonLookSpec` (all in `toon-math.ts`): `bands` (2 or 3), `cut` (deep step, lit step, on the dot), `soft`, `shade` and `deep` (colour multipliers), `lit`, `sat`, `rim` and `rimWidth`, `glint` and `glintSize`. `bandWeights` and `shadeOf` are the same arithmetic in TypeScript, for tests and probes.

`cast.ts`: `getCast(stage).toon` is the light, and the cast pass calls `setToonView(stage.width, stage.height)` before every draw (the ink width is in CSS pixels). The env map, the key, the fill and the ambient are still there for the actors that are not converted yet. Remove them when the last one is.

## The look rules (so every model draws alike)

- Two bands for skin and cloth, three for hair and metal. Light from the upper left, in front (`KEY`).
- The shade is a hue shift, not a grey: cool violet by default, warm pink orange for skin.
- Ink: 1.2 px at a figure 120 px tall (a heavier line fills a figure that small with ink), about 1.8 at 400, 2.9 at 900, at most 3.5 (`outlineFor`). Colour `INK_COLOR` 0x20182e, a deep violet navy, never black. Card ink is 0.12 + h/2400 of that width, at most 0.5. Hair is fine: give a hair mesh `inkWeight: 0.6`.
- Metal gets a glint (0.9, size 0.94) and a strong rim. Skin gets no glint. Hair gets a soft one (0.55).
- Eyes, mouths, screens: `unlit`. Anything painted bright and meant to glow: `emissive`.
- Characters must read at 120 px and at full screen: look at both after any change.

## Numbers to tune

`TOON_LOOKS` (every constant of every look), `KEY` and the rim colour in `toon.ts`; `outlineFor` (width, push, card share) in `toon-math.ts`; `INK_COLOR`; the card ink's alpha cut (0.3) and the copy count (8) in `toon.ts`. A look can be changed live in a probe: `window.__sl.toon.toons[i].setLook({...TOON_LOOKS.skin, shade: [...]})` (the lab's `sl` is the actor; `toon` is its `ToonSet`).

## What each other actor must do

- **Silverbolt** (`actors/silverbolt/materials.ts`, `dress`): replace the PBR materials and its own outline with `toonify(model, { pick, clippingPlanes? })`. Armour and plates are `metal`, cloth and ribbons `default`, the glass or eyes `unlit` or `emissive`. Size the ink with `set.setHeight`. The seahorse neck is the Silverbolt helper's own task.
- **The doll** (`actors/doll`): `toonify`, `skin` for her face and hands, `soft` for the dress if it reads flat. Keep her own clipping and hover logic. Smaller by about 40 percent is the doll helper's task.
- **The hand** (`actors/hand`): it has its own copy of an outline (`hand/material.ts`, `hand/outline.ts`): drop both for `toonify` and `skin`.
- **The gramophone** and **the record crate**: static meshes work as they are (the normal chunks run without skinning). The crate draws its own shader from `cast.key.position`: convert it to `ToonMaterial` or read `toonLight.dir` in its own shader. If a part is an `InstancedMesh`, `addInk` makes a plain mesh: make the hull an `InstancedMesh` with the same matrices by hand.
- Everything: remove `envMap` and `envMapIntensity` use and the `cast.env` read; do not set `metalness` or `roughness` look decisions any more (the look decides).
- Do not draw a toon model through an ortho pass: the ink needs a perspective projection (the cast pass is one).

## How to look

`D:\ren\aspirant-work\home\TOON\` has the probes (the home runs HMR full reloads while other helpers edit: rerun a probe that dies with an execution context error): `lib.cjs` (opens the page at 1440x900, intro off, consent answered, builds the lab actor), `looks.cjs` (face, upper body, full, 240 px, big idle on a plain ground: `__home.seek(60.2)` is a light ground with only the drone), `frames.cjs` (the 4:5 list frame, the baked camera at 1.5 s and 3.7 s, the update cost), `final.cjs` (sizes 120, 240, 600 px, the light sweep, the pass cost with `gl.finish`), `compose.py` (the sheets), `real.cjs` (the real list and Selena sections, desktop and phone), `cost2.cjs` (draw calls and triangles, with and without the card ink; the totals are for about three frames, divide by three), `parts.cjs` (each mesh alone). Read the frames with `lead/stitch.py out.png cols scale files...`.

## Checked, and not

Checked in Chrome (real GPU, dev server): Selena in every clip, the face at 2600 px, 780 px, 600, 240 and 120 px, a light sweep (key, right, top, behind, amount 0), the 4:5 frame with the clipping planes, the baked camera, a blink, before and after against the round one frames, the real Selena section at 1440x900 and 390x844 (touch, dpr 2); no shader errors or console errors; the cast pass costs 0.13 to 0.17 ms with Selena hidden and 0.43 to 0.56 ms with her at full screen (two runs, `gl.finish` around the pass, shared machine so noisy; the card ink is 0.02 to 0.47 ms of that); 52 unit tests of the toon files (the shader anchors, the patches, the materials, `toonify`, the ink, the numbers); lint, tsc, knip on the folder.

Not verified: the list's own Selena frame (the tenth frame) in the real page (only the lab's rect and the real Selena section were seen); other browsers and GPUs (the patches use plain GLSL ES 3.0 and `#if 1`); an `InstancedMesh` or a morph-heavy mesh other than Selena's head; the GPU time of the card ink (about 41k triangles a frame for Selena's fringe); the look on a phone; context loss (the toon system holds nothing outside three's own tracking).

## Ink hull sign (fixed by the Silverbolt helper, 19 Nov 2026)

The hull is a back side material. Three negates the normal for a back side material (`FLIP_SIDED` in `defaultnormal_vertex`), so the hull was pushed inward and only showed where it poked out of thin parts. `patchInkVertex` now turns the normal back before it pushes (a test holds it). The outline of every toon actor is therefore much more visible than in the first frames of this note, and the widths in `outlineFor` were judged against the old, almost missing line: look at Selena, the hand and the doll again and lower the width if it is too heavy.
