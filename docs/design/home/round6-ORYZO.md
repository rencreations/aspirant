# Round six: the character section as the oryzo.ai strip (ORYZO-characters, 20 Nov 2026)

The owner's words: `docs/superpowers/specs/2026-11-20-home-feedback-6-request.md`. The study of the reference is `docs/design/home-reference/ref-oryzo.md` (section 7). Code: `apps/web/src/features/home/sections/list/`.

## 1. What the section is now

The list is the oryzo.ai section "So portable, it's wearable" in our light ground, our fonts and our copy:

- a 4:5 window, 0.8 of the screen's height, centred, with a dashed line around it (6 px outside, drawn side by side by the scroll, four short marks inside and an accent dot, the dot pops with a back ease);
- small pictures (0.35 of the window, gap 0.08 of one) in a row on each side, on the middle line, in the order of the strip: the frames before the one in the window on the left, the ones to come on the right, the outer ones cut by the screen edge. A step of the strip moves both rows by one picture;
- the heading at the left, over the left small pictures: the muted line "CHARACTERS," over the name of the frame in the window, bigger and bold. The name changes mid step (the old one goes up and out, the next comes from below). Every name is a real link;
- "SCROLL TO CONTINUE" with a round dashed ring and a nodding chevron at the bottom centre;
- no background of its own: the plain daybreak ground. The silk backdrop, its palettes and its plan are deleted.

The ten frames are the owner's order: Obsidia, Fanny, Guinevere, Angela, Lesley, Layla, Ruby, Vexana, Chang'e, then Selena in 3D. The media, the viewer (press the frame: the whole picture opens with margins, "Click to view" cursor), the loops and the Selena frame are the old ones. The small pictures are the same stills as the frames (`frames.ts` posters), so nothing new is loaded.

## 2. The scroll (all scroll linked, up and down)

`stations.ts` (pure), `timeline.ts` (pure, tested in `timeline.test.ts`).

| part     | where                                 | what                                                                                                                                                                                                                                                                 |
| -------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the rise | the lead, `LIST_LEAD` = 1.6 screens   | the strip comes up from below the screen (sine in out), the heading a little later (cubic out), the small pictures one by one (the near ones first), the dashed line draws in the last third, the hint fades in at the end. Exactly in place at the section's start. |
| rest 0   | 0 to 0.4 screens                      | Obsidia in the window                                                                                                                                                                                                                                                |
| a turn   | zone of 0.6 screens, rest of 0.3      | frame k to k + 1 (`inOutSoft` zone, 0.7 s snap). The window's row slides, the arriving picture is turned 10 degrees and 1.2 times too large and settles (Oryzo's seam), the small pictures move one step                                                             |
| growth   | zone of 1 screen after frame 9's rest | Selena's frame grows into the whole screen (as before), the heading, small pictures, line and hint leave in its first 30 percent                                                                                                                                     |
| dwell    | 0.5 screens                           | Selena's; the selena section's lead begins in it                                                                                                                                                                                                                     |

Length: 10 screens (was about 13): 0.4 first rest, nine turns of 0.6 with rests of 0.3, one screen of growth, 0.5 dwell. `LIST_LEAD` is the descent's number (`sections/descent/stations.ts`), re-exported from `stations.ts`. `index.ts` has `mountAhead: 4` (Selena is built in a pause of the scroll).

## 3. Layout (`layout.ts`, `listGeometry(vp)`, pure and tested)

- Wide (1440x900, 1706x950, anything with 330 px or more of ground at each side of the window): frame 0.8 H tall, centred both ways, so nothing stands empty above it. Heading at 3.125 vw, its bottom 0.4 units over the small pictures; the unit is `frame.h / 30` (24 px at 900), the name is 1.5 units.
- Stacked (a phone, a small tablet): the heading stands above the frame, the block is centred between the bar and the foot (0.8 H on a phone, so the pair at the bottom right has room), the frame is 0.76 of the width at most, the small pictures only peek at the sides.
- The bottom right corner (20 percent by 30 percent) holds nothing of the list. The right small pictures end above 0.7 H. The hint is at the foot, in the middle.

## 4. What it gives and takes (the contract with the others)

- **From DESC-descent** (`round6-DESC-descent.md`): `LIST_LEAD`; `createListPair(ctx)` in `list/pair.ts` and its `step(grow, edgeY, frame)`. The list calls `step(b.expand, frame.y * (1 - b.expand), frame)` once a frame for the whole of `local >= 0`, and never in the lead. `grow` reaches exactly 1 at the end of the growth.
- **To DESC-descent and BUDDY-actor**: the window's rectangle for the pair is `listGeometry(vp).frame` (CSS px). The pair is drawn in front of the strip (the pictures are in the `below` layer, under the canvas); the words and the hint are in the text layer, over the pair. The list keeps its own content out of the dock's corner but does not stop the pair from passing over the strip.
- **Shared helpers**: `sections/vp.ts` (`Vp`, `isPortrait`, `seg`, `smooth`, `mix`), `sections/idle.ts` (`whenIdle`).
- The viewer, `frames.ts`, `loop-video.ts`, `preload.ts` and `selena-frame.ts` (the sky, her fits, `dollHang`) are unchanged except for the import of the shared helpers.

## 5. Life

The frame lifts 6 px and grows 1.2 percent while a mouse is on it at rest, and its dashed line brightens (eased, `1 - exp(-12 dt)`). The dashed line draws itself, the dot pops, the chevron nods (a CSS keyframe on the compositor). Everything writes transform and opacity only.

## 6. Removed

The toss of the doll onto the frame, the hand, the doll on the frame's corner, the live backdrop, `backdrop-plan.ts`, `palettes.ts` and their test. The old `layout.test.ts` cases (room on top for the doll, 0.70 tall) are replaced by the cases of section 3.

## 7. Looked at (real Chrome, dev server on 3000, scripts in `D:/ren/aspirant-work/home/ORYZO/`)

- 1440x900: the rise at -1.55, -1.2, -0.8, -0.4, 0 and 0.2 screens; the rest on frames 1, 2, 5, 8 and 9; mid turns at 0.6, 0.7, 0.85, 1.7; the growth at 8.35 to 9.5 in steps of 0.08. Side by side with the owner's screenshot and the recon's `list_13500.jpg` (`out/cmpA.png`): the same composition (window centred, 0.8 H, dashed line, small pictures on the middle line with the outer one cut by the edge, the words over the left ones, the hint at the foot). Differences: our frame is 4:5 (Oryzo's is 0.77), the light ground, the grotesk of the site's body (Hanken) instead of Halyard.
- 1706x950 (three places) and 390x844 (the rise, rests on frames 0, 1 and 9, the growth): the words stand above the frame on the phone, the frame is 296 px wide, the small pictures peek at both sides, the pair sits clear of the hint at the bottom right.
- Real wheel (`wheel.cjs`): a stop at 40 percent of a turn finishes it forward (to the next frame's rest), a stop at 64 percent going up goes back, 3.4 screens in one wheel lands on the rest after zone 4 (Lesley); a stop in the lead stays where the glide ends (no snap there: the descent has none). A real touch drag by CDP (`touch.cjs`) on the phone: 0.48 screens finishes forward to Fanny, 0.18 of a turn goes back.
- Mouse: the frame lifts 6 px and 1.2 percent, the "Click to view" label shows, a click opens the whole picture (aria-label "Obsidia, the whole picture"), Escape closes it. Keyboard: the button of frame 3 takes the focus, the page moves to its rest (Angela), a magenta focus ring stands around the frame, Enter opens the picture. No console error in any run.

## 8. Calls made without the owner

- Frame ratio stays 4:5 (the posters and the loop windows are cut for it).
- The words use the grotesk of the body (`--font-body-stack`), upright, not the condensed display italic: it reads like Oryzo's heading. Change it in `list.module.css` (`.title`, `.name`, `.cue`).
- The pastel sky inside the last frame (Selena's own ground, the same as her section) is kept: it is her frame, not a per-character background.
- On a phone the block is centred between the bar and 0.8 H, so the pair at the bottom right has room. That leaves about 85 px above the heading.

## 9. Seen, not mine

- A seek straight into the growth at 9.0 (a jump, not a scroll) shows the drone at the upper left and the doll still at the dock: `pair.ts` keeps `held` from the frame the doll was last seen, so a jump past the carry shows her appearing from the dock. Stepping through the growth in 0.08 screens shows the carry right. At 8.9 the doll is not visible on the drone for a frame (the drone is over Selena).

## 10. Not done

- A click on a small picture to jump to its frame (the small pictures take no pointer).
- The masked line roll of the name (the old and the new name are two faint lines for a moment mid turn). The buttons live inside the names' box, so clipping it would cut them.
- Oryzo.ai was not filmed live: the 18 Nov recon (`ref-oryzo.md` and its 50 px step sheet) stood in for it.
- The production build, a weak machine, Firefox and Safari, a real phone fling.
- `layout.test.ts` was rewritten but not run (only `timeline.test.ts` was). `scripts/qa/probes/home-s4a.cjs` still names the old selectors.
