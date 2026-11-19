# Round four, DOLL-look-ride: the doll's anime look, the rider, no bubbles (20 Nov 2026)

Request: `docs/superpowers/specs/2026-11-20-home-feedback-4-request.md` (the doll's part). API for the sections: `actor-doll.md`, "Round four: riding". Lab scripts (outside the repo): `D:\ren\aspirant-work\home\DLR\`.

## What changed

**The look** (`flat.ts`, `dress-flat.ts`, `look.ts`). Her atlas carries airbrushed gloss and the many sheets of her hair have a normal each, so the toon bands broke into small shapes and the underside of the head went dark. Now: (1) the mesh's normal attribute is replaced once at dress time by SHADING normals: a ball over the head for the hair (a cylinder below the head centre, 15 percent of its own normal), the face shell pulled 72 percent toward the viewer (lit flat, crisp), the neck pulled 80 percent up and to the viewer (no dark under the chin), cloth and arms as they were. One terminator, big flat shapes. (2) One flat shade tone per part (two bands everywhere, hair `cut` 0.28 and `soft` 0.012: a hard edge), the pale lilac rim of the face removed (skin rim 0.1), the toon glint of the hair replaced by one crisp highlight ARC (a ring round an axis of the ball normal in view space: `ringAxis`, `ringFrom`, `ringTo`, `ringWhite`, `ringAmount` in `FLAT`). (3) A step cut of the picture's lightness exists (`FLAT.levels`, GLSL in `stepsGlsl`) and is OFF (0): at 4 steps the soft gloss became cream blotches that read noisier than the smooth pink. The program keys carry the numbers. Seen at 1100, 650, 300 and 120 px tall and on the dragon: flat pink hair with a violet pink shade on the right, a thin gloss arc on the upper left, a flat lit face and chin. Not an exact match of the in-game look of Selena: the doll's own atlas is the limit.

**No dialogue boxes.** The only one the doll had was the swear bubble of the funny section (`sections/funny/runtime.ts`: the `swear` mark every 0.62 s, its constant, its field and the now unused `jumped` parameter of `drawDragon` are gone). The doll's other marks are emotion cues and stay: a starburst on a press, sweat on dizzy, a sparkle on hover (`bolt/scene.ts` `onDollReact`). The `bang` and the poof of the sneeze in `bolt/scene.ts` `sneezeNow` are the sneeze's (SEC-bolt-fall replaces it with the shake). The doll's `cursing` face and `talk` (mouth wobble) are her face, not a box.

**The rider** (`ride.ts`, `ride-physics.ts`, `idle.ts`, `arm-ik.ts`). See the API note. The seat's world motion drives spring chains on her trunk, head, legs, free arm and seat; two bone IK holds the grips after her body has moved; she keeps her head up against the seat's tilt; a seeded state machine gives sit, look, fidget, adjust, slip (close to falling, then recover, then adjust), strain (the dragon shakes) and gone (`loseGrip`); her head follows the pointer when it is near.

## Files

New: `flat.ts`, `dress-flat.ts`, `ride.ts`, `ride-physics.ts`, `idle.ts`, `idle.test.ts` (8 tests, run: pass), `arm-ik.ts`. Edited: `actor.ts` (the hooks of the API note, the flat normals and patch in `dress`), `look.ts` (`PART_LOOKS`, `FLAT`), `look.test.ts` (the title and the band count), `sections/funny/runtime.ts`, `docs/design/home/actor-doll.md`.

## Numbers to tune

`FLAT` in `look.ts` (head centre, `faceFront`, `hairOwn`, `neckFront`, `levels`, the ring), `PART_LOOKS` (the `cut` of hair 0.28 is the size of the shadow), `SEAT_OFFSET`, `UPRIGHT`, `FIT_MAX`, `FIT_REACH`, `SPREAD` (`ride.ts`), `CHAIN`, `ACC_DEAD`, `ACC_MAX` (`ride-physics.ts`), the lengths and `FORCE_AFTER` (`idle.ts`).

## Not verified, not done

- **The hands do not hold the crest at the shipped sockets.** The IK works (it clamps at the reach, never flips) but her arms are short and SB's grips are about 0.9 of her drawn height from the seat and wider apart than her shoulders, so the hands stop short. At the size she has on the page the arms are mostly behind her body. Needed from SB-dragon: grips within 0.25 of her drawn height of the seat. Not seen: the IK landing on a grip.
- **Not looked at in the real bolt section** (the integrator rewrites `bolt/scene.ts` while this ran). Looked at: the lab with the real dragon (`lab("silverbolt")` and `lab("doll")`), fixed and flying heading 135 degrees, the states forced one by one (sit, slip, recover, adjust, look, fidget, gone) at 300 and 600 px dragons. NOT looked at: a climb, a dive, a turn and the shake as frame sequences (the physics numbers were read: rest p50 12.6 heights a second squared of acceleration, p90 19.7, which the dead zone of 6 absorbs); strain from a real `sb.shake` (the lab call `sb.shake` was read in the notes, the doll's response not seen); the phone.
- She sits behind the near wing when she slips to the side (the slide moves her down and back): acceptable for a slip, not checked in motion.
- The dragon's seat tilt and the counter-rotation are about the camera's axis taken in the seat's frame: right for the side view the dragon has now, not for any other.
- `look.test.ts`, `toon-face.test.ts` and the rest of the folder were not run (one file only, by the owner's rule); `look.test.ts` was changed by reading. No flat.ts test: the shading normals are pure (`flatNormals`) and want one in the cleanup pass (a ball normal on the crown points up, a face vertex leans to the viewer, a neck vertex up, an unknown part keeps its normal).
- The step cut is off, the ring is a number to look at on a phone: at 120 px it is a hair thin line.
- Firefox, Safari, a weak machine, GPU time (CPU `update` 0.15 to 0.4 ms), production build.
