# Round eight, FIX-hero-wall-strip (20 Nov 2026)

The owner's words: `docs/superpowers/specs/2026-11-20-home-feedback-8-request.md`. Four parts of the home page: no idle snap at two transitions, the wall's words, the strip's hover release and the small strip's place.

## 1. No idle snap at the hero and at the wall's close

`noSnap: true` on the hero's one zone (`sections/hero/index.ts`, scroll 0.1 to 2.9: the logo morph, the gather, the ring, the landing) and on the aspirants' close zone (`sections/aspirants/index.ts`, scroll 4.1 to 5.1: the hard edge of the wall sweeps out and the plane opens into the rows). Both are plain scroll linked passages now. No kernel edit: the option was made in round five for the strip's exit (`kernel-scrub.md`, `round5-S-strip.md`). The `seconds` of both plays stay in the table for its validation only.

The joint snap does not pull the page there either. `__home.snap().joints` has no joint for the hero or the aspirants (both are `restOutside`). The one joint near the wall, the rows' lead (4.8 to 5.1), lies inside the aspirants' close zone, and a noSnap zone still counts as a zone for the joint snap, so it reports `blocked: "zone"`.

Looked at with a real wheel (1440 by 900, dev server, real Chrome): wheel to a stop, wait for the glide to end, then sample the real scroll every 350 ms for 4.2 s. In all nine runs the page did not move (largest deviation 0.00000 screens, `moving` never true, `scrub.blocked` was `free` and the joint snap's `blocked` was `zone`):

| run             | stopped at (screens) | zone progress |
| --------------- | -------------------- | ------------- |
| hero down early | 0.467                | 0.13          |
| hero down mid   | 1.556                | 0.52          |
| hero down late  | 2.644                | 0.91          |
| hero up mid     | 1.367                | 0.45          |
| hero up late    | 2.456                | 0.84          |
| wall down mid   | 4.522                | 0.42          |
| wall down late  | 4.989                | 0.89          |
| wall up mid     | 4.500                | 0.40          |
| wall up late    | 4.889                | 0.79          |

The scene showed the mid state for the place in every run (the cards gathering into the ring going down and going up, the landed wall, the wall's edge opening into the rows). Contact sheet: `D:\ren\aspirant-work\home\FIX-hws\shots\nosnap_sheet.png`, script `nosnap.cjs`.

Test: `sections/hero/no-snap.test.ts` (every zone of the hero and the aspirants has `noSnap`).

Call made without the owner: the rows' own zone (the film's space, the film growing upright, 5.5 to 7.0) keeps its idle snap. The brief names the wall's transition "to the next section", read as the wall's close into the rows. To drop the snap of the rows' zone too, add `noSnap?: boolean` to `BeatStep` and `playsOf` in `kernel/beat.ts` and set it on the step in `sections/rows/index.ts`.

## 2. The wall's words

`sections/aspirants/aspirants.module.css`.

- The title was slanted by the browser: the page's headings and `.title` in `home.module.css` set `font-style: italic; font-synthesis: style`, and the display face has no italic, so the browser skewed the upright glyphs. `.box .title` now sets `font-style: normal; font-synthesis: none` (computed: `normal` and `none`). Nothing in the section's runtime or `words.ts` writes a skew; the only transform on the line is the rise of the trigger.
- The description had `max-width: min(34ch, 100%)`, a narrow column squeezed to the left of the 35 percent window. It is now `max-width: 100%`: the paragraph fills the column (397 px at 1440, 477 at 1706), still one left aligned paragraph with the two logos inline. The stacked layouts (a narrow window or a tall screen) take `min(46ch, 100%)` in the last rule block, so a tablet keeps a readable measure.
- The paragraph stays in the italic serif (it was never in the owner's words).

Measured at the wall's rest (`getBoundingClientRect`): 1440 by 900, the window is 936 to 1440, the column 970.6 to 1367.9 (left gap 34.6, right gap 72, the page's gutter), the title 397 wide at 80 px, the paragraph 397 wide (was 311). 1706 by 950: column 1150 to 1627, paragraph 477 wide. 390 by 844: column 17.8 to 372.2, paragraph 354 wide. Looked at all three (`shots/words_after_*.png`).

## 3. The strip's hover release

Cause (it was not the rate of the ease). The hover amount of a plane eased at 9 per second, but the pointer's place on the plane (`px`, `py`, the lean's direction, the picture's shift and the lens and split centre) was written as 0 on the very frame the plane stopped being the hovered one. The lean is `amount * pointer`, so it dropped to flat in one frame while the amount was still easing.

Now (`fx/video-plane/actor.ts`, `hover.ts`):

- The hover amount of each plane is a critically damped spring (`springStep` of `image-field/spring`, one `Spring` per plane): in at omega 14 (`HOVER_IN_OMEGA`, about 0.4 s to within 2 percent), out at omega 9.5 (`HOVER_OUT_OMEGA`, about 0.6 s). It never overshoots, starts and ends with no speed, and is clamped to 0 and 1 with its speed zeroed at the clamp.
- The pointer's place on the plane is followed on a low pass (`POINTER_FOLLOW_RATE` 18 per second) while hovered and HELD where it was when the cursor leaves (`heldX`, `heldY`), so the lean, the shift and the lens ease back from where they stood. While the amount is under `POINTER_SNAP_BELOW` (0.02) the held place jumps to the pointer (nothing shows of it yet), so an entry does not sweep across from an old place.
- Everything that leaves is the same path: the cursor moving off, the scroll carrying the film away from under it (`hit` changes), `fly`, the player opening (`interactive` false), a lost pointer (window blur, a touch end). The kernel sets `inside` false or the hit to something else, the index becomes -1 and the spring runs down.
- `debug()` of the actor reads `hoverAmount` and `held` for probes.

Looked at with numbers (real Chrome, 1440 by 900, a rAF log after a one jump `mouse.move` off the film, script `hover.cjs`):

- Small strip: amount 1.000 before, then 0.850 at 45 ms, 0.512 at 145, 0.271 at 247, 0.152 at 348, 0.066 at 466, 0.028 at 563, 0.013 at 663, 0.003 at 862, 0 by 1.2 s. The held pointer stayed at (0.350, 0.200) the whole time. The fall is monotonic, the largest step in a frame 0.059, under 0.02 at 617 ms. The lean (quaternion y) went -0.0908, -0.0772, -0.0466, -0.0247, ... 0 with it.
- Big window: 1.000, 0.850 at 30 ms, 0.463 at 129, 0.242 at 230, 0.121 at 331, 0.059 at 428, 0.028 at 529, 0.013 at 630, 0 by 1.1 s. Monotonic, under 0.02 at 580 ms, held pointer constant.
- Stills: `shots/hs_small_sheet.png` (a hovered frame leaning, then flat). A real time sheet at 0.1 s steps was not possible: a dev server screenshot takes 0.5 to 1.4 s, so the rAF trace is the evidence.

## 4. The small strip stands a little higher

`fx/video-plane/layout.ts`: `STRIP_LIFT` is 0.05 of the screen's height and `stripLift(vw, vh, e)` is `STRIP_LIFT * vh * (1 - smoothstep(e))`, where `e` is the expand (0 the small strip, 1 the window). `expandBox` subtracts it from the box's y, so the GL plane, the morph's upright target (the rows hand the film over at the lifted place) and the four corner dots, which the runtime already computes from `expandBox`, follow with one number. The lift is exactly 0 for the window, so the window and the orbit are exactly centred (`windowBox` and `sceneCentre` are unchanged).

The runtime (`sections/strip/runtime.ts`, `writeChrome`) writes the same lift as a `translate3d` in front of the transforms it already puts on the line, its two end dots and the arcs, and on the two middle words ("Selena", "Obsidia"), which hang off the line's ends and would otherwise float below it. The top labels, the "Trailer video" words, the button and the bottom left pair stay where they were: the video moves toward the top label cluster and away from the heavy bottom word.

How the number was chosen: the three values 3, 4.5 and 6 percent were shot at 1440 by 900 (`shots/lift_sheet.png`). At 3 percent the change hardly reads, at 6 percent the gaps above and below the frame (to the "Video" word and the "Aspirant 5.0" word) are about equal (57 and 52 px) and the frame comes close to the button. 5 percent (45 px at 900) sits between: the small strip's centre is at 405 against the screen's 450.

Measured: 1440 by 900 the strip's centre is at y 405 (window 450 exactly), 1706 by 950 at 427.5 (window 475), 390 by 844 at 435.8 (the portrait scene's centre sits low, 478, so the strip is still under the screen's middle at 422; the lift is the same share). Through the expand (a real wheel across the trigger, `expand.cjs`, 47 frames): the centre went 405.00, 405.01, 405.11, 407.64, 413.76, 418.29, 428.92, 434.20, 446.52, 450.00. It starts with no jump (the lift is a smoothstep of the expand) and ends at exactly 450.00; the line's translate went -45, -44.99, -44.89, -42.36, -36.24 ... -3.48, 0 together with it.

Tests: `fx/video-plane/layout.test.ts` (the strip's centre assertions now include the lift, a new test for `stripLift`: 0 for the window, monotone, flat at both ends, the scene centre untouched; 15 passed). `hero.test.ts`, `scene.test.ts` and `sections/strip/window.test.ts` compare against `expandBox` and pass (26 passed).

## Not done, not verified

- At 390 by 844 the two middle words ("Selena", "Obsidia") touch the sides of the small frame (the frame is 239 px wide in a 342 px column). This was so before this round (the words stand 10 px under the line, inside the frame's height) and was not part of the request.
- The descent (the drone's reaction to the cursor while the doll falls, the doll's depth against the drone) is another helper's part of the same message, not touched here.
- Not looked at: a real trackpad's feel of the tilt, a real touch, Firefox, Safari, the production build.
- No full test run, no check, no build (the owner's process rule). Dev server reloads from other helpers' saves ran in parallel: every script retried across them.
