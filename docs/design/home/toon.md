# The toon system (TOON-CORE, round two, 19 Nov 2026)

Code: `apps/web/src/features/home/actors/shared/toon.ts` (the API), `toon-glsl.ts` (the shader patches), `toon-math.ts` (the pure numbers). Request: "for all 3d model, make sure it's rendered in anime style like Tetra and the Drone" (`docs/superpowers/specs/2026-11-19-home-feedback-request.md`). Selena was converted first and is the reference (`actor-selena.md`).

## What it is

Every lit character of the home (Selena, her hand, Silverbolt, the Obsidia doll, the gramophone, the record crate) is drawn with `ToonMaterial` and an ink line. All six are converted (round two, 19 Nov 2026). Tetra and the drone are the reference and stay as they are (unlit, painted, their own hull). The cast pass is still one pass; the toon characters read nothing from its rig: no environment map, no scene lights, no metalness or roughness, no tone mapping. The consistency pass of R-T (the line-up, one line rule, a crisp glint, a rim that shows on light surfaces, a warm skin split for Selena's body, the hand's gloss and gold) is in "Round two polish" at the end.

`ToonMaterial` is three's own `MeshBasicMaterial` with its lighting replaced in `onBeforeCompile`. That keeps skinning, morph targets and morph normals, clipping planes, `map`, `alphaTest`, `transparent`, `side` and vertex colours on three's chunks (one patch at four anchors, checked by `toon-glsl.test.ts` against the installed three, so an upgrade that moves an anchor fails a test). It compiles one program per band count (2 or 3) and one more with a glow map.

The shade, per pixel, in the camera's space:

1. `ndl = dot(normal, toonLight.dir)`. Bands: `smoothstep(cut - soft, cut + soft, ndl)` for the lit step (and the deep step with three bands). Edges are soft by 0.03 to 0.06: crisp but anti aliased, never a gradient.
2. Lit colour is the painted colour. The shade is the painted colour times a cool tint (`shade`), pushed in saturation (`sat`). Skin takes a warm tint. The deep band (three bands) is a darker, bluer tint.
3. Rim: a thin band at the silhouette (`1 - dot(N, V)` above `1 - rimWidth`), full on the side the light does not reach and a third of it on the lit side (so a light from behind still shows it). On a dark surface it is a pale glow (`toonLight.rim` added); on a light one (luminance 0.55 to 0.85 and up) it is a cool deepening instead (the colour times 0.6, 0.68, 1.0), because a glow cannot show on white.
4. Glint: `smoothstep` on `dot(N, H)` around `glintSize` (a cosine), only on the lit side, mixed to near white. A small hard shape, no reflection. Its edge is `fwidth(nh) * 0.75` wide (0.0004 to 0.012), so it is about one pixel at any curvature (a fixed width spanned a whole gramophone horn and read as a soft cloud).
5. Glow: `emissive` (and an optional `emissiveMap`, read with the map's UV) added after the shade.
6. `toonLight.amount` (0 to 1) scales the shade and the rim: 0 is flat colour. A section can ease it for a fade.
7. Skin split (`skinSplit: true`, off by default): the texels of the picture that are skin coloured (`toonSkin`: green about half and blue about half of the red, not white, grey, violet, red or gold, luminance above 0.2) take the skin look's warm shade (`uWarm`, `uWarmDeep`), the rest the look's own. For a body painted on one sheet with its armour. It is a uniform, not a program: no recompile.

The ink is a second mesh of the same geometry, skeleton and morph weights, drawn inside out. Its vertex is moved along the smooth normal in CLIP space by a number of CSS pixels (`uInkPx * 2 / canvas * w`), so the line has the same width on the screen at any distance, and pushed back a little in view space (`uInkPush`) so a one sided card never fights its own ink. The smooth normal (`aSmooth`) is one per place, welded by position, so the hull has no gaps at hard edges or texture seams. Alpha cards (hair fringes) cannot have a hull (a card has no thickness), so they get the CARD INK: six copies of the card (`addCardInk`, default 6), each shifted on the screen by the line width round the circle, drawn in ink colour and cut by the card's own alpha. It draws the card six more times: use it only where a card is a main read (Selena's front hair). Six read the same as eight (looked at: Selena's face at 2600 px, the doll at 700 px: no scallops, the corners a hair rougher) and cost a quarter less.

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
//             unlit?: boolean, ink?: boolean | "card", inkWeight?: number, emissive?: [r,g,b],
//             skinSplit?: boolean }
// Default look: "metal" when the source metalness >= 0.6, else "default". Default ink: a hull for an
// opaque mesh, none for an alpha card. `unlit: true` gives a plain MeshBasicMaterial (eyes, screens).

// 2. By hand.
const m = new ToonMaterial({ map, color, look: "skin", tune: { soft: 0.05 }, side, alphaTest, transparent,
                             emissive: [r, g, b], emissiveMap, clippingPlanes, skinSplit });
m.setLook(TOON_LOOKS.metal);     // swap the whole look (a changed band count recompiles once)
const ink = new InkMaterial();   // one per actor, shared by its hulls; ink.setSize(h) / ink.setWidth(px)
const hull = addInk(mesh, ink);  // hull.mesh, hull.remove()
const fringe = addCardInk(mesh, material, ink);   // six shifted copies for an alpha card

// 3. The light all of them share. getCast(stage).toon is the same object.
toonLight.set(-0.5, 0.55, 0.67); // toward the light, camera space (x right, y up, z toward the viewer)
toonLight.amount.value = 0.4;    // 0 flat, 1 full
```

`ToonLookSpec` (all in `toon-math.ts`): `bands` (2 or 3), `cut` (deep step, lit step, on the dot), `soft`, `shade` and `deep` (colour multipliers), `lit`, `sat`, `rim` and `rimWidth`, `glint` and `glintSize`. `bandWeights` and `shadeOf` are the same arithmetic in TypeScript, for tests and probes.

`cast.ts`: `getCast(stage).toon` is the light, and the cast pass calls `setToonView(stage.width, stage.height)` before every draw (the ink width is in CSS pixels). The env map, the key, the fill and the ambient are still there for the actors that are not converted yet. Remove them when the last one is.

## The look rules (so every model draws alike)

- Two bands for skin and cloth, three for hair and metal. Light from the upper left, in front (`KEY`).
- The shade is a hue shift, not a grey: cool violet by default, warm pink orange for skin.
- Ink: one rule for the cast, `LINE` and `outlineFor` in `toon-math.ts`: 1.1 px at a figure 120 px tall (a heavier line fills a figure that small with ink), 1.9 at 400, 2.5 at 600, 3.3 at 900, never more than 3.3. Colour `INK_COLOR` 0x20182e, a deep violet navy, never black. Card ink is 0.12 + h/2400 of that width, at most 0.5. Hair is fine: give a hair mesh `inkWeight: 0.6`. Each actor feeds `setHeight` / `setSize` the height of its own main figure (see the table in "Round two polish") and scales by its own weight.
- Metal gets a glint (0.9, size 0.94) and a strong rim. Skin gets no glint. Hair gets a soft one (0.55).
- Eyes, mouths, screens: `unlit`. Anything painted bright and meant to glow: `emissive`.
- Characters must read at 120 px and at full screen: look at both after any change.

## Numbers to tune

`TOON_LOOKS` (every constant of every look), `KEY` and the rim colour in `toon.ts`; `LINE` and `outlineFor` (width, push, card share) in `toon-math.ts`; `INK_COLOR`; the card ink's alpha cut (0.3) and the copy count (6: `addCardInk` in `toon.ts`, `COPIES` in `doll/ink.ts`). A look can be changed live in a probe: `window.__sl.toon.toons[i].setLook({...TOON_LOOKS.skin, shade: [...]})` (the lab's `sl` is the actor; `toon` is its `ToonSet`).

## Who uses it (all done)

- **Selena** (`selena/actor.ts`, `dress`): `toonify` with a pick per mesh; `skin` head, `hair` hairs (front hair has the card ink, the back hair a hull of weight 0.6), `default` body with `skinSplit`, the eyes `unlit`.
- **Silverbolt** (`silverbolt/materials.ts`): `toonify`; armour `metal` with a hull of weight 1.4, the ribbon `soft` with no ink, the cheek crystals `default` with a glow, the eyes `unlit`; the painted atlases are cut into steps in the shader after the toon patch.
- **The doll** (`doll/`): three `ToonMaterial`s by part (cloth `default`, skin `skin` with the face shader chained on, hair `hair`). Her line is six shifted copies of the whole mesh (`doll/ink.ts`), because her hair is open sheets and has no inside for a hull.
- **The hand** (`hand/material.ts`, `hand/glsl.ts`): `ToonMaterial` `default` with the leather's numbers (`LOOK.leather`), a chained patch for the claws, the gold and the foot fade; the shared `InkMaterial` with the same fade.
- **The gramophone** and **the record crate**: `toonify` and `ToonMaterial` with their own `InkMaterial` weights (1.2 and 1.2).
- Everything: no `envMap`, no `metalness`, no `roughness`, no `cast.env` read.
- Do not draw a toon model through an ortho pass: the ink needs a perspective projection (the cast pass is one).

## How to look

`D:\ren\aspirant-work\home\TOON\` has the probes (the home runs HMR full reloads while other helpers edit: rerun a probe that dies with an execution context error): `lib.cjs` (opens the page at 1440x900, intro off, consent answered, builds the lab actor), `looks.cjs` (face, upper body, full, 240 px, big idle on a plain ground: `__home.seek(60.2)` is a light ground with only the drone), `frames.cjs` (the 4:5 list frame, the baked camera at 1.5 s and 3.7 s, the update cost), `final.cjs` (sizes 120, 240, 600 px, the light sweep, the pass cost with `gl.finish`), `compose.py` (the sheets), `real.cjs` (the real list and Selena sections, desktop and phone), `cost2.cjs` (draw calls and triangles, with and without the card ink; the totals are for about three frames, divide by three), `parts.cjs` (each mesh alone). Read the frames with `lead/stitch.py out.png cols scale files...`.

## Checked, and not

Checked in Chrome (real GPU, dev server): Selena in every clip, the face at 2600 px, 780 px, 600, 240 and 120 px, a light sweep (key, right, top, behind, amount 0), the 4:5 frame with the clipping planes, the baked camera, a blink, before and after against the round one frames, the real Selena section at 1440x900 and 390x844 (touch, dpr 2); no shader errors or console errors; the cast pass costs 0.13 to 0.17 ms with Selena hidden and 0.43 to 0.56 ms with her at full screen (two runs, `gl.finish` around the pass, shared machine so noisy; the card ink is 0.02 to 0.47 ms of that); 52 unit tests of the toon files (the shader anchors, the patches, the materials, `toonify`, the ink, the numbers); lint, tsc, knip on the folder.

Not verified: the list's own Selena frame (the tenth frame) in the real page (only the lab's rect and the real Selena section were seen); other browsers and GPUs (the patches use plain GLSL ES 3.0 and `#if 1`); an `InstancedMesh` or a morph-heavy mesh other than Selena's head; the GPU time of the card ink (about 41k triangles a frame for Selena's fringe); the look on a phone; context loss (the toon system holds nothing outside three's own tracking).

## Ink hull sign (fixed by the Silverbolt helper, 19 Nov 2026)

The hull is a back side material. Three negates the normal for a back side material (`FLIP_SIDED` in `defaultnormal_vertex`), so the hull was pushed inward and only showed where it poked out of thin parts. `patchInkVertex` now turns the normal back before it pushes (a test holds it). The outline of every toon actor is therefore much more visible than in the first frames of this note. The widths were recalibrated against the fixed line in the R-T pass (below).

## Round two polish (R-T, 19 Nov 2026)

The brief: make the whole cast read as one anime production, at the sizes they have on the real page.

**How it was judged.** A line-up frame (`D:\ren\aspirant-work\home\R-T\lineup.cjs`: Selena, Silverbolt, the doll, Tetra, the hand, the gramophone, the crate and the drone in one frame through `window.__home.lab`, every other pass hidden, a plain ground of #f4f6f9 (daybreak) or #0a0e16 (storm) with the corner pixel checked) at 1440x900 and 390x844, before and after each shared change. Selena's face at 2600, 400, 240 and 120 px (`selena.cjs`) before and after every shared change, because her face was signed off. Each actor alone at several sizes (`one.cjs`, `sizes.cjs`). The live ink width of every actor is read from its `InkMaterial` (`px`).

**The line.** At the line-up size (a figure about 370 px) the widths before were Selena 1.8, Silverbolt 2.2 (the armour hull, weight 1.4), the doll 1.65, the hand 1.7, the gramophone 2.1 (weight 1.4), the crate 1.7. Tetra's own line is `clamp(0.0034 * tall, 1, 2.3)` px (1.3 at 370) and the drone's `clamp(0.0042 * size, 1.1, 2.4)`, in the dark blue greys 0x2a3342 and 0x1f2735. The cast now follows one rule, `LINE` in `toon-math.ts`: 1.1 px at 120 px, 1.9 at 400, 2.5 at 600, 3.3 from 900 (the old rule was 1.2, 1.8, 2.4, 2.9). That is a little bolder than Tetra and the drone. Those two are the owner's reference and were left alone; the toon models carry more detail (hair locks, claws) and read at 1.9 without fighting them side by side (looked at in the line-up). The gramophone's weight went from 1.4 to 1.2 (it was the one heavier line). The weights are still per actor (hair 0.6, Silverbolt armour 1.4, the gramophone and the crate 1.2, the doll `inkBoost` up to 1.4 for her bigger sizes) because each actor feeds the height of its own main figure: Selena her standing height (REF_HEIGHT), Silverbolt the body block (about 1 m of a long dragon), the doll her standing height, the hand wrist to claw, the gramophone and the crate their box. Do not change a weight without the line-up.

**On the storm ground** the ink (0x20182e) is nearly the ground (0x0a0e16): the characters read by their own colour and the rim, as Tetra and the drone do. That is the same for every actor and was left as it is.

**Shared shader changes** (`toon-glsl.ts`, tests in `toon-glsl.test.ts`):

- The glint edge is `fwidth(nh)` wide (see the shade list). The gramophone's horn glint went from a soft white cloud to a hard shape. The other actors that use a glint (Silverbolt's armour, the hair of Selena and the doll, the hand's leather) were looked at: no regression.
- The rim on a light surface is a cool deepening, not a vanishing glow.
- `skinSplit` (see the shade list). Selena's three body meshes use it. The mask was drawn over her body sheets once (green over the texture): it covers the pink flesh and not the white, silver, violet, pink or gold armour; a few thin anti aliased edges of gold trim are caught and cannot be seen. Her head, hair and the other actors do not use it.

**The hand** (`hand/glsl.ts`): the painted shine of the leather (soft airbrushed grey clouds that read as latex) is cut into a dark leather and hard edged pale violet shapes (`gShine`, edge by `fwidth`). The bracer's gold is its own two tone (a deep warm orange on the shade side, `gGold`), not the claws' bright flat colour that went pale yellow.

**Silverbolt** (`silverbolt/materials.ts`): the step cut of the painted atlases keeps the colour as it is where one pixel spans many steps (`fwidth`, a small figure), so a 120 px dragon is not speckled by cutting a blur of noisy paint.

**Six ink copies** instead of eight for the card ink (`addCardInk` default) and for the doll's line (`COPIES` in `doll/ink.ts`).

**Cost** (draws and triangles counted from the scene graph of each actor, `count.cjs`, before the six copies):

| actor            | draw calls              | triangles a frame | of which ink                                     |
| ---------------- | ----------------------- | ----------------- | ------------------------------------------------ |
| Selena           | 20 (18 with six copies) | 118k (about 108k) | 5 hulls and the fringe's copies (41k with eight) |
| Silverbolt       | 6                       | 12k               | 1 hull                                           |
| the doll         | 11 (9)                  | 129k (about 100k) | her mesh again 8 times (6)                       |
| the hand         | 2                       | 5k                | 1 hull                                           |
| the gramophone   | 10                      | 31k               | 5 hulls                                          |
| the record crate | 17                      | 5k                | 8 hulls                                          |
| Tetra, the drone | 6, 4                    | 9k, 4k            | their own hull is in the count                   |

The whole line-up (all eight, 76 draw calls and 323k triangles a frame before the six copies) measured 2 to 4 ms in the cast, Tetra and drone passes with `gl.finish` around each, on the dev server with ten helpers working and a shared GPU. That is too noisy to split by actor (hiding an actor's children did not change the draw count, so every run measured the whole cast): do not quote it as a budget. The earlier measurement stands for Selena alone: 0.43 to 0.56 ms at full screen, of which the card ink was 0.02 to 0.47 ms. The doll's line is the largest cost of the cast (the whole skinned mesh six more times): if a section has to give something up, it is the first to cut.

**Not done or not verified:**

- Tetra's and the drone's line were not brought up to the cast's: they are the reference.
- Selena's hair at 120 and 240 px: looked at, it reads as a violet mass with a fine outline; not changed (the hair hull is 0.6 of the line and the card line is 0.17 to 0.22 of it at that size).
- The doll in the dragon's mouth is a placement of the bolt section: in the real bolt section she rides on the head between the horns (seen at 1440x900); not changed.
- The real sections (`real.cjs`, `window.__home.seek` then a screenshot after 3 s): looked at in the toon look at 1440x900: the hero, the three bolt frames, the fall, the hand section with the doll in her palm (the gloss shapes and the orange bracer read well) and the list's tenth frame with the doll on it. NOT looked at: the list's last frame, selena, music, funny, chase and bend. Another helper's build error (`rows/runtime.ts`) covered the page for part of the run and the dev server then reloaded on every edit of the other helpers, so those frames were never captured.
- The phone (390x844) line-up, day and storm, was taken and the day frame looked at (the cast reads as one at that size); not studied at pixel level. The real sections on the phone were not looked at.
- Other browsers and GPUs.
