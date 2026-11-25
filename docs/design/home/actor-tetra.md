# Actor: Tetra and the comic book (workstream TT)

> **24 Nov 2026 (round ten, `docs/superpowers/specs/2026-11-24-home-feedback-10-request.md`).** The kite, its rope and its reel are **gone** (the owner had them removed: `props/kite-*`, `rope.ts`, `spool-mesh.ts`, `public/img/home/kite*` and `scripts/home/kite/` were deleted). Tetra now dances, is shocked and runs after the dragon (poses `dance` and `shock`, `poseMix`). The comic book was made again from nothing, out of shapes, with no picture on it (section 6 below). Sections 5 to 7 are the record of round one and still name the kite: they are history. Section 9 is what is true now.

Tetra in the home's shared renderer, with the About page's look, plus what the funny, chase and bend sections need: a comic book she holds and a set of poses (dance, shock, run, pant, wave, sit, read, bend, pat, hug). Code: `apps/web/src/features/home/actors/tetra/`. A plain TS class, no React. The model is `/models/about/tetra.glb` (never changed). Only constants and her spring solver are imported from `features/about/tetra/` (`model.ts`, `spring.ts`); nothing there was edited.

## 1. What a section does

```ts
// mount(ctx): built once and shared (a second ask finds the first)
const tetra = await ensureTetra(ctx); // from "../../actors/tetra"

// update(local, frame): set the state EVERY frame she is shown
tetra.visible = true;
tetra.place({ x, y, height, z?, yaw?, flip?, origin? }); // stage frame, y UP; (x, y) is between her FEET
tetra.pose("run", blend, "shock"); // idle dance shock run pant wave sit read close stand bend pat hug; blend 0..1 of the pose over the one it comes from
tetra.poseMix([["dance", 0.3], ["shock", 0.5], ["run", 0.2]]); // several at once: the shares are scaled to one (a scroll that moves through three poses)
```

The kernel hides every actor before the sections run. Setters are sticky between frames. `place` and `pose` are the two a section must call each frame. Nothing here reads the scroll or the DOM.

### API (`TetraActor`)

```ts
place({ x, y, z?, height, yaw?, flip?, origin? }) // height = standing height on screen in CSS px (crown to feet, ears included).
                                                  // z is in px toward the camera and scales her like the pixel camera (1000 / (1000 - z)).
                                                  // flip mirrors the whole doll (faces the left). origin "middle" puts (x, y) at half her height.
                                                  // Applied as given: no smoothing (the kernel already smooths the scroll).
pose(name, blend = 1)                             // the pose and how strongly it is worn. Cut between poses = a quick turn of the body (omega 13).
runSpeed(0..1)                                    // the run cycle's rate and amplitude
waveWith(-1 | 1)                                  // which hand waves: -1 her right (screen left), 1 her left
bend(kind, aim = 0)                               // "earth" | "air" | "water" | "fire"; aim -1..1 turns the stance to a side
patFrom(side, lean = 1)                           // the pat pose: head leans into a hand from side -1 / 1
hugAt(x, y)                                       // the pose "hug" reaches round a point of the screen (stage frame): put the drone's place here
setFace(name | null, blend = 1)                   // neutral happy laugh angry tired surprised reading annoyed focused; null = the pose's own face
emoteFace(name, seconds = 1.2)                    // a face for a while over the rest, then given back
play("hop" | "rise" | "startle" | "nod")          // one-shots on their own clock; they always finish; one at a time
look({x, y} | "pointer" | null)                   // default "pointer": eyes first, then head, a little body. A pose keeps only part of it (run keeps none, read and shock a little)
setInteractive(on)                                // hover and press reach her (default true)
marks()                                           // head, crown, chest, ground, handL, handR in the stage frame (+ scale: px per metre), as of the last frame
socket("handL" | "handR" | "head"): Object3D      // an object that moves with the bone, IN HER OWN SCENE (her metres, her lens)
socketPoint(name, out)                            // the same as a screen point {x, y, scale}: this is what ANOTHER actor follows
attach(object, socket) / detach(object)           // for an Object3D of her own scene (a prop made for her). Keeps the world transform.
tweak(fn | null)                                  // probe hook: fn(channels) runs on the composed channels each frame
advance(seconds)                                  // probes: run her clock in 1/60 s steps and draw
state()                                           // pose, weights, face, marks, channels, for a probe
```

The book (`tetra.book`), made of shapes, no picture on it (section 6):

```ts
set(present, open); // present 0 in her pocket .. 1 in her hands; open 0 shut .. 1 open. Sticky. Comes out first and opens after; shuts first and goes after.
auto(); // let the pose decide: read = out and open, any other pose = away (default)
scene(present, open, support, (toss = 0)); // a section's own script: support 0 is one hand under a shut book, 1 is both hands on the open one; toss 0..1 is the throw
turnPage(); // false when not open or a page is turning. 0.9 s. The eyes start at the top of the page again.
onPress(fn); // fn("left" | "right"): the two boards are 3D hit targets "tetra-book-left" / "tetra-book-right"; the chase makes both go to "See all comics"
labels(left, right); // the words the site's cursor shows over each board (default "OPEN")
quads(); // the four corners of each board on the screen (stage frame), or null when the book is away
```

Loading: `tetraItems({ deferred = true, priority = 60 })` in `preload.ts`: the chunk (`home-tetra`) and the model (573,716 B). The size is tested against the file. The actor loads the same path through the same media store, so a visit that never ran the list still works. The book is code and shapes and loads nothing.

## 2. How it works

| file                                            | what                                                                                                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `actor.ts`                                      | the class: asks, clocks, gaze, hit targets, sockets, the props following her hands, the pass                                                   |
| `scene.ts`                                      | three side: model, ink hull, squash, bones, springs, two-bone solve, sockets, lens, marks. The About scene minus renderer and canvas           |
| `channels.ts`                                   | one frame of her body as plain numbers: place, attitude, squash, 17 turns, two hand targets, a clip; mix, copy, clear                          |
| `poses.ts`, `mixer.ts`                          | the poses as functions of time (dance and shock included); the mixer keeps a spring weight per pose and blends the ones that still have weight |
| `face.ts`                                       | nine faces over the plain one, eased; blinks; the mouth swaps behind a shrink; the squeezed eyes swap behind a blink; reading gaze             |
| `gaze.ts`, `place.ts`                           | pointer to head turn; the stage frame to the canvas (z, origin)                                                                                |
| `ik.ts`                                         | analytic two-bone solve (elbow place from shoulder, goal, pole, lengths)                                                                       |
| `reactions.ts`                                  | one-shots and the answers to presses                                                                                                           |
| `props/book.ts`, `book-hold.ts`, `book-mesh.ts` | board angles, page turn, pop; where her palms take the book and where it hangs (pure); the shapes of the book and the ink                      |

**Look.** Unlit, so not the cast pass (that is for the lit characters): same constants as `/about` (20 degree lens looking down 7, ink hull 1 to 2.3 px kept constant on the screen, squash done after skinning so bones and springs never see it, `SQUARE` correction on the head). She is never scaled: the springs run in metres, her size is the camera's distance, and her mark is slid to the page's point with the view offset.

**Her own pass `tetra`, order 27**: over the flat passes (10, 20) and the drone's back layer (25), under the cast (30) and the drone's front layer (35). So Silverbolt, the doll and Selena (cast, 30) always draw over her, and `drone.layer("back" | "front")` puts the drone behind or in front of her. In the pass: her scene, with the book in it (the book is in her own scene so her body and the book share one depth buffer).

**A frame.** Every bone back to rest, the clip (only if a pose names one, none does today), the turns in order from the hips out (each is a turn about HER axes, carried into the parent's frame, so a parent's turn carries its children), then the arms with a hand target solved by two aims (the elbow from `ik.ts`), all done with her at the origin and unturned so a frame's world is her frame; then her place, attitude and mirror, then the springs (hair, ears, skirt) at a fixed 60 Hz, then the face morphs. Marks and sockets are read after, so the book follows the hands of THIS frame, never the last.

**Rig: what could and could not be done.** Done: knee, shoulder (clavicle), wrist, neck, spine2 channels added on top of the baked bones; a two-bone IK for both arms with hand sockets (a hand reaches a point of her own frame, as far as the arm goes, the elbow bends down and out); sockets for both hands and the head. Not possible with this file: no feet or toes (a stomp or tiptoe does not read; the earth stance is a drop and a squash instead), no fingers (hands are mittens, no grip or point), no brows (anger is the squeezed eyes and a frown), no IK on legs, stubby legs (cross-legged sitting reads as a chibi squat). Her arm is short: a hand cannot reach her own head, so a pat is a lean into a hand that is not there (the drone's hand).

**Faces.** Her eyes have six morphs and her mouth eight drawings, one at a time. A PART WAY `squeeze` DRAWS NO EYES AT ALL (found in the lab), so the squeezed "> <" eyes (angry, laugh) are all or nothing: they switch on at half strength behind a forced blink (a test holds it). A mouth change shrinks to nothing, swaps and grows. Read at 120 px (head about 40 px): happy, laugh, angry, surprised read clearly; annoyed, reading, tired and focused are subtle at 120 and read from about 250.

**Interaction.** Hit targets: `tetra` (head circle or chest circle, cursor "HI", depth 300) and the two covers (depth 200, so a cover over her chest wins). Hover: happy face if the pose keeps the gaze. Presses (`reactions.ts`, her own clock): hop and happy, hop and laugh, startle and surprised, from the fourth in a row startle and annoyed for 1.8 s; a pause of 2.2 s starts again. A hit test is a projected circle or quad, no raycast.

**Jumps.** A frame that is not the one after the last, or a step of the scene over 1.2 screens, puts the pose mixer, the face and the book on what is asked at once (after the section's wants are in), and resets the hair.

## 3. Numbers to tune

`poses.ts`: every angle (the stances, the run's `swing` 0.55 to 1.1, `pump`, the lean, the sit's `y` -0.145 and leg angles, the reach targets of read (from `book-hold.ts`), close, pant). `mixer.ts` OMEGA 13. `face.ts` FACES table, FACE_OMEGA 16, MOUTH_RATE 9. `gaze.ts` 0.52 yaw and 0.5 nod, held between 1.3 and 2.4 heights. `actor.ts` ORDER 27, DT_MAX 0.05, S_JUMP 1.2, TURN_OMEGA and PACE_OMEGA (how fast her turn and her pace follow a section), OWN_GAZE. `book-hold.ts` BOOK_W, BOOK_H, BOOK_SCALE, READ_AT, READ_TILT, CARRY_TILT, the grips. `book.ts` OPEN_V 0.32, TURN_SECONDS 0.9.

## 4. How to look at it (the lab recipe)

Dev server `http://localhost:3100`. Scripts are in `D:\ren\aspirant-work\home\TT\` (not in the repo): `lib.cjs` (opens the home with intro off and consent answered, builds the lab actor as `window.__t`, seeks to a quiet section), `poses.cjs` + `sheet.py` (every pose), `strip.cjs` (a moving pose, N frames), `faces.cjs` + `facesheet.py` (every face at 600, 300, 120, with blends `name:0.5`), `book.cjs` (out, open, page, close, away), `interact.cjs` (real mouse: hover, look, presses, cover presses), `perf.cjs`, `mobile.cjs` (390 by 844, resize, lost context), `cross.cjs` (the drone at her head), `tweak.cjs` (hand set channels, to learn an axis).

```js
await page.evaluate(async () => {
  window.__t = await window.__home.lab("tetra");
});
await page.evaluate(() => window.__home.seek(7)); // a quiet section: the hero's logo covers the canvas
await page.evaluate(() => window.__home.freeze(true));
t.place({ x: 0, y: -250, height: 500 });
t.pose("dance", 1);
t.advance(3); // frozen scene: update runs with dt 0, so use advance(s) for her clock
```

To hide the page and keep the canvas: `body * { visibility: hidden !important } canvas { visibility: visible !important }`.

## 5. What was checked in round one (history: it still names the kite)

- **Poses:** all 12 as a contact sheet; the run as an 8 frame strip and mirrored (`flip`: faces left, hair trails the right way, no whip); the four stances as 6 frame strips (distinct, wide base, the arms read); sit, read, close with the book; pat and hug.
- **Faces:** nine faces at 600, 300 and 130, and the seven others at 120 and 600 after the fix. Angry at blend 0.49 and 0.5, laugh at 0.5: eyes always visible (all or nothing behind a blink).
- **Kite:** flying on the rope in wind (taut, calm sag, tail with three bows), the cut with `fall` (nine frames: the lower rope drops from her hand, the kite swings down and lands flat, the rope lies on the floor) and with `fly` (tumbles off in about a second). At 390 wide as well. Cut survives hide and show.
- **Book:** out of the pocket, opens, covers show two pictures, page turn, closes, goes away. The turn is mostly hidden from the front (the visitor sees the outsides); the leaf's edge rises over the top of the book.
- **Real mouse:** hover sets `hit: "tetra"` and a happy face; the head follows the cursor (head yaw plus or minus 0.27 at 380 px, eyes first); presses answer hop, laugh, startle, annoyed; the two covers are hit and pressed (`onPress` got "left" and "right").
- **Sockets:** `socketPoint("head")` put the drone on her crown; `drone.layer("back")` draws behind her, `"front"` over her.
- **Resize** 390 to 1440 in the middle: her mark stays at its place in the pixel frame (difference under 0.01 px). **Lost context** (`WEBGL_lose_context`, lost then restored): she, the kite and the book draw after it; no console error.
- **Performance** (dev server, 200 to 300 frames each at 1440x900): `update` (all her logic, bones, springs, IK, props) median 0.2 to 0.3 ms, p95 0.3 to 0.5; `render` (the CPU side of her draw) median 0.2 to 0.6 ms, p95 0.4 to 0.9; frame gap median 16.7 ms, p95 17.5 ms (60 Hz, no dropped frame) in idle, kite, run, read with book and bending. One spike of 6.5 ms is the first frame of a kite (`reset` settles the rope for 1.2 s at once); a section that shows the kite should do it a frame before it matters, or accept it. `performance.now` steps 0.1 ms here.
- **Unit tests** (13 files, 88 tests, `npx vitest run src/features/home/actors/tetra`): channels, ik, ease, face, gaze, place, quad, poses (finite for a minute at any speed and stance, loops close, legs alternate, aim, reach), mixer, reactions, preload (real file sizes), rope and kite sim (fixed step equal at 60 and 144 Hz, cut, fall, fly, nearest, cut before the first step), book. `eslint`, `tsc`, `prettier` and `knip` are clean for the folder; `scan-text` has 0 problems.

## 6. Calls made in round one (history)

- **The kite falls by default.** The owner's text says "it broke the rope and the kite down". The assignment said the kite flies away with the upper part. Both are built: `kite.cut(at, "fall")` is the default and `"fly"` lets it go. One argument decides.
- **Unlit, in her own pass at order 27**, not the cast pass: the About look is unlit with an ink line, and Tetra stays that way. She draws under Silverbolt, the doll and Selena.
- **(x, y) of `place` is between her feet**, not her middle (`origin: "middle"` for that), so a ground line and a seat are easy to place. `height` is her standing height with the ears.
- **The book is a two-comic album seen from outside**: the back cover (left, The Aspirants) and the front cover (right, Vexana and Guinevere) are the two pictures. Shut, it shows the back cover only. Reading from behind it, the visitor sees the covers, not the pages, so a page turn shows as an edge over the top.
- **Vein mark and speech marks are not drawn here.** The marks pass (fx workstream) draws them from `marks()`.
- The pat is a lean into a hand that is not there; the section puts the drone's hand (or the drone) over her head with `socketPoint("head")` and calls `patFrom`.

## 7. Not done in round one (history)

- The production build and `scripts/perf/weak.mjs` (helpers do not run `pnpm build`); GPU time (no timer query); Firefox, Safari, a real phone and touch (a touch press goes through the kernel's hit target, not run with touch here); a context lost for good (the stage making a new canvas): only lost and restored was run.
- No section drives her yet: the funny, chase and bend sections do not exist. `tetraItems()` was not run in a browser by a section. The joints in the design (J11 to J14) are the sections' job; the actor holds no state a joint needs but the kite's cut and the book's presence.
- The covers' loader takes webp and a media store path; an R2 `libUrl` (another origin) was not tried (`loadMedia` may refuse it): a section that wants the real comic covers passes `Texture`s it made itself.
- `hugAt` was run only as a pose with a default point, not with a live drone; the hug looks plausible with the hands in front of the chest, not tested at other points. The hands cannot reach more than about 0.2 m from her shoulders.
- The poses are a first pass tuned by eye in a contact sheet: the run reads as an angry kid running but is not an animator's run, the stances read as four different gestures but the bend section will want its own pass with real images flying. Numbers are in section 3.
- Not built: a hand-held reel in the chase that drags the cut string on the ground in the run (the lower part hangs from the reel while `kite.fly` is set; after `fly(null)` the string is gone, `setReel(true)` shows only the reel), the vein mark, the drone coming out of the paper (the section's picture plus `socketPoint`).

## 8. Shared files touched

One line in `kernel/lab.ts` (`tetra`). Nothing else outside `actors/tetra/` and this file.

## 9. Round ten, 24 Nov 2026: dance, shock, blending and the new book

The owner's words are in `docs/superpowers/specs/2026-11-24-home-feedback-10-request.md`.

**Poses.** `dance` is an idle that dances in place, facing us; every term is a whole number of turns of one phase, so a cycle of `DANCE_SECONDS` (1.2 s) loops with no seam (a test holds it). `shock` throws her back on her heels with the arms flung up and out, the face kept to the visitor (the head only a little back), the whole body shaking. Its face is `surprised` (wide eyes, the round mouth). The funny section blends dance, shock and run with `poseMix`, so each share follows the scroll and nothing pops when the leading pose changes.

**Blending, how it is done.** Every pose has a spring weight (`mixer.ts`, about a quarter of a second), so a cut from one pose to another is a turn of the body, never a pop. Three more things are eased in the actor so a section cannot make a pop by switching them in a frame: the turn of her whole body (`place({ yaw })`, `TURN_OMEGA`), how fast she runs (`runSpeed`, `PACE_OMEGA`) and the book's openness and presence (`BookState`). A pose function must never step: the run's knee fold used to switch by a factor of two at a point of the cycle and now eases. To look for a pop use `node scripts/qa/home/wheel-track.cjs <fromS> <toS> --back` (a real wheel, the actor's own channels every frame, the biggest second differences first). A `seek` is a jump on purpose (the actor snaps), so it never shows a pop.

**The book (`props/book-mesh.ts`, `props/book-hold.ts`).** A hardback made of shapes: two bevelled boards in cloth, a raised border, a raised emblem on each cover (the back cover a ring with a star and three lines, the front cover a band, a big star and a row of squares), gilt corners, a spine with ribs, two blocks of pages with panels on them and one page that turns. There is no texture on it. It is drawn in the home's toon look (`ToonMaterial`, the shared key light, an `InkMaterial` line round the boards and the spine). It casts no shadow of any kind (25 Nov 2026, the owner: remove the black shadow completely and leave only the book): not the flat one the raised shapes laid on their board, and not the soft one that a multiplying plane laid on her clothes. Do not bring either back. The raised shapes of a board are merged by material, so the whole book is about a dozen draw calls.

**Where it is.** Her palms decide. `book-hold.ts` says where each palm goes (under the lower edge of a board, a little behind it, `gripLocal`) and where the open book hangs in her body frame (`READ_AT`, tilted back by `READ_TILT` so the pages look up and back at her face). The pose `read` asks the arms for those points (`readReach`), and the actor places the book so that her real palms are on its grips (`followProps`). So the hands carry the book from below and cannot push into it, and the book cannot sink into her: it hangs a hand span in front of her chest. A shut book carried in one hand sits on the palm under its lower edge (`ONE_HAND_*`), so the forearm comes in below it. If you change the book's size (`BOOK_SCALE`) or its hold, the numbers in `book-hold.ts` are the only place, and `book-hold.test.ts` holds the geometry (palms under the edge, the top leaning away from her, the book clear of her chest).

**The covers are not pictures.** The two comics are the cards beside her (plain images in the markup). A press on either board of the book goes to "See all comics" (the chase's `bindBook`).

**The face and the book.** The book is held at her chin so the face stays to the visitor; her eyes look down at it (`readingGaze`, the face `reading`). Bowing the head more hides the face behind the hair: do not.

**The opening of the book, fixed on 24 Nov 2026 (the owner: "so much snap").** Two causes. (1) `aim()` in `scene.ts` made a share of a swing by slerping a quaternion toward itself after clearing it, so an arm that was only part way to its hand target did not move at all and then jumped the whole way when the share reached one: every hand reach (pocket, read, pant, hug, swipe, pat) snapped, the right hand by 68 pixels as the book came out and the left by 140 as it joined. The whole swing is now kept apart and the share is a slerp from no turn to it, so a hand follows its share of the pose smoothly. (2) The three things of the opening (the book out of the pocket, the book to her chest and into both hands, the boards opening) were squeezed into 0.2 of a screen. They now have their own stretches of the chase's `local` (`bookOut*`, `bookIn*`, `open*` in `chase/timeline.ts`), overlapping, with the reading pose worn from 0.79 to 0.85. The pages of the book are always drawn (they used to be switched on at the first opening). `node scripts/qa/home/wheel-track.cjs 43.3 44.9` prints the book's and the hands' second differences too: after the fix the book moves less than 1 mm and a hand less than 0.5 px of second difference through the whole opening.
