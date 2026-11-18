# Recon: Obsidia doll, gramophone, Tetra, Guinevere drones, normal drone

Read-only recon (18 Nov 2026). Everything below was measured with three r186 `FBXLoader`/`GLTFLoader` in real Chrome and Blender 4.5 headless, plus renders that were opened and looked at. Scratch tools and prototypes: `C:\Users\muham\AppData\Local\Temp\claude\ebb19c894ab4059a\fd0c2cef-a780-4648-9a84-d597a6e52568\scratchpad\recon\assets-doll-gramophone-tetra\` (called SCRATCH below). `SCRATCH\tool\render.js` + `run_render.cjs` is a reusable FBX/GLB renderer with a world-axis pose helper (`poseWorld`), a gramophone re-pivot (`gramoBuild`), and the face prototype (`faceProto`). `SCRATCH\shots\` has every picture named here.

No em-dashes or en-dashes anywhere. Units: the doll FBX and the gramophone FBX are in CENTIMETRES (three does not apply the FBX unit scale; multiply by 0.01).

---

## 0. Summary of the surprises (read these first)

1. **The doll has NO boxing gloves.** The hands are bare mitten stubs (a palm blob with a thumb nub, no fingers). The legs end in rounded stumps (no foot shape, ToeBase has 12 vertices). Do not plan on glove geometry; build gloves as props parented to `LeftHand`/`RightHand` if the owner wants them.
2. **Head plus hair is 82 percent of the doll's vertices and about 59 percent of its height**, all welded into ONE manifold (1 connected component) with the body, bound almost 100 percent to the `Head` bone. The arms are tiny (shoulder to fingertip about 52 cm of a 170 cm doll). **Any arm pose above the shoulder line puts the hand inside the hair mass and the hand vanishes** (verified, section 1.4). Fists-up, hanging by an arm, hands overhead all need forward arms, a body roll, or bone stretch.
3. **The doll's face is paint on a fragmented Meshy UV atlas** (4096 square, hundreds of small charts). Morph targets cannot close or reshape the eyes. Best path (prototyped: eyes and mouths work, mask and normals need the cleanup listed in 1.5): face decal drawn inside the doll's own material from a UV-space face mask plus head-bind-space planar coordinates (section 1.5).
4. **The gramophone FBX has every mesh at identity transform, pivot at the scene origin, rotated 56.68 degrees about Y in the file, and no texture links.** It needs aligning, re-pivoting and manual texture assignment. Parts are separate and sensible (crank, platter, record, soundbox, needle, horn). A default record with a "Gold Star" label is a separate mesh (`disk`), and it is faceted (about 20 sides).
5. **There is no Mixamo clip library beyond four clips** on disk (`D:\ren\aspirant\3d\viewer\animations\`: Walking, Hip Hop Dancing, Rumba Dancing, Silly Dancing). Sit, wave, read, run, pant, cast, fall, hang must all be authored procedurally as bone turns (the existing `features/about/tetra/performance.ts` pattern), for Tetra and for the doll.
6. **Guinevere's two drones are already a complete shader-face system** (`features/about/companions/face.ts`, a symmetric parametric `FaceShape` with 12 named faces, 11 comic marks in `companions/fx.ts`). Their gloves are free-floating rigid parts, so carrying a logo plane is just placing the two gloves at its edges. The normal drone has no hands (wings only) and its face atlas uses all 9 cells.

---

## 1. OBSIDIA DOLL

Folder: `D:\ren\aspirant\3d\obsidia\Meshy_AI_chibi_boxer_doll_rigged_20261117_animated_mixamo_Walking\` (prefix `P` = `Meshy_AI_chibi_boxer_doll_rigged_20261117_`)

| File                            | Bytes      | Content                                                           |
| ------------------------------- | ---------- | ----------------------------------------------------------------- |
| `P animated_mixamo_Walking.fbx` | 29,981,852 | Mesh + 24 bones + 1 clip (Mixamo Walking), textures embedded      |
| `P character_meshyrig.fbx`      | 29,795,516 | Same mesh + same 24 bones, bind pose only, 1 frame clip (0.033 s) |
| `P animated_mixamo_Walking.png` | 11,624,560 | Base colour 4096x4096 RGBA                                        |
| `..._normal.png`                | 14,984,078 | Normal 4096x4096 RGBA (OpenGL, blue 252 mean)                     |
| `..._roughness.png`             | 2,431,646  | 4096x4096 L, range 0..178, mean 118                               |
| `..._metallic.png`              | 1,741,051  | 4096x4096 L, range 0..165, mean 5.6 (almost all dielectric)       |

### 1.1 Mesh

- One `SkinnedMesh` `char1`, material `BakedMaterial` (single material, single UV set `UVMap`). **14,385 triangles**, 43,155 raw (unindexed) corners, **7,186 unique positions, 10,948 unique (position,uv) vertices** (Blender reports 15,944 with normal splits). Attributes in three: position, normal, uv, skinIndex, skinWeight. No morph targets, no vertex colours, no second UV.
- Rig FBX bounds (cm, Y up, **front is +Z**, feet at y=0): x -80.4..80.4, y 0..170.0, z -58.5..58.5. The 160 cm width is hair flare plus A-pose arms; the 117 cm depth is long back hair plus front bangs. So the doll is **1.70 m tall in file units**; scale 0.00176 for a 0.30 m doll.
- The whole figure (face, torso, legs and the skeleton) is centred at **x about +3.7 cm**, while the hair's bounding box is symmetric about x=0 (Hips x=3.59, the leg bones mirror about x=3.6, `Head` x=3.89, face centre about 3.5). So the doll is slightly lopsided inside its hair: recentre the root by -3.7 cm in the build. Left and right bone heads are NOT mirrored about x=0, so never mirror a pose by negating X; use per-side values (`LeftArm`/`RightArm` rotate about Z with opposite sign).
- Skeleton bind pose is an A-pose (arms about 35 degrees below horizontal, shoulder (18.4,57.6) to elbow (31.4,48.3)).
- Rendered look (`SCRATCH\shots\doll_front.png`, `doll_34.png`, `doll_head.png`, `doll_back.png`): chibi girl, pink hair with cream/blonde streaks reaching the thighs at the back and sides, a gold tiara with two red gems, a gold-and-pink sparkle clip at the left of her forehead, an ahoge, **heterochromia: red iris on screen-left, blue iris on screen-right**, thick black lashes with small spike pieces at the outer corners, black angry brows, a tiny frown mouth. Body: navy leotard with a gold-pink diamond emblem, white collar, one pale-pink thigh-high leg and one dark thigh-high sock (asymmetric on purpose), bare mitten hands.

### 1.2 Skeleton (24 bones, NOT `mixamorig*`-prefixed)

Bind world positions in cm (Y up). **Local bone frames are NOT the model frame** (checked from the rest quaternions in `SCRATCH\doll_rig_dump.json`): `Hips` carries a +88 degree X turn under the -90 degree `Armature` group, and the spine chain, `neck`, `Head` are near identity under it (so for the trunk, local X = doll's left, Y = up, Z = forward). The limb bones are Blender-style frames with **local Y along the bone** and arbitrary X/Z: e.g. `LeftShoulder` local Y = (0.97,0.02,-0.24) in the spine frame (points sideways), `LeftArm` rest quat (-0.108,0.630,-0.338,0.690), `LeftUpLeg` local Y = (0.36,-0.91,0.19), `LeftForeArm`/`LeftHand` about 10 degrees off their parent. So never author limb poses as local Eulers. **The only safe way is a world-axis delta: `q_local = inv(pBind) * R * pBind * restLocal`, where `pBind` is the parent's bind world quaternion and `R` is a rotation about MODEL axes (+X doll's left, +Y up, +Z forward)**; that is what `poseWorld` in `SCRATCH	ool
ender.js` does and every pose below was authored with it. Port that helper to the page (`features/home/doll/pose.ts`) and key poses in model axes.

```
Hips (3.59,39.6,19.9)
  Spine02 (3.64,45.0,19.6)           = Mixamo Spine   (NOTE: numbering is reversed)
    Spine01 (3.69,50.4,19.4)         = Mixamo Spine1
      Spine (3.74,55.9,19.1)         = Mixamo Spine2
        neck (3.80,61.5,18.8)        = Neck
          Head (3.89,69.1,18.4)      = Head
            head_end (5.76,128.6,21.6)   leaf, = HeadTop_End, CARRIES WEIGHT on 5,475 verts (max 0.30)
            headfront (3.89,69.1,44.4)   leaf socket for the face, 55 verts, max 0.14
        LeftShoulder (6.7,57.6,19.0) > LeftArm (18.4,57.6,16.2) > LeftForeArm (31.4,48.3,18.6) > LeftHand (43.0,41.5,19.5)
        RightShoulder (0.7,57.6,19.0) > RightArm (-11.8,57.6,15.5) > RightForeArm (-24.9,48.3,18.7) > RightHand (-36.4,41.5,19.6)
    LeftUpLeg (12.0,35.7,19.9) > LeftLeg (18.1,19.8,24.1) > LeftFoot (18.1,6.1,19.4) > LeftToeBase (18.1,1.8,22.4)
    RightUpLeg (-5.1,35.7,19.9) > RightLeg (-11.6,19.8,24.1) > RightFoot (-11.5,6.1,19.4) > RightToeBase (-11.0,1.8,22.4)
```

- Mixamo name map (1:1, for any retargeting): Hips->Hips, Spine02->Spine, Spine01->Spine1, Spine->Spine2, neck->Neck, Head->Head, head_end->HeadTop_End, Left/RightShoulder, Arm, ForeArm, Hand, UpLeg, Leg, Foot, ToeBase unchanged.
- **No fingers, no eye bones, no jaw, no face bones, no toe-end bones, no spring bones, no IK targets.** Hands and arms: `LeftHand`/`RightHand` have the same length as the forearm (13.4 cm) and carry 173 and 162 primary vertices (the whole mitten).
- Bone lengths: upper arm 16.2, forearm 13.4, hand 13.4 (shoulder to fingertip about 52 incl. shoulder bone), thigh 17.5, shin 14.5, foot 5.2.

### 1.3 Weights (checked over all 7,186 unique vertices)

- Every vertex sums to 1.0 (0.9999..1.0001), at most 4 influences (hist: 4 inf 4,125, 3 inf 1,374, 2 inf 1,588, 1 inf 99). Sane and clean.
- Primary bone counts: **Head 5,889**, RightUpLeg 244, LeftUpLeg 235, LeftHand 173, RightHand 162, LeftShoulder 94, RightShoulder 92, LeftLeg 80, RightLeg 73, LeftArm 43, RightArm 41, Spine02 17, Spine01 14, toes 12, forearms 15, Hips/Spine/neck/feet about 0. The torso is only a few hundred vertices, mostly blended between Hips, Spine02, Spine01, UpLegs and Shoulders.
- Hair locks that hang below the neck joint: 1,213 vertices, mean Head weight 0.947 (min 0.31). Shoulder/arm bones carry the rest (467 verts have a LeftShoulder weight over 0.05). So the hair is effectively rigid with the head and slightly dragged by shoulders: **a head turn moves the whole hair as one piece (no tearing), a raised arm drags the nearby hair locks a little**. Static hair is fine as the owner said.
- `head_end` and `headfront` are leaf bones that never animate: in the build, **fold their weights into `Head`** (and drop both bones) to lose one influence slot per vertex.

### 1.4 Pose tests (done on the bind-pose rig FBX with a world-axis delta helper; images `SCRATCH\shots\pose_sheet1..4.png`, `shots\poses*\`)

Delta rotations in MODEL axes (+X doll's left, +Y up, +Z forward), applied in the parent's bind frame: `q_local = inv(pBind) * R * pBind * restLocal`. Positive rotation about +X on a limb that hangs down swings it BACKWARD (so knee bend and forearm-up use signs as below).

| Pose                                   | Deltas (degrees)                                                                                                  | Result                                                                                                                                                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Astride (riding a dragon head)         | UpLeg L [-60,0,+45], R [-60,0,-45]; Leg both [+55,0,0]; Spine02 -8, Spine -6; hips lowered 12 cm                  | Works. Legs spread, knees bent, no crotch collapse, no pinching (leotard area stays clean). Feet are stumps so the stirrup read is poor but fine at chibi scale.                                                                       |
| Sitting on a frame edge, legs dangling | UpLeg [-90,0,+-6], Leg [+90,0,0]                                                                                  | Works. Shins hang straight down, swing by animating Leg x between 70 and 100.                                                                                                                                                          |
| Run contact                            | UpLeg L [-55], Leg L [+15], UpLeg R [+35], Leg R [+85], Arm L [+40], Arm R [-50], ForeArm both [-90], Spine02 -12 | Works, legs and torso fine. Arms are tiny.                                                                                                                                                                                             |
| Head yaw 45, nod 30, tilt back 30      | Head [0,45,0], [30,0,0], [-30,0,0]                                                                                | Hair follows rigidly, no stretching. Hair tips (y 27..40) sweep about 20 cm sideways and clip into the shoulder at 45 degrees, acceptable.                                                                                             |
| Sit with legs forward                  | UpLeg [-85], Leg [+85]                                                                                            | Works.                                                                                                                                                                                                                                 |
| Forward arms / fists in front          | Arm [-80..-85,0,+-15], ForeArm [-100 or -90] (forearm up)                                                         | **The only visible fist poses**: hands at z over 61 clear the front hair (face front z about 44). Fists read as small shapes at chest height.                                                                                          |
| Arms straight up / fists overhead      | Arm [0,0,+-110..125], ForeArm [0,0,+-50..0]                                                                       | **FAILS: hands disappear inside the hair/head mass** from the front (skeleton overlay in `SCRATCH\shots\pose_sheet3.png` shows the bones end at chin height behind the hair). From the side they are visible but still intersect hair. |
| One-arm hang from a ledge              | Arm [-150,0,10] (up and forward)                                                                                  | Arm points forward/up and clears the face, but looks like a reach, not a hang.                                                                                                                                                         |
| Falling spread-eagle (hips -80)        | arms +-60, legs +-40                                                                                              | Reads as a ball of pink hair with tiny limbs. Hair is 3x the volume of the limbs.                                                                                                                                                      |

Consequences for the owner's scenes:

- **Reach and silhouette:** hair width is up to 160 cm and the limbs are 50 cm. Spread arms and legs wide, keep poses mostly in front of or beside the hair, use camera angles that see the limbs against the sky, exaggerate with squash and stretch.
- **Bone stretch (tested, `SCRATCH\shots\stretch_sheet.png`, arms raised to horizontal, left arm only):** `LeftArm.scale.y = 1.6` stretches the whole arm cleanly (upper arm, forearm and mitten) to about 1.5 to 2 times the reach, no shear, no tearing; the mitten is stretched with it (counter-scale `LeftHand.scale.y = 1/s` to keep it round, not tested). **Do NOT also scale `LeftForeArm`: it compounds (1.6 x 1.6) and the arm leaves the frame.** Scaling `LeftShoulder.y` 1.5 and translating `LeftHand` also lengthen the arm but move the whole limb out as a stick with an unstretched hand; scale `LeftArm` only. This makes the "hang by one hand", "reach" and "held up by the arm" gags possible. Also usable: body roll (Hips z) of 20 to 35 degrees to bring a raised arm outside the head silhouette.
- Riding, sitting on a frame, running, falling, being held and swallowed, screaming with fists forward are all feasible with the 24-bone skeleton. Fingers/wrist-flaps are not.
- The Walking clip is in-place (see 1.6).

### 1.5 The face: where it is, and the way to "tons of expressions"

Measured:

- The face skin, eyes, lashes and brows are **painted in the base colour atlas** with relief in the normal map. The 4096 atlas is a Meshy chart soup: hundreds of tiny islands of random size and rotation (`SCRATCH\shots\tex_base_1024.png`, `tex_normal_1024.png`). Rasterising the face triangles into UV space gives **183 separate islands, about 3 to 4 percent of the atlas area** (`SCRATCH\shots\face_uv_mask2.png`). Editing or replacing the face in the texture is not realistic; no morph can reshape painted eyes.
- **Face coordinates, measured on an orthographic front render with a known scale** (0.1125 cm per pixel, grid overlay `SCRATCH\shots\doll_ortho_grid.png`, no parallax, +-1 cm), bind space cm, Y up: **red iris centre (-14.5, 88.4), blue iris centre (23.75, 91.2)** (the doll's head is tilted slightly, the blue eye is 3 cm higher), iris diameter about 15.7 cm, **mouth centre (4.1, 75.7)**, width about 8 cm, brows about y 100 to 101, face centre x about 4.5, outer eye corners x -30 and +40, chin bottom about y 70, collar starts about y 66. Face front surface z about 40 to 44 at the nose (`headfront` bone at (3.9,69.1,44.4)). (My first estimates from perspective views were 4 to 13 cm low; do not use perspective screenshots to place the face.)
- The hair (bangs crossing the face) shares the same shell, so a "select by box" is wrong (it takes the bangs). A **depth-layer selection works**: per 1 cm cell, take the minimum front-facing z (the skull), keep triangles within 1.0 cm of that smoothed surface (`SCRATCH\face_sel2.py`, result `SCRATCH\face_sel2.json`: 783 of 14,385 triangles, `shots\doll_sel2_front.png`). It is ragged at hair roots and misses small lash geometry, so the final selection needs a hand pass in Blender (select polygons, export their indices to `scripts/home/models/doll/face-tris.json` like the repo's `curation/*.json`) and a 4 px feather on the mask.

Options compared:

| Option                                                                                                                     | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real morph targets in Blender                                                                                              | Rejected. Eyes, brows and mouth are texture paint; geometry has no eyelids. Only mouth/cheek volume could move, and it would not change the picture.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Skinned patch mesh over the face (duplicate face polygons, offset 0.5 mm, skin 100 percent to Head, SDF shader)            | Works and is simple to reason about. Costs: one more draw call and mesh, z-fight offsets at the hair roots, patch edges must be hand-picked anyway.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **In-material face decal (CHOSEN): UV face mask + bind-space planar coordinates, drawn in the doll's own fragment shader** | **Prototyped: it works for eyes and mouths, with open items** (SCRATCH shots face_sheet2.png: `> <` with open mouth, `^ ^` with smile, heart eyes with grin, `X X` with wavy mouth, plus 3/4 views where the heart eye is correctly hidden behind a hair strand and the old painted frown is fully covered; the cleanup list is in the next section). No extra mesh, no z-fight, hair occludes the face exactly because hair triangles are outside the mask, and it follows the head bone because `vBind = position` (the bind-pose position attribute, not the skinned one) is rigid in head space. |

How the decal works (prototype in `SCRATCH\tool\render.js`, function `faceProto`, about 80 lines of GLSL):

- Vertex: `varying vec3 vBind; ... vBind = position;` after `#include <begin_vertex>`.
- Fragment, after `#include <map_fragment>`: `float m = texture2D(uMask, vMapUv).r; vec2 f = (vBind.xy - faceCentre) / faceScale;` draw skin, brows, eyes, mouth with SDF primitives (box, segment, arc, heart, spiral from `companions/face.ts` can be copied: `cBox`, `cSeg`, `cArc`, `cHeart`, `cSpiral`, `cEye`, `cMouthShape`, `cInk`), then `diffuseColor.rgb = mix(diffuseColor.rgb, drawn, m)`.
- **Issues the prototype exposed (all must be fixed in the real build):** (a) the baked relief of the old eyelids and lashes stays in the normal map and the glossy lash highlights stay in roughness: **flatten the normal map to (0.5,0.5,1) and set roughness/metallic to the skin values where the mask is on, in the build (bake it)**; (b) **the FBX vertex normals are flat/faceted** (normals are per triangle, the smoothness of the original comes from the normal map): when the relief is flattened the face shows low-poly facets (visible in `face_sheet2.png`). The build must **recompute smooth vertex normals after welding by position** (`computeVertexNormals` on the welded mesh, hard edges only at the tiara and leotard seams); (c) **the first prototype missed the mouth and left the painted frown because the coordinates were wrong (mouth drawn at y 62, below the chin); fixed by the ortho measurement above, the mouth now covers the frown**; (d) **the mask still misses the black lash corner spikes, the brow strokes and a few small face triangles at hair roots**, which remain visible as dark pieces at the outer eye corners: the hand-picked polygon list must include them and the mask must be dilated 5 px; (e) paint the mask region of the BASE texture with a clean skin colour in the build, so the neutral face is all SDF; the sampled skin base colour is a flat grey `#c3bcbc` (0.77,0.74,0.74) that only looks white because of the lights: use the lit material and add a soft cheek gradient and pink blush in the shader; (f) feather the mask edge (5 px dilate then 4 px gaussian on the 1024 mask) and use its value as the mix factor; (g) keep heterochromia: red iris on the doll's right (screen-left) about `#d9262f`, blue on the left (screen-right) about `#5cbcf2`, white highlights, darker limbus ring.
- Needs a `MeshStandardMaterial` (lit) anyway: the PBR look (gloss on hair, leotard) is the doll's character. The site's other models are unlit; the doll should be lit with a small rig (hemisphere + one key + a PMREM `RoomEnvironment`) like `SCRATCH\tool\render.js applyPBR`.

**Uniform list (about 40 floats, pack in 10 vec4 like `packFace` in `companions/face.ts:201`; blend every float continuously with `blendFace`-style lerps so any face morphs into any face):**

- Samplers/colours: `uFaceMask` (R8, 1024), `uSkin` vec3, `uInk` vec3 (near black purple `#1d0f1d`), `uIrisL` vec3 (red), `uIrisR` vec3 (blue), `uBlush` vec3, `uFaceFrame` vec4 (centre xy, scale, eye spacing).
- Per eye (L = screen-left/doll's right, R = other): `openL/openR` (0 shut to 1 wide), `slantL/slantR` (-1..1 lid slant, + = frown), `lidLowL/lidLowR` (0..1 cheek rise, smile squint), `scaleXL/YL/XR/YR` (0.5..1.6), `pupil` (0.3..1.3), `look` vec2 (-1..1, shared), `highlight` (0..1).
- Eye glyph weights (sum clamped to 1, they blend): `gArc` (^ ^), `gChevron` (> <), `gSpiral`, `gHeart`, `gStar` (sparkle), `gCross` (X X), `gDot` (small dot eyes), `gLine` (flat closed "- -" / sleepy), `gTear` (watery highlight). The neutral state is `iris+lids` (all glyph weights 0).
- Brows: `browYL/browYR` (raise), `browAngL/browAngR` (-1 sad .. +1 angry), `browCurve`, `browThick`. One brow up gives smug, confused, annoyed.
- Mouth: `mW`, `mOpen` (0..1), `mCurve` (-1 frown .. +1 smile), `mTilt`, `mX`, `mY`, and weights `mDash`, `mSmile`, `mFrown`, `mD` (open grin), `mO`, `mScream` (huge open, tongue), `mCat` (w), `mWavy`, `mFang` (two small triangles), `mPout`, `mTongue` (0..1).
- Extras: `blush` (0..1), `tearsL/tearsR` (0..1 streams), `sweat` (drop), `gloom` (vertical forehead lines), `flushTone` (anger red face tint 0..1), `shock` (white face, tiny pupils), `time` (spiral turn), `blinkL`, `blinkR` (squash V about the eye line, same as `cEye` in `companions/face.ts:283`).
- Named presets to ship in `features/home/doll/faces.ts` (like `FACES`): neutral angry (the model's own), blink, wink L/R, smile, big grin D, smug, annoyed (half lids, flat mouth, one brow), > < scream, shocked (tiny pupils, gasp O), crying (tears, wavy), dizzy (spirals), sleepy (flat lines, drool), heart eyes, determined (angry brows, grit teeth), sparkle eyes, X X, sweat-drop worried, laughing (arcs plus D), pout, gloom, smirk, sick. Every preset is a point in the float space, transitions are lerps over 80 to 160 ms and a blink hides a glyph swap.
- Comic cues for emotion (sweat drop, anger vein, hearts, "!", "?", swirl, stars) are DOM/sprite marks, not shader: reuse `features/about/companions/fx.ts` `MarkKind` (11 kinds: bang, ask, spark, heart, lines, drop, puff, swirl, ha, vein, star), Web Animations on transform/opacity only.

Hands as fists in boxing gloves: there are none and the model has no fingers, so keep the mitten hands; they already read as fists. If the owner insists on gloves, parent a red rounded box (about r 6.5 cm, cuff 4 cm) to `LeftHand`/`RightHand` in code.

### 1.6 The Walking clip

`animated_mixamo_Walking.fbx`: clip name `Armature|Armature|Armature|Armature|walking_man|baselayer`, **32 keys at 30 fps = 1.0333 s (frames 1..32)**, loops (first key equals last). three reports `fps 0.97` only if you read the first (constant) track; the real rate comes from the track with the most keys. Tracks: 75 total = 25 targets x (position, quaternion, scale). **Only 22 quaternion tracks and `Hips.position` vary**; every scale track and every other position track is constant, `head_end`, `headfront` and `Armature` quaternions are constant. In-place: `Hips.position` (bone-parent frame, cm) x 2.84..5.33, y -22.59..-20.47, z 40.35..43.38 (3 cm bounce, 2.5 cm sway, no forward travel). The build must keep only the 22 rotation tracks plus the hips position (times 0.01), drop all scale tracks, and write the clip as `walk`. Speed of travel to match feet: not stored, measure the stride or reuse the visual match (about 0.5 m/s at 0.3 m doll).

The walking file's bind is slightly different from the rig file (Hips at y 43.1 vs 39.6, `Hips` rot 87.97 vs 86.99): **export the skeleton and mesh from `character_meshyrig.fbx`** (true bind pose) and take only the clip from the Walking file, matching tracks by bone name.

### 1.7 What to build (doll)

Script: `scripts/home/models/doll/build.cjs` (+ `page/convert.js`, `page/stage.js`, `page/index.html`, `page/main.js`, same layout as `scripts/about/tetra/` which already loads FBX in Chrome with the site's three and writes GLB with `GLTFExporter`) and `scripts/home/models/doll/face-select.py` (numpy+PIL, the depth-layer selection, writes `face-tris.json` and `face-mask.png`; run with `C:\Users\muham\anaconda3\python.exe -I`). Output `apps/web/public/models/home/doll.glb` plus `doll-face.webp`.
Steps:

1. Load `character_meshyrig.fbx`; take geometry; fold `head_end`/`headfront` weights into `Head`; drop them; keep 22 bones.
2. Weld by (position, uv) to about 11k vertices, **recompute smooth vertex normals from the welded positions** (the FBX normals are faceted, see 1.5 b), write indexed with `skinIndex` as u8 and `skinWeight` as normalized u8 or f32.
3. Scale by 0.01 (cm to m) and recentre x by -0.037 m (skeleton and mesh share the same offset so just move the root); keep feet on y=0, front +Z; apply the Armature -90 X so the exported skeleton is Y up with no node rotations (check with the pose helper).
4. Textures: base 2048 WebP q 0.9 (178 to 269 KB), normal 1024 (128 to 195 KB), packed ORM 1024 (R=ao 255, G=roughness, B=metallic, 57 to 84 KB); face region baked flat (normal flat, base skin) in the same pass; face mask 1024 L WebP (about 20 KB). Face coordinate frame written to the root extras (centre, scale, eye spacing, mouth y).
5. One clip `walk` as in 1.6. Stretch/pose clips are NOT in the file, the page authors them.
6. Check pictures (like the about builds): every named face, the 10 test poses above, a head-turn row, a hair-clip row.
   Estimated size: raw `GLTFExporter` about 1.3 MB (1.0 MB geometry with float32 weights and normals, plus 0.45 MB textures at 2048/1024); **with meshopt or quantized attributes (`@gltf-transform/cli` may be installed) about 0.6 MB**. The loading bar item: `PreloadItem` for `doll.glb` (about 0.6 to 1.3 MB) plus the WebGL scene chunk.

---

## 2. GRAMOPHONE

Files: `D:\ren\aspirant\3d\gramophone\source\ponograph.fbx` (484,704 bytes) and `D:\ren\aspirant\3d\gramophone\textures\lobby_MUSIC_{BaseColor,Metallic,Normal,Roughness}.png` (2048x2048; 2.5 MB, 0.37 MB, 4.4 MB, 1.9 MB). FBX material `MUSIC` has NO texture links (three logs "unknown material type"): the build must assign the four maps by hand (base sRGB, normal, metallic L, roughness L; the render recipe is `applyPBR` in `SCRATCH\tool\render.js`).

### 2.1 Structure (22 meshes, 15,802 triangles, no skin, no animation, one material)

```
LOBBY (Group) > PHONOGRAPH (Group, pos x -61.55 cm)
  BOX:   pCube16 (cabinet, 1008 tris), pCube19/27/28/29 (four turned corner columns, 1424 each), pCube22, pCylinder15, pCube21, pCube20 (small brass fittings),
         polySurface1 (black C-bracket/post that holds the elbow, 2184), pCylinder16 (crank hub), pCylinder17 (crank arm, 560), pCylinder18 (crank handle, 600)
  screw: pCube23, pCube24, pCube25 (thin brass plates on the top frame, static)
  DISK:  disk (the record, 160 tris, a faceted polygon), disk_holder (platter with brass rim, 320 tris)
  HORN:  pCylinder21 (bell, 720), pCylinder19 (black elbow tube, 930), pCylinder20 (brass soundbox drum, 720), pointer (needle, 720)
```

**Every node has identity local transform and every group pivot is the scene origin; all geometry is in world coordinates.** Rotating a group in place swings it about the world origin (verified: the first test sent the crank flying). The build must create pivot nodes at the part centres (below) and re-parent.

### 2.2 The aligned frame (use this everywhere)

The model sits rotated by **+56.68 degrees (0.98925 rad) about Y** in the file. Aligned frame: `p_m = 0.01 * ( Ry(0.9892526) * p_fbxworld_cm + (334.8203, -70.3625, -35.4586) )` where `p_fbxworld` includes the `PHONOGRAPH` group's -61.55 cm x offset (three's `matrixWorld`). In the aligned frame: **origin = centre of the cabinet footprint at the floor, Y up, the horn points +X (tilted 19.4 degrees up), the crank is on the -Z face, the tonearm post is on the -X side.** `SCRATCH\gramo_an.py` re-derives this; `SCRATCH\tool\render.js gramoBuild` implements it (stage > aligned > root, pivots as children of `stage`).

Dimensions in metres (aligned frame):

- Whole: x -0.220..+0.221, y 0..0.532, z -0.177..+0.177 (bell is +-0.166). **0.44 wide (along the horn), 0.53 tall, 0.355 deep.**
- Cabinet pCube16: 0.355 x 0.143 x 0.355; outer wall at +-0.148; corner columns at +-0.139, y 0.031..0.131.
- Platter `disk_holder`: radius 0.1415, y 0.141..0.156, centre (0, 0.148, 0). Record `disk`: radius 0.140, y 0.147..0.152 (5 mm thick), centre (0, 0.150, 0); label about 0.09 across. The default label is "Gold Star / Lightnin' Boogie" baked in the atlas (top right, about u 0.79..0.89, v 0.80..0.90 of the picture).
- Bell pCylinder21: centre (0.067, 0.342, 0), axis (0.94, 0.33, 0), x -0.065..0.221, y 0.22..0.532, rim diameter 0.331.
- Elbow pCylinder19: x -0.196..-0.037, y 0.170..0.333, z -0.042..0.036. Post polySurface1: x -0.220..-0.137, y 0.096..0.235, z +-0.025 (static).
- Soundbox pCylinder20: centre (-0.081, 0.176, -0.045), 0.034 x 0.034 x 0.020 (a brass drum on the end of the elbow, axis along the elbow). Needle `pointer`: (-0.0815, 0.152..0.176, -0.0525), 4 mm thick, 24 mm long, tip at y 0.152 = the record surface, at radius 0.097 from the platter centre (so it is already down, in the groove zone; the "lifted" pose is authored).
- Crank: hub pCylinder16 centre (-0.092, 0.104, -0.141), arm pCylinder17 x -0.097..-0.026, handle pCylinder18 centre (-0.032, 0.104, -0.199), z -0.223..-0.185. **Crank axis: Z through (x=-0.092, y=0.104).** Throw radius 0.060 (arm lies along +X at rest). Rotating `{pCylinder17, pCylinder18}` (and the symmetric hub) about that axis turns it correctly (verified: handle sweeps down, up, out in `SCRATCH\shots\gp_tests_sheet.png`).
- **Platter spin axis: Y through (0, 0.148, 0)**, rotate `{disk_holder, disk}` together (verified in place, label turns).
- **Tonearm lift** (soundbox + needle): a roll of `{pCylinder20, pointer}` about the elbow's own axis (about +Z, slightly +X: (0.38,0,0.93)) through (-0.081, 0.193, -0.045), +-30 degrees tilts the drum and moves the needle sideways and up about 1 cm (`SCRATCH\shots\gp_arm_sheet.png`). For a clear lift add +0.01 m on Y. Tune in the build's check pictures; if a larger sweep across the record is wanted swing `{pCylinder19, pCylinder20, pointer}` and ALSO the bell about the vertical axis of the post (the bell is welded to the elbow in the file), which would swing the horn, so prefer the roll.
- Horn "faces left": **presentation yaw about 220 degrees about Y (3.84 rad)** in the aligned frame (range 205 to 235) matches the owner's screenshot `Screenshot 2026-11-18 082029.png` (bell at the upper left facing the camera's left, plaque face on the left, crank on the right face, platter and label visible). See `SCRATCH\shots\gp_yaw_sheet.png` (yaw 100..250; 220 is the match). Because the horn is +X, a yaw of 180 puts it exactly screen-left.
- Scale vs drones: the gramophone (0.53 tall) is 2.1x a companion's total height (0.248) and 3.7x its ball diameter (0.145). Suggest a uniform 0.65 to 0.8 scale so the drones (ball radius 0.0722) can plausibly pull it, with crank throw 0.04 to 0.05 m (glove about 0.08 m wide).

### 2.3 What to build (gramophone)

Script: `scripts/home/models/gramophone/build.cjs` (+ `page/convert.js`) from the FBX plus textures to `apps/web/public/models/home/gramophone.glb`:

1. Load, compute `matrixWorld` per mesh, transform to the aligned frame in metres (above), write each mesh with its vertices already in aligned coordinates.
2. Nodes (names the page looks for): `gramophone` (root, yaw 0 = horn +X) > `cabinet` (merge pCube16, 19, 22, 27, 28, 29, polySurface1, pCylinder15, pCube20, pCube21, screw plates: one mesh, about 9.5k tris), `horn` (pCylinder21 + pCylinder19, static), `crank` (pivot at (-0.092,0.104,-0.141), children pCylinder16/17/18), `platter` (pivot (0,0.148,0): `disk_holder` only), `soundbox` (pivot (-0.081,0.193,-0.045): pCylinder20 + pointer). **Do not export `disk`** (the default record): the page draws generated records. Keep its UV region on the atlas untouched.
3. Material: `MeshStandardMaterial` with base (2048 WebP q 85 to 90: 210 to 344 KB), normal (1024: 127 to 199 KB, 2048 is 576 to 846 KB, not worth it), ORM (1024: 122 to 199 KB). The PBR gold needs an environment: lit with `RoomEnvironment` PMREM or the site's own; **an unlit bake loses the brass**. The site's models are unlit by design, so this is a deliberate exception (flag in the spec).
4. Check pictures: 8 views, crank at 0/90/180/270, platter at 0/90, soundbox lifted, record on/off.
   Estimated size: geometry 15.8k tris about 0.4 MB raw (0.12 MB with meshopt). **GLB about 1.1 MB raw (2048/1024/1024 textures at q 0.9), about 0.6 MB with quantization and q 0.85.**

### 2.4 Records and crate (generated in code, no model)

- **Record:** `CylinderGeometry(0.14, 0.14, 0.004, 96)` (a round one, the file's is faceted), centre hole 0.004 radius, black vinyl `MeshStandardMaterial` (roughness 0.35, clearcoat 0.6 if `MeshPhysicalMaterial` is affordable) with a **normal map made on a canvas at 1024: concentric thin rings (0.0015 m pitch), three wider gaps between tracks, a dead wax ring**; an anisotropic-looking highlight (a second soft radial gradient in the roughness map) sells vinyl. **Label:** a separate flat disc radius 0.045 on top (y+0.0021) with the cover art cropped to a circle plus a tiny centre hole and a ring, one texture per track from the same cover art `features/library/music` uses (`libUrl(key)`, loaded as `ImageBitmap`, squared and cropped on a 512 canvas). Sleeve: a 0.3 x 0.3 plane with the cover for the crate, a thin box with a white inner for the pulled-out state.
- **Crate (record box):** about 0.34 wide x 0.16 deep x 0.30 tall open-top wooden box with a slanted front, boxes plus a canvas wood grain tinted to match the gramophone's cabinet (`#5a3b27`..`#8a6040`), rounded edges via `RoundedBoxGeometry` (three addons), a brass plate. Records stand on edge in a row spaced 0.012, fanned out with a fixed `rotation.x` lean, the selected one rises 0.06 m and tilts toward the camera; hover raises by 0.02. The drone hand picks the record by its edge (glove at the record's top rim).
- Record on the platter: y 0.152 + 0.002, spinning with the platter node, label on top; the needle drops on it.
- Notes (comic effect): music notes come out of the bell mouth at (0.22, 0.40, 0) along (0.94, 0.33, 0).

---

## 3. TETRA

Source `D:\ren\aspirant\3d\angela\tetra.fbx` (877,276 bytes) and `tetra.rig.json` (11,361 bytes; springs, colliders, IK, expressions). Shipped `apps/web/public/models/about/tetra.glb` (573,716 bytes, `TETRA_MODEL_BYTES`). Build and README: `scripts/about/tetra/build.cjs`, `scripts/about/tetra/README.md`. Runtime: `apps/web/src/features/about/tetra/` (`performance.ts` 926 lines, `pose.ts`, `tetra-scene.ts` 532 lines, `fx.ts`, `spring.ts`, `scroll-hold.ts`).

- **Source:** one skinned mesh, 4,872 tris, 14,616 corners, 96 bones (Mixamo names `mixamorigX` plus spring bones `hair_*`, `ear_L/R`, `skirt_*`, `eye_L/R`, `eyelid_L/R`, IK targets `ik_hand_L/R`, `ik_foot_L/R`, `pole_*`, `ik_root`, `head_look_target`, sockets **`weapon_L`, `weapon_R`** (children of `mixamorigLeftHand`/`RightHand` at local (-+0.003, 0.014, 0))). 17 morph targets on the source (blink, look, mouth_a/i/u/e/o, smile_mouth, grin, frown_mouth, eyes_wide, eyes_sleepy).
- **Shipped GLB:** 37 bones, 3 skinned meshes (body 2,822 tris + hair 1,672 tris (two meshes sharing 3,255 verts), eyes 250 tris with 6 targets `blink_L`, `blink_R`, `squeeze`, `wide`, `look_x`, `look_y`, mouth 120 tris with 8 targets), unlit, textures 512x512 x2 (WebP) plus a 768x256 mouth atlas, clips `walk` (1.367 s, 42 keys, 30 fps), `hiphop` (4.467 s), `rumba` (2.367 s), 18 quaternion tracks + hips position each. 0.649 m tall, feet on y=0, faces +Z, bbox x -0.185..0.2, y 0..0.649, z -0.203..0.123 (ears and hair). Shipped bones: `mixamorigHips`, `Spine`, `Spine1`, `Spine2`, `Neck`, `Head`, `Left/RightShoulder`, `Arm`, `ForeArm`, `Hand`, `HandIndex1`, `HandThumb1`, `Left/RightUpLeg`, `Left/RightLeg`, `ear_L/R`, `hair_back_L_01/02`, `hair_back_R_01/02`, `hair_side_L_01/02`, `hair_side_R_01/02`, `hair_bang_C_01`, `skirt_F_L_01`, `skirt_F_R_01`, `skirt_B_L_01`, `skirt_B_R_01`. **`mixamorigLeftHand` and `mixamorigRightHand` exist** (hand length 0.0854 m, mittens, no skin on fingers past the first joint); **no feet bones** (legs end in a point), no sockets.
- Proportions limit poses: arm shorter than head height, wide sleeves; the page holds arms slightly open during clips. Dimensions: hips 0.184 above floor, upper leg 0.1008, hand bone 0.085.
- **The existing performance already has**: greet, wave, notice, jump, dance (hip hop), sway (rumba), spin, dizzy, meet, reach, follow, laugh, tilt, bounce (`performance.ts` ~line 228 `MoveKind`, cases from line 503). The pose type is `TetraPose` (`pose.ts:17`): position `x,y,z`, `yaw,pitch,roll,squash`, `clip/clipTime/clipWeight`, `Turn {x,y,z}` radians for `hips, spine, head, armL, armR, foreL, foreR, legL, legR`, plus eye and mouth state. Marks (`MarkKind`): bang, spark, heart, note, lines, drop, puff, swirl, ha.
- **For the home scenes the build and page need:** (a) kite flying (arms up, one hand holding a string, leaning back, small steps), (b) **run** (the `walk` clip at 1.8 to 2.4x with a forward `pitch` 0.25 and fast arm swing Turns; no run clip exists, so author a cycle or speed the walk), (c) **panting** (hands on knees: `armL/armR` forward-down with `foreL/R`, `spine.x` forward 0.5, `head` down, breathing as `squash` 0.97 to 1.03 at 2.5 Hz and mouth `mouth_a` open), (d) **wave while exhausted** (`wave` move at low amplitude, `head` tilted, `squash` pulse), (e) **sit** (hips lowered about 0.085 m, `legL/legR` x -1.4, knees: there is no knee Turn in `TetraPose`; add `shinL/shinR` or use the thigh only with the lower leg short; legs are stubs so sitting cross-legged reads fine), (f) **reading a comic** (forearms up in front of the chest, a book held with both hands, head tilted down, eyes `look_y` down, small smile), close book, stand, hop up, (g) **bending/casting** (alternating arm sweeps with `spine.y` twists, `armL.z` raise, quick foot stamps, `squash` pulses, FX trails), (h) look-at-cursor head and eyes already exist (`lookX/lookY`, head Turn).
- **Props to build in code:** (1) **kite**: the owner's picture `D:\ren\aspirant\media\_all\angela\chibi\tetra.png` is RGBA 1667x938 with transparency; the character cut-out box is x 528..1137, y 45..883 (610 x 839 px). Use the cut-out as the kite's sail (a flat plane 0.22 x 0.30 m with the alpha, subdivided 12x16 and waved by a vertex shader) plus a thin spine/bow lines and a ribbon tail of 6 segments; double-sided with the back slightly darker. (2) **String**: a verlet rope (24 points) from the hand socket to the kite with wind, drawn as a thin `TubeGeometry`/`Line2` white-cyan; when Silverbolt passes, cut at the 60 percent point and let both parts fall. A reference art exists at `...\angela\chibi\tetra-holding-string.png` (Tetra reaching with a cyan string in her glove, 435x629). (3) **Comic book**: two covers and 8 pages as thin boxes, covers from the collection's comic art (`libUrl`), page-turn by rotating a page about the spine; size 0.14 x 0.2 m. (4) Dust puffs, sweat drops and swirls from `fx.ts` marks.
- **Sockets:** add `socket_hand_L` and `socket_hand_R` empty nodes at hand-local (0,0.014,0) (or `weapon_*` back) in `scripts/about/tetra/page/convert.js` for the kite string and the book. Changing the shipped `tetra.glb` also changes `/about` phase 2 (the file is shared, the byte count is `TETRA_MODEL_BYTES`, and the cache name in `lib/media-store.ts` must be bumped). Safer: **write the extra nodes at runtime** (`hand.add(new Object3D())`) and leave the GLB alone.
- Extra clip on disk: `D:\ren\aspirant\3d\viewer\animations\Silly Dancing.fbx` (572,912 bytes), not shipped. The Mixamo hips scale is 0.001769 (cm to metres for Tetra), `hipsHeight` 0.1844.

---

## 4. GUINEVERE'S DRONES (companions) AND THE NORMAL DRONE

### 4.1 Companions (the pair for the loading hand-over, the voicelines, music and comedy sections)

Source `D:\ren\aspirant\3d\guinevere\` `drone1.fbx` (348,700), `drone2.fbx` (348,156), `guinevere.fbx` (8,027,372, the character, not needed), each with `*.rig.json`. Shipped `apps/web/public/models/about/companion.glb` (241,420 bytes): six rigid parts, no skin, no bones, one 512x512 picture (WebP lossless), 1,530 + 126 + 320 + 320 + 590 + 590 tris. `COMPANION_MODEL`, `COMPANION_MODEL_BYTES`, `BALL_RADIUS = 0.07225` in `features/about/companions/model.ts`.

- Node tree: `companion` > `body` (the ball, 0.228 x 0.248 incl. ears) > `face` (the screen patch, 88 verts, x +-0.0605, y -0.028..0.046, z 0.029..0.070), `ear_L`, `ear_R` (pivots at the yellow brackets, pos (+-0.0474, 0.067, -0.0078), exact mirrors); `glove_L`, `glove_R` are children of `companion`, NOT of `body` (so the ball can roll like a wheel): rest pos (+-0.1337, -0.0361, 0.0217), bbox about 0.079 x 0.089 x 0.099. **The two source files are the same model**, drone2 turned about 17 degrees.
- Whole bbox 0.346 x 0.248 x 0.142 m. Ball radius 0.07225.
- **Hands:** the "poms" are boxing gloves floating beside the ball, free to place anywhere in radii of the ball (`GlovePose` in `companions/pose.ts`: x,y,z in radii, rx, ry, rz, size). So **carrying a flat logo is straightforward: hang the logo plane between the two drones, put each glove on the near edge, drive the glove positions by the logo's corner and add a strain shake**. Gloves do not articulate and can pull with a pinch-less grip: show the logo's edge passing behind the glove (draw order) or add a small clamp bracket mesh.
- **Face** (no atlas): drawn by the screen shader from `FaceShape` (`face.ts:13`), uniforms packed by `packFace` (`:201`), shader chunks `FACE_FRAGMENT_HEAD`/`FACE_FRAGMENT_MAP` (`:236`, `:370`, functions `cEye` at `:283`, `cMouthShape` at `:314`, `cFace` at `:348`). Gold on dark glass `#ffd53e`, red `#ff4a55`, pink `#ff8fa6`. **Named faces (`FACES`, `:76`):** `bold` (drone 1's own, slanted eyes crooked dash), `soft` (drone 2's, tall round eyes cat mouth), `bars`, `happy` (arches open mouth blush), `glad`, `angry` (big slanted, no mouth), `wide` (round, small o = **shocked/alert**), `dizzy` (spirals crooked dash = **confused/dazed**), `love` (hearts open mouth red = **thanks/adoring**), `squeeze` (> < open mouth = **squint/strain**), `flat` (half-lid flat dash = **unimpressed/sleepy**), `shy` (outer ends down o blush = **worried/concerned**). Independent `blinkL/blinkR`, `lookX/lookY`, `on`, `spin` in `FaceLive`.
- **Gap:** `FaceShape` is symmetric (one lid, one slant for both eyes). For "genuine confusion" (one brow up, eyes of unequal size) and "annoyed" add per-side fields (`lidL/lidR`, `slantL/slantR`, `scaleL/R`, brow ticks, a wavy mouth weight, sweat) and two uniform vec4s; the shader stays sharp at any size. No texture edit needed, **the atlas does not matter for this pair**.
- Comic marks (`features/about/companions/fx.ts`, `MarkKind`): `bang` (!), `ask` (?), `spark`, `heart`, `lines`, `drop` (sweat), `puff`, `swirl`, `ha`, `vein`, `star`; tones ink/pink/gold/cyan; each played once by a Web Animation of transform and opacity. Enough for confusion (`ask`, `drop`, `swirl`), shock (`bang`, `lines`), thanks (`heart`, `spark`).
- Existing runtime `companions-scene.ts`, `performance.ts` (2D CSS-pixel stage with `CompanionPose.x,y,z,radius`). The home page needs its own 3D placement but can reuse `face.ts`, `fx.ts`, `model.ts` and the ear/glove rotation conventions: ears `splay` -15..85, `fold` -35..35, `twist` -40..40; glove "anything"; ball spin about its Z.

### 4.2 Normal drone (the one that follows the page and morphs into `/about`)

Shipped `apps/web/public/models/about/drone.glb` 250,192 bytes (source `D:\ren\aspirant\3d\angela\drone.fbx`, 306,284 bytes, `drone.rig.json`). Doc: `scripts/about/drone/README.md`. Constants `BODY_METRES = 0.62` and `STILL` (1440x740, 0.98334 m across) in `features/about/drone/model.ts:11,18`. Scene `features/about/drone/drone-scene.ts` (face cells `CELL` at line 90, face shader at 332 to 354, `CYAN = 0x23d0d8` ink line colour). **Keep this model as it is**: it is shared with `/about`, and the hand-over from the home footer to `/about` needs the identical drone.

- 10 bones: `drone_root`, `body`, `wing_L/R`, `fin_L/R`, `antenna_L_01/02`, `antenna_R_01/02`; 2 skinned meshes (body 1,752 tris, screen 320 tris, 2,251 verts shared), no morph targets, no animation. Box 0.4405 x 0.4475 x 0.5427 m (wings folded), Y up, **front is +Z**, origin at the middle. Unlit (`KHR_materials_unlit`), `toneMapped=false`, `flipY=false`.
- **No hands.** Only wings (`wing_L/R`: raise `x` -60..75, spread `z` 0..90, twist `y` 0..90, opposite signs for `y` and `z` on the two sides). A wing tip can pinch or hold a light object (the logo's edge) but cannot grip. Thank-you gestures: wing flap, tilt, a small bow (body x), a happy face, hearts as marks.
- **Face atlas** (`drone_face`, 512x512 lossless WebP, cell 170.67 px, dark `#0a121a` ground, cyan `#38d0d4` glyphs), 3 x 3 cells, picked by `uCell` in the shader (`vec2 cell = floor(fuv * 3.0 ...)`, `texture2D(map, cell + (uCell + local) / 3.0)`), blink by squashing V about 0.585 of the cell, look by sliding up to 0.10. **The picture in the GLB is stored upside-down relative to the README's table** (flipY false): file row 0 (top of the PNG) is `ecg, sleepy, alert`, row 1 is `happy, dead, scan`, row 2 (bottom of the PNG) is `angry, normal, squint`. In `CELL` (cells from the plain one, as UV offset of `(du, dv)` over 3) the table is:

| `CELL` key | (du, dv) | Shows                                           |
| ---------- | -------- | ----------------------------------------------- |
| normal     | (0, 0)   | two tall ovals                                  |
| angry      | (-1, 0)  | slanted teardrops                               |
| squint     | (1, 0)   | `> <`                                           |
| happy      | (-1, -1) | `^ ^` (stored as cups)                          |
| dead       | (0, -1)  | `X X`                                           |
| scan       | (1, -1)  | a small waveform and a line (not an expression) |
| ecg        | (-1, -2) | heartbeat trace                                 |
| sleepy     | (0, -2)  | flat thin hollow ovals                          |
| alert      | (1, -2)  | two tall sharp blades (**shocked/alert**)       |

- Available for the owner's list: shocked/alert **yes (`alert`)**, happy **yes**, angry **yes**, sleepy **yes**, squint **yes**, thanks (use `happy` plus heart marks, nothing exact), **confused no**, `!` `?` hearts sweat **no** (comic sprites, not atlas).
- **Adding faces without touching `drone.glb`:** all 9 cells are used, the cell is 170 px, the glyph style is flat cyan strokes (width about 12 px at 512). Recommendation: **do not edit the shipped atlas** (shared with `/about`). Instead make a second picture `apps/web/public/img/home/drone-faces-2.webp` (1024x1024, 3x3 cells of 341 px, same dark ground and cyan, drawn by `scripts/home/drone/faces.py` with PIL: `confused` (one big oval + one small + a squiggle), `thanks` (two arcs `^ ^` with blush hearts), `sparkle` (star eyes), `cry` (arcs plus streaming drops), `worry` (oblique brows), `smug` (half-lid arcs), `dizzy` (spirals), `heart` (heart eyes), `...`). Add a `uCell2`/`uAtlas2` sampler and uniform blend to the shader in `drone-scene.ts:336` (about 8 lines). A shader-drawn face (the `companions/face.ts` approach in cyan on the same dark glass) is the alternative and gives continuous blends and asymmetry; the atlas approach keeps the exact art. Comic marks from `companions/fx.ts` cover `!`, `?`, sweat, hearts, sparkles.
- Edit path if the atlas must really change: `scripts/about/drone/build.cjs` + `page/convert.js` re-encode the FBX picture (lossless WebP); a new atlas needs the screen's UVs rescaled (face UVs show u 0.338..0.666, v 0.663..0.989 as cell "normal") and a bump of the cache name in `lib/media-store.ts`. Not recommended.

---

## 5. BUILD PLAN SUMMARY (files, sizes)

All builders follow `scripts/about/tetra/build.cjs` (small local server, real Chrome via Playwright `channel:'chrome'`, site's three from `apps/web`, FBX in, GLB out, GLB loaded back and checked, check pictures into `--renders`). Python helpers use `C:\Users\muham\anaconda3\python.exe -I` (PIL 11.1, numpy 2.1). Never edit outputs by hand. Each script gets a README.

| Script                                                                              | Output                                                            | Notes                                                                                                 | Size estimate (raw / optimized)                            |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `scripts/home/models/doll/build.cjs` + `face-select.py` + `curation/face-tris.json` | `apps/web/public/models/home/doll.glb`, `doll-face.webp`          | merge `head_end`/`headfront`, weld, scale 0.01, textures 2048/1024/1024 + flat-face bake, clip `walk` | 1.3 MB / 0.6 MB                                            |
| `scripts/home/models/gramophone/build.cjs`                                          | `apps/web/public/models/home/gramophone.glb`                      | align, re-pivot, drop `disk`, merge cabinet, PBR textures                                             | 1.1 MB / 0.6 MB (2048 base) or 0.8 MB / 0.4 MB (1024 base) |
| `scripts/home/drone/faces.py`                                                       | `apps/web/public/img/home/drone-faces-2.webp`                     | extra face cells for the normal drone                                                                 | 30 to 80 KB                                                |
| `scripts/home/kite/build.py`                                                        | `apps/web/public/img/home/kite-tetra.webp`                        | alpha cut-out from `tetra.png`, trimmed to the 610 x 839 box, 2x, rim clean-up                        | about 60 to 120 KB                                         |
| none (code)                                                                         | records, crate, kite string, book, marks                          | built in the page                                                                                     | 0                                                          |
| existing, reused as is                                                              | `drone.glb` 250,192, `companion.glb` 241,420, `tetra.glb` 573,716 | do NOT change (shared with `/about`)                                                                  | 1.07 MB together                                           |

Texture size table measured with PIL (WebP, size in KB at quality 85 / 92):

| Texture                            | 2048      | 1024      |
| ---------------------------------- | --------- | --------- |
| gramophone base                    | 210 / 344 | 77 / 127  |
| gramophone normal                  | 576 / 846 | 127 / 199 |
| gramophone ORM (255, rough, metal) | 422 / 698 | 122 / 199 |
| doll base                          | 178 / 269 | 79 / 113  |
| doll normal                        | 338 / 508 | 128 / 195 |
| doll ORM                           | 134 / 206 | 57 / 84   |

Loading list notes (CLAUDE.md "everything goes in the progress bar"): the doll first appears in the home scenes, so `doll.glb` can be `deferred` with its section; the gramophone is a distant section, `deferred`; the normal drone, the two companions and their scene chunk are waited for in the first screen (the opening sequence needs all three). Add `PreloadItem`s in `apps/web/src/lib/route-preloads.ts`.

---

## 6. RISKS AND WAYS OUT

1. **Face mask and normals** (the prototype's ragged hair-root edge, missing lash/brow rim triangles, faceted normals once relief is flattened). Way out: one Blender pass to pick face polygons (include the lash spikes and brow rim), smooth normals computed in the build, commit the list; feather the mask; verify with `SCRATCH\shots\face_sheet.png`-style check pictures at 3/4 turns (the build must render every named face at 0, 30 and 60 degrees yaw and fail on a visible seam).
2. **Doll limbs hide in hair.** Way out: forward arms, bone stretch 1.3 to 1.6, body roll, camera choice; accept that "fists overhead" is a forward-fists pose; test every scripted pose in the build's check sheet.
3. **Lit doll and gramophone vs the site's unlit style.** Way out: keep a flat 3-point light plus a small PMREM, `toneMapped` per material, no post effects; record it as a deliberate exception in the design doc. Performance: 14k tris with 22 bones and 2048 textures is cheap.
4. **Gramophone orientation/pivots.** Do the alignment in the build, not in the page; the numbers above are verified by renders. The roll-lift of the soundbox is approximate and must be tuned on a check picture.
5. **No Mixamo sit/run/wave clips.** Way out: procedural bone turns (Tetra's `performance.ts` pattern), the Walking clip sped up for the run, and a table of pose keyframes per scene in `features/home/<scene>/poses.ts`.
6. **Changing shared GLBs** (`tetra.glb`, `drone.glb`) breaks `/about` and needs a cache-name bump. Way out: runtime additions only; extra faces as a second atlas.
7. **Doll scale and units** (170 cm file units, figure 3.7 cm off the hair's centre): normalize in the build (metres, recentre) and write the face frame into the root extras.
8. **Three WebGL contexts on `/about`** is a site rule; the home page has many scenes (drone, doll, Silverbolt, Selena hand, Tetra). Use one shared renderer where possible, or mount and dispose scene canvases per section (the about page's `companions/` canvas is released when far).
