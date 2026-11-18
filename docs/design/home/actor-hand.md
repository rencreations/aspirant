# Home actor: Selena's hand (workstream HD)

Selena's left hand, the black clawed glove with the gold and violet bracer, seen from the visitor's own elbow with the palm turned up. It rises from the bottom edge, has an idle breath, answers the pointer with its fingers, wiggles when touched, closes when pressed, carries the doll on its palm and sinks away. Code: `apps/web/src/features/home/actors/hand/`. Model: `public/models/home/hand.glb` (273,096 bytes, made by `scripts/home/models/`, notes in `models-selena-silverbolt.md`). Request: "Hand section (oryzo 'Powered by AI')" in the owner's request; design call 6 (the hand is Selena's black glove, `hand.jpg` is the pose reference only).

## The API a section uses

```ts
import { ensureHand } from "../../actors/hand";          // in mount(): const hand = await ensureHand(ctx)
import { handItems } from "../../actors/hand/preload";   // in preload(): ...handItems()  (deferred, priority 40; pass { deferred: false } if on the first screen)

// every frame the section shows the hand (a section sets the whole state; the kernel hides what is not set)
hand.visible = true;
hand.place({ x, y, z?, height?, scale?, roll?, yaw?, pitch? }); // the WRIST on the screen, stage pixels; height = wrist to highest claw on screen
hand.rise(t);              // 0 below the bottom edge, flat hand  ->  1 arrived, palm open (scrub with the scroll)
hand.sink(t);              // 0 at rest  ->  1 gone below the bottom edge (the way down is the way up in reverse)
hand.setReactivity(v);     // 0..1, oryzo's fingersActive: ramp it up once the doll has settled (default 1)
hand.setBurden(v);         // 0..1, something sits in the palm: reach 15 percent lighter, the grip is only a cup
hand.setGrip(v);           // 0..1, close by hand (a scripted beat). A press does this by itself.
hand.setInteractive(on);   // hover, press and the pointer's reach answer only while on (default on)
hand.curlTowards(x, y);    // fingers reach toward a stage point instead of the pointer; curlTowards(null) = the pointer again
hand.wiggle("middle");     // a ripple along the fingers from a finger (name or 0..4)
hand.impact(1);            // the hand gives under a weight that lands in it: a 15 px dip that settles in 0.6 s, plus a ripple

// reading
hand.palm()                // Object3D on the palm, +Y along the palm normal, +Z toward the wrist; world scale 1 (children work in stage pixels)
hand.socket("stand")       // Object3D at the palm point, upright on the screen (no turn), world scale 1
hand.socket("index")       // a claw tip ("thumb" | "index" | "middle" | "ring" | "pinky"), world scale 1
hand.palmCentre({x,y,s})   // stage pixels and the depth magnification, valid after this frame's update
hand.palmRadius()          // pixels
hand.tipPoint("ring", {x,y})
hand.shown                 // 0..1 how far from hidden (0: nothing on the screen, the pass is not drawn)
hand.pixelsPerMetre; hand.isHovered; hand.stats.updateMs / updateAvg
```

The doll: `doll.attach(hand.socket("stand"), { keepWorld: false }); doll.place({ x: 0, y: 0, z: 0, height: 150 })` stands it upright on the palm and it follows the hand through the breath, the pointer and the sink (looked at, both sockets, `D:\ren\aspirant-work\home\TP\shots\palm.png`). `palm()` is the same point but turned with the palm (the doll leans toward the viewer); use it for a doll that sits or lies in the hand. Register the hand before the doll so its update runs first (the render recomputes the matrices anyway; the order only matters for the doll's own height maths). Hand off the doll with `doll.detach()` (keeps its place on the screen).

`hand.visible = true` plus `place` is all a section needs on the first frame. The hand sets `object.visible` itself from how far it is lifted (nothing below the edge is drawn).

## How it works

**The view.** The notes' elbow camera (`ELBOW`: position `[0, 0.16, 0.26]`, target `[0, 0.05, -0.24]` in the hand's space) is the way the page looks at the hand. The stage's camera sits in the middle of the screen, so a hand low on the screen is seen more steeply from above than one in the middle. `viewRotation` (place.ts) carries the elbow view along the line of sight from the camera to the wrist: the angle between the line of sight and the fingers is the same wherever the wrist is, so the palm always shows the same way (tested). The line of sight depends only on where the wrist is on the screen, not on its depth. The rotation is fixed from the rest place, so a rise and a sink are rigid slides.

**Size.** `fitScale` finds the scale (stage pixels per metre at the wrist's depth) that makes the highest claw `height` pixels above the wrist on the screen, with the perspective of the depth. Measured: asked 500, 400, 450 at three places and depths, got 496.7, 398.3, 446.1 (the 1 percent is the breath's bob). The perspective strength follows from the height (the camera is a fixed 1000 px away): at about 500 px (0.55 of a 900 px screen) the hand looks like the elbow view; taller hands get a closer camera and a longer thumb claw. **Use a height of about 0.55 of the screen's height; use `scale` below 1 and a negative `x` to fit a phone** (390 x 844: `height` 0.6 H, `scale` 0.85, `x` -40 shows the palm and four fingers, the thumb leaves the screen on the left). `z` moves the hand along the camera ray: the wrist stays at the screen point (x, y) whatever z is.

**The pose.** Two baked clips. `palm_up` (1 s, a reach from a flat hand to the open palm) is scrubbed by `rise` (smoothstep 0.08 to 0.92, relaxed by 30 percent while sinking); `breath` (4 s loop of 1 to 2 degrees) takes over from rise 0.8 to 1 (the two agree at the join) and goes at 0.6 of the sink. Both actions are set by `action.time` and `mixer.update(0)`, so a frozen clock holds a frame and a jump is exact. On top of them, per frame: a procedural idle (0.028 rad on every joint, 0.17 to 0.33 Hz, deterministic phases), a wrist sway (0.8 degrees at 0.2 Hz) and a 2.2 px breath bob of the whole hand.

**The mixer trap (found by looking).** `AnimationMixer` writes a bone only when its own result changed since the last frame. A turn added after the mixer therefore piles up from frame to frame (the hand turned 90 degrees in a second). The actor keeps the clip's pose of the 16 bones it turns (15 finger bones and the hand) and puts it back before every `mixer.update`. Any other actor that turns bones after a mixer needs the same.

**The fingers** (fingers.ts, all pure and tested). Each finger has a curl: 0 as the clip holds it, 1 the pointer's reach (the notes' `[0.18, 0.28, 0.20]` rad per joint, scaled index 0.8, middle 1, ring 1.1, pinky 1.25, thumb 0.55 about its own axis), 3 the grip (a cupped claw: `[0.8, 0.95, 0.6]` per joint, never a fist, because the claws are long and a fist would drive them into the palm; the total stays under 175 degrees, tested). The curl follows a target on a spring (1.5 Hz, damping 0.5, oryzo's feel; a grip let go overshoots open by about 15 percent, the flick), with a lag of 30 ms per finger of distance from the nearest one so a sweep ripples. The target:

- **Pointer.** The nearer the pointer to a finger, the more that finger bends toward the palm. "Near" is the distance to the line from the knuckle to the claw tip (a gaussian, sigma 0.45 of the palm to middle tip length), so a pointer on the palm or on the finger asks as much as one at the tip (the first version measured the tip only, and a pointer on the palm, where a visitor goes, asked almost nothing: looked at and fixed). On the palm side of the tip the finger curls, beyond the tip it reaches back (about -0.15). `REACH_GAIN` 2.6 on top of the notes' mapping, because this hand is seen face on and a curl toward the palm only foreshortens; 1 is a 40 degree bend, the pinky bends most. Largest values measured in the sweep (`bank.curl`, at 1440 x 900, 1706 x 950 and 390 x 844 alike): pointer on the palm centre `[1.0, 2.1, 2.5, 2.4, 1.9]` (the hand closes to a claw), below the ring tip `[0, 0.35, 1.25, 2.4, 2.5]` (ring and pinky bend, the others stay), on the index tip `[0, 1.06, 1.09, 0.4, 0.1]`, below the palm `[1.2, 0.5, 0.7, 0.7, 0.55]`, above the tips `[0, -0.05, -0.13, -0.07, -0.02]` (a small reach), far away all 0. A curl of 2.5 is about 110 degrees over the three joints of the middle finger (the formula; not measured from a frame). The thumb closes toward the palm when the pointer is on the palm. The fingers fan (up to 0.14 rad, toward the pointer's side) and the wrist leans (roll 5.7 degrees, nod 4 degrees). Neighbours never close in by more than 0.03 rad (the model's nearest pair is 5 mm apart: `resolveSpread`). The reaction is full within 0.35 of the hand's length from the palm or any tip and gone at 1.0, so a pointer parked in a corner does nothing. A touch drives the hand only while it is down.
- **Hover.** Entering the hand starts a ripple from the nearest finger (1.1 s, a wave that runs along the hand). The cursor label is none; the hand still answers.
- **Press.** A press closes the grip (time constant 60 ms, at most 1.2 s, released by the release) with a 380 px/s dip of the hand; the release opens it with the overshoot. `setBurden(1)` limits the grip to a cup (curl 1.25, measured 1.24) and caps the pointer's reach at curl 1 times 0.85 (measured 0.84 with the pointer on the palm), so the fingers cup around the doll and never close on it (looked at with the real doll: `burden.png`).

**Sockets.** The palm socket is a child of `Bip001_L_Hand` at the notes' `offsetInBoneFrame`, turned so +Y is the palm normal and +Z points to the wrist (the palm's frame was measured at the end of the reach). The claw tips are the farthest skinned vertex of each finger, measured once at load, and are children of the last bone of the finger, so they follow the curl. Every socket carries `scale = 1 / k` each frame, so its world scale is 1 and its children (the doll) work in stage pixels. `stand` is a child of the root whose matrix is rebuilt each frame as a pure translation to the palm point.

**Hit target.** `id: "hand"`, no cursor label. A disc on the palm (0.031 m) and capsules from each knuckle to its claw tip (0.017 m), projected to the stage each frame (a few microseconds, no raycast). It returns `1000 - z + 25`, so a doll standing in the palm (nearer, smaller depth) wins over the palm. It answers only while the actor is shown, interactive and at least half lifted.

**The look** (round two, 19 Nov 2026: the anime look of the shared toon system, `actors/shared/toon.ts`, `docs/design/home/toon.md`). `material.ts` builds a `ToonMaterial` (three bands, `LOOK.leather` in `constants.ts`) and the shared `InkMaterial`; `glsl.ts` holds the shader text the hand adds on top of the toon patch, `claws.ts` the claw arithmetic. What you see:

- **Leather.** The picture's black is lifted to a violet black (`LOOK.lift`, added to every texel that is not a claw), because bands that are only the colour times a tint do not show on black. Lit step: a dark slate violet. Shade step: a saturated blue (`shade`). Core: an indigo (`deep`). One hard glint shape on the lit side (`glint` 0.6, `glintSize` 0.978: the long white streaks on the thumb and the palm) and a crisp violet rim on the edge (`rim`, `rimStrength`, `rimWidth`, the glove's own, not the global toon rim).
- **Claws.** Flat bright violet, two tone (the lit side as it is, the other side a bluer violet, `clawColor`, `clawFlat`, `clawKeep`). The picture paints a claw as a violet to black gradient with the reflections baked in, which bands cannot read, so the claws are found by the geometry: `measure()` writes a per vertex `aClaw` (0 to 1) from the skin weights, the vertices of each fingertip bone beyond `clawFrom` to `clawTo` of the bone's reach (`clawWeight`, tested). Saturated texels elsewhere (the gold of the bracer) take the same flat treatment by their colour.
- **Ink.** The shared hull (`InkMaterial`, `INK_COLOR`, sized each frame by `ink.setSize(height * scale)`, 2 to 3 px). The hand's own outline code (`outline.ts`, the `smoothNormal` attribute, a second copy of the shader) is gone: `addInk` does it.
- **Two traps, both found by looking.** (1) The toon materials share one program key for the whole cast: the glove and the ink chain their patch AFTER the toon one and give the program a key of their own (`chain` in `material.ts`), or the fade would reach Selena's ink. (2) The claws are thin: a hull drawn BEFORE the glove won the depth test over them and the claws came out all ink. The hull is drawn after the glove (`renderOrder` 2, the glove 1) and only fills what is free.
- The game's normal map is still not used. One look for every screen.

**The bottom fade.** The glove and its ink carry the fade in the material: the vertex shader writes the vertex's height on the screen (`gl_Position.y / w`, so it does not depend on the pixel ratio or the canvas size) and the fragment multiplies the alpha by `smoothstep(-1.0, -0.84, y)`. So the sleeve's end (0.3 m behind the wrist, always below the edge) can never show, and a hand that sinks dissolves from its lowest part upward, the way oryzo's does. It is alpha blending in the hand's own material and not a gradient quad because the page behind changes (daybreak, storm) and a quad could not match it. The cost is that both materials are `transparent` (the glove draws first, `renderOrder` 1, then the ink, 2; opaque things such as the doll draw before and keep their depth). The fade is chained on both: the vertex writes `vFadeY` (the glove from `gl_Position`, the ink from its own clip position) and the fragment multiplies the alpha.

**Loading.** `handItems({ deferred?, priority? })`: one `mediaItem` for `hand.glb` (273 KB), deferred at priority 40 by default. The section that shows the hand on the first screen passes `{ deferred: false }`. `ensureHand` loads through `loadGltf` (the media store), builds the actor in the cast pass and compiles its programs and uploads the picture before it hands it back. `dispose()` removes the hit target, the mixer, the geometry, the materials and the texture, and forgets the parsed model. Context loss: the actor holds nothing on the GPU outside three's own tracking (no render target, no PMREM: the env of the cast is the cast's), and a loss and restore in the lab drew the hand again at once.

## The numbers to tune

`constants.ts`: `LOOK` (`leather` band numbers, `lift`, the rim, the claw colour, flatness and where a claw starts), `FADE` (`lo` -1.0, `hi` -0.84), `PALM.radius`, `FINGER_HIT_RADIUS`. `fingers.ts`: `JOINT_ONE`, `FINGER_SCALE`, `JOINT_FIST`, `FIST_SCALE`, `REACH_GAIN`, `SIGMA`, `GATE_NEAR/FAR`, `SPREAD_MAX`, `SPREAD_GAP`, `LEAN_ROLL/NOD`, the spring (1.5 Hz, 0.5), `RIPPLE` (30 ms). `place.ts`: `hiddenY` (the hand is hidden when its wrist is `1.3 * height + 60` below the bottom edge), `lift` (rise eases out, sink eases in and out), `reachProgress`. `actor.ts`: `IMPACT_PX`, `GRIP_MAX`, `RIPPLE_SECONDS`, the bob and the sway.

## Looking at it

With the dev server on 3100: `window.__home.lab("hand")` returns the real actor, shown and pinned, in the real shared renderer. The scripts are in `D:\ren\aspirant-work\home\HD\` (`lib.cjs` opens the page with `aspirants:intro = off` and consent answered and hides the page's text; `look.cjs` three sizes on light and dark; `rise.cjs` rise 0.05 to 1 and sink; `sweep.cjs` eight pointer places; `grip.cjs` the grip, a cup and side views; `palm.cjs` the real doll on both sockets; `interact.cjs` real hover, press, release and a resize; `touch.cjs`; `perf.cjs`; `checks.cjs` placement numbers, context loss, dispose). A minimal recipe:

```js
const hand = await window.__home.lab("hand");
hand.setInteractive(false); // a still that the pointer cannot move
hand.place({ x: 0, y: -440, z: 0, height: 500 }); // 1440 x 900: the wrist on the bottom edge
hand.rise(1);
hand.sink(0);
window.__home.freeze(true); // after a few hundred ms of unfrozen time (the springs settle)
```

Measured on this machine (dev server, real Chrome, 1440 x 900, dpr 1): `update` 0.04 ms (0.02 to 0.2 ms in the running average), draw of the cast pass with the hand 0.07 ms, 3 draw calls, 8,034 triangles. Far under the 1.5 ms budget. Nothing is allocated in a frame (shared vectors and quaternions; the one `Array` per call is in `measure`, at load).

## Calls made without the owner

- **The hand is Selena's black glove** (design call 6). The model has no skin and no white glove.
- **The reach gain is 2.6 times the notes' mapping.** The notes' numbers are oryzo's deliberately subtle ones; seen face on they hardly read. A full reaction (the pointer right under a tip) bends the middle finger about 115 degrees over its three joints, the grip about 170.
- **`z` means "along the camera ray, the wrist stays where it is on the screen"**, so the section's `x, y` are what the visitor sees.
- **`height` is wrist to highest claw**, and its natural value is 0.55 of the screen; the thumb's claw is the longest thing on the hand and reaches far to the left (it is in the model, and in the elbow view of the notes).
- **No cursor label on the hand** (the request: "HOVER or nothing: make it nothing"). The "Try to hover" hint is the section's.
- **The normal map is dropped** (see the look).

## Not done, not verified

- No section drives it yet (S4 does). The doll landing is a call to `impact()` and `wiggle()` from the section; the dip and ripple were measured, not looked at in a frame sheet of the landing.
- Not looked at in the real home page with the other actors (the cast's light rig moves when the sections move it; the gloss and rim follow it, the ink does not).
- The hover ripple and the grip were looked at in stills (`interact.png`, `grip.png`) and not as video; the springs' feel (overshoot about 15 percent) is judged from numbers and four stills.
- Chrome on this machine only; no Firefox, Safari, a phone (touch was emulated with CDP touch events at 390 x 844); not timed on a weak machine; the dev server, not the production build.
- The thumb's claw is very long on the screen and leaves it at 390 px wide. Not changed: it is the model's.
- A pointer that is held down on the hand for more than 1.2 s releases the grip by itself (a safety against a lost release). In the touch run, the drag below the ring tip showed no bend because the grip had already let go and the drag was out of the hand's reach; the touch reach itself is the same code as the mouse's and was looked at only with the mouse.
- After a context loss and restore, `dispose()` logged "object does not belong to this context" WebGL warnings (the lab disposed after the stage had made a new renderer). Probably three's old renderer deleting its own buffers; harmless in the run, not investigated.
- The normal map of `hand.glb` does not read as a tangent space map (M1 may want to look at it); the actor does not use it.
- Extreme `pitch` and `yaw` values (about 0.9 rad) bring the sleeve's end near the camera and show its cut; ordinary placements never do.

## Round two (19 Nov 2026, TOON-PROPS): the anime look

The hand is drawn with the shared toon system (see "The look" above). Files: `material.ts` (rewritten), `glsl.ts` and `glsl.test.ts` (the shader text and a test that runs the whole patch chain on three's own basic shader), `claws.ts` and `claws.test.ts` (new); `outline.ts` and `outline.test.ts` are deleted (the shared `addInk` does the hull). `LOOK` in `constants.ts` is new. No change to the API, the fingers, the sockets, the hit target or the placement.

- **Looked at** (Chrome, real GPU, dev server): lab at 1440x900 on a light ground, on the dark ground of the real hand section with the doll in the palm, and at 390x844 (touch, dpr 2) over the hero wall; the pointer on the palm (the fingers curl, the claws stay flat violet); the glint, the rim and the claws on every frame. Frames in `D:\ren\aspirant-work\home\TP\shots\`.
- **Rise and sink** looked at as a sheet (rise 0.15, 0.4, 0.7, 1 and sink 0.4, 0.75): the glove and its ink dissolve from the bottom edge as before.
- **Measured** (Chrome, real GPU, dev server, in the lab over the hero scene): 3 draw calls and about 8k triangles added to the pass (the same as before: the hull is the same one draw), `update` 0.1 ms in the running average on a machine shared with other work (0.04 ms was measured before; the toon material and the claw weight add nothing per frame, so most of the difference is likely noise, not isolated). Nothing is allocated in a frame.
- **Not verified.** The grip as a sequence; the ink's width at the smallest hand a section uses; context loss after the change; other browsers and a weak machine.
