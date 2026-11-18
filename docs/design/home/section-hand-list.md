# Home sections: the hand and the list (workstream S4a)

Selena's hand with the doll (`hand`, 17.9 to 21.3) and oryzo's character list (`list`, 21.3 to 29.9), written as one choreography. Request: "Hand section" and "Characters list" of `docs/superpowers/specs/2026-11-18-home-page-request.md`; reference: `docs/design/home-reference/ref-oryzo.md` (sections 5 to 9). Code: `apps/web/src/features/home/sections/hand/` and `sections/list/`. Probe: `node scripts/qa/probes/home-s4a.cjs <out>`.

## 1. The one rule: two runtimes, one carry

The two sections share the hand and the doll, which are driven by one object, `Carry` (`hand/carry.ts`). `Carry.apply(t, frame, withDoll)` sets the whole state of both actors for `t` screens since the start of the hand section. The hand section calls it with its own scroll (`t = local * 3.4`), the list with `3.4 + s` (`s = local * 8.6`), so in their overlap (the hand's tail and the list's lead, half a screen) both give the same `t` and there is no seam. It is a pure function of `t` plus three pieces of state that follow from it: which socket the doll hangs under, the last two `t` (a one shot, the landing's puff and bump, fires on a forward crossing in a small step and never in a replay after a jump), and the pointer (the doll looks at it).

`ensureCarry(ctx)` builds it once per page (a `WeakMap` on `ctx.actors`): the hand first (its update runs before the doll's, so a doll in the palm is never a frame late), then the doll, then the comic marks (a nicety: a failure leaves the choreography whole). **Both runtimes are built at once, without waiting for it**: the words, the strip, the loops and the viewer work at once, and the actors join when the carry resolves (`setCarry`). A jump into either section before the hand and the doll have arrived shows the frames and the words and no actors, never a half built page. The actors are built when the page is idle (`hand/idle.ts`: `requestIdleCallback`, at the latest after 1.2 s for the hand and the doll and 3 s for Selena), so the long task of building them falls between two scroll events when the visitor pauses. Every word is hidden by a rule under `:global(.js)` until the runtime shows it.

## 2. The beats

Screens from the start of the hand section (`hand/timeline.ts`: `HAND_AT`, `LIST_AT`, all in one place, all pure and tested).

| t (screens)     | what                                                                                                                                                                                                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| -0.5 to 0       | the hand's fingertips come to the bottom edge (a rise of 0.13). The doll is the bolt section's (J6)                                                                                                                                                                                     |
| 0 to 1.0        | the palm rises (`hand.rise`, smooth). The doll goes on falling from J6 (hips as the pivot, depth 60, pose 0.7 from "fall" to "stand", a little flail that peaks at the middle) to the palm, with the size, the depth and the pose reaching the standing doll                            |
| 1.0             | she lands: `hand.impact`, `doll.bump`, a puff of comic marks, she attaches to `hand.socket("stand")`                                                                                                                                                                                    |
| 1.0 to 1.9      | she stands up (1.1 to 1.45) and sits down (1.45 to 1.9). Faces: gloom, scared, shocked, dizzy, then a smile                                                                                                                                                                             |
| 1.5 to 2.4      | "2022 - Present" in letter by letter (oryzo's stagger), the small line, then the hint "Try to hover" with its dash drawing and a hand icon that waves                                                                                                                                   |
| 2.0 to 2.4      | the fingers go live: the pointer moves them (`setReactivity` 0 to 1), a press closes them to a cup, hover ripples, the doll looks at the pointer, hops on hover, squeaks and spins when pressed (all the actors' own)                                                                   |
| 2.75 to 3.4     | the hand comes down 0.08 H and the words are left behind above: the block rises away (0.22 H) and fades                                                                                                                                                                                 |
| 3.4 (s 0)       | the frame of the list has arrived in the lead (s -0.3 to 0.1) behind the hand, with its dashed chrome and the title "Characters"                                                                                                                                                        |
| s -0.08 to 0.14 | the doll stands in the palm and crouches (squash)                                                                                                                                                                                                                                       |
| s 0.14 to 0.62  | the hand flicks (a quick close and open) and the doll is tossed on a parabola to the top edge of the frame, right of its middle, stretched and flailing, and sits there with her legs over the edge, in front of the picture (`dangle`)                                                 |
| s 0.3 to 0.95   | the hand sinks out of the bottom (`hand.sink`)                                                                                                                                                                                                                                          |
| s 0.55 to 0.95  | the first name comes in at the left, under "Characters"                                                                                                                                                                                                                                 |
| s 1.05 + 0.62 k | frame k stands at rest (a tenth of rest, eight tenths of sineInOut motion, a tenth of rest: oryzo's step); the picture arrives rotated 10 degrees at 1.2 times and settles, the one leaving rolls to -10 and grows. The name changes by a slide                                         |
| s 6.63          | Selena's frame (the tenth) is in the window: she is drawn live in the stage through the 4:5 window (`clipRectangle`), in `city_interaction_R_loop`                                                                                                                                      |
| s 7.0 to 8.05   | the window grows into the whole screen (eased), carrying the sky and Selena (`frameFor` to `selenaEnd`). The loop comes round, `playRelease` plays `back_R` and goes on to `city_idle` by itself. The doll stands as the edge rises, takes hold of the top edge and hangs (`doll.hang`) |
| s 8.05 to 8.6   | rest: Selena in `city_idle`, the doll hanging, the sky full                                                                                                                                                                                                                             |
| s 8.6 to 9.1    | the section's tail: nothing moves; the sky fades over it (the section after the list draws its own)                                                                                                                                                                                     |

## 3. Files

```
sections/hand/   index.ts (3.4 screens, lead 0.5, tail 0.5, storm), view.tsx (the owner's words, the hint), hand.module.css,
                 preload.ts, runtime.ts (the words), carry.ts (the actors, both sections), faces.ts (the doll's mood line),
                 timeline.ts (all beats, geometry, J6; pure) + tests
sections/list/   index.ts (8.6 screens, lead 0.5, tail 0.5, storm), view.tsx, list.module.css, preload.ts, runtime.ts (strip, words,
                 buttons, Selena's frame), frames.ts (the nine pictures, equal to picks.json), layout.ts (the window, the fits),
                 loop-video.ts (one muted loop, one play promise at a time), viewer.ts + viewer.module.css (the open view),
                 selena-frame.ts (the shared end state for the next section) + tests
content.ts       HAND, LIST (the owner's words, already there; unchanged)
scripts/qa/probes/home-s4a.cjs
```

## 4. Loading

All deferred (the hand is 18 screens down). In the order the scroll reaches them (priorities 31 to 46): the doll (`dollItems`), the hand (`handItems`), the list's code chunk, the ten 4:5 stills, the seven loops (about 10.7 MB, whole through the media store, saved in the browser), Selena's model and cameras (`selenaItems`), then what only a press needs: the whole picture of each frame (7 posters, 2 library pictures). A visitor who gets here first: the section is built at once, the frames show their stills (never a different page), a loop is asked for as urgent when its frame is within 1.2 places of the window, and the doll and the hand arrive when the media store has them. No `expectReady`: the sections only run once the page is open.

## 5. Interactions

- **The hand and the doll**: the actors' own (`actor-hand.md`, `actor-doll.md`). The hand has no label; the doll's cursor is POKE. The hint is the section's. Touch: the hand follows a finger that is down.
- **The frame**: one `<button>` per picture, in the DOM right after the name of its frame (name 0, button 0, name 1, button 1, ...), laid over the window. Never `disabled` (it would leave the tab order): `aria-disabled` is "false" only for the frame that stands in the window and has stood still for a moment. A press opens the viewer for that frame. Focus on a name or on a button brings its frame to the window (`ctx.scroll.to`, two frames later, because a control of a section the page is not at makes `home-stage.tsx` jump to the middle of the section first; a section built after that jump looks at the focused control on its first frame and goes to its frame). The names are real links to the Aspirants' pages. The cursor over the window says "Click to view" (`data-cursor`).
- **The viewer** (`viewer.ts`): a dialog on `document.body` (`role="dialog"`, `aria-modal`), the whole picture contained with margins (9 percent of the smaller side, at least 24 px), a close button, a backdrop. It opens from the frame as it stands: the window grows to the picture while the picture goes from the crop to the whole, through the chapter morph's nested clips (`story/morph/morph-math`): transform and opacity only, two keyframes, one easing, 720 ms. A loop continues from where it was in the frame, at the whole picture. Escape, the close button and a press on the margin close it; the focus returns to the button; Tab stays on the close button; the page is held while it is open (`ctx.scroll.hold`).
- **Selena's frame**: her touch targets answer only while the pointer is over the window she is drawn in (or once the frame has grown to 0.85), so nothing reacts where she is not drawn.

## 6. End states (the joints)

Stage pixels, y up, origin at the middle of the screen. `H`, `W` the viewport. Numbers at 1440 x 900 / 1706 x 950 / 390 x 844 (`handGeometry`, `fallEnd`, `listGeometry`, `selenaEnd`, `dollHang`; all pure and tested).

**J6, the hand at local 0 (t = 0, S 17.9), read from the bolt section's `journey.ts` (`END_HEIGHT` 0.26, `END_FEET_Y` 0.1, `HIPS_ABOVE_FEET`; `timeline.test.ts` fails if they drift).**

- Doll: visible, detached. `place({ x: 0, y: (0.1 + 0.233 * 0.26) H, z: 60, height: 0.26 H, yaw: 0, pitch: 0, roll: 0, pivot: "hips" })` = y 144.5 / 152.5 / 135.5 and height 234 / 247 / 219 px. `setPose("fall", "stand", 0.7)`, flail 0.2 at rate 0.6, no squash, no talk, face `gloom` (the first step of `FACES`, then `scared` from 0.35). Blink on, looks at the pointer (null outside the window).
- Hand: visible, wrist at (0, -H/2) (a phone: (-40, -H/2)), height 0.55 H (a phone 0.6 H, scale 0.85), `rise` 0.13 (the fingertips at the bottom edge), `sink` 0, `setBurden(0)`, `setInteractive(false)`, reactivity 0, grip 0. In the lead (t -0.5 to 0) the hand is set (rise 0 to 0.13) and the doll is not touched: the bolt section's fall owns her.
- The hand section's words: none shown (letters, description and hint at opacity 0).
- Silverbolt, the field, the drone, the logo, Selena: not touched (the kernel hides them).

**J7, the hand at local 1 = the list at local 0 (t = 3.4, s = 0): the same numbers from both sections (one `Carry`, one `t`).**

- Hand: wrist at (0, -H/2 - 0.08 H) (72 / 76 / 67 px below the edge), `rise` 1, `sink` 0, burden 1 (a cup), reactivity 0 and not interactive from s -0.08 (it is interactive from t 2.0 to s -0.08).
- Doll: attached to `hand.socket("stand")` (`keepWorld: false`), `place({ x: 0, y: 0, height: 0.17 H })` = 153 / 162 / 143 px, feet pivot, `setPose("stand", "sit", 0)`, squash -0.087 (the crouch has begun), face `smile`. The palm's stand point is (10, -296) / (11, -312) / (-29, -286) px (measured in the lab).
- The hand section's words: gone (opacity 0, the block 0.22 H above where it was). The list's frame window: arrived (opacity 0.84 and rising), its chrome and the small title "Characters" shown, no name yet.

**List at local 1 (s = 8.6, J8), what the section after it starts from.**

- Selena: visible, drawn through the whole tail. `place` = `selenaEnd(vp)` = (230.8, -20.2, height 745.8) / (273.4, -23.8, 878.8) / (1.6, 127.1, 294.9); no clip (`clipRectangle(null)`); `city_idle`; touch targets on. Her clips run on her own clock: after a fast scroll she may still be in `city_interaction_back_R` at local 1 (it goes on to `city_idle` by itself). **The section after the list must not start her again**: call `play("city_idle")` only when the clip is not already `city_idle` or `city_interaction_back_R` (`sl.clipState()`).
- Doll: visible, detached (a world `place`), `setPose("sit", "stand", 1)`, `hang(1, 1)`; her hand on the top edge of the screen at `dollHang(vp)` = (-172.8, 427.5) / (-204.7, 451.3) / (124.8, 400.9), height 148.5 / 156.8 / 126.6 px (0.165 H, a phone 0.15 H). She hangs between the drawer's words (the drawer's share is 0.315 W) and the bar's logo. Face `determined`.
- Hand: hidden (sink 1). Hit target of the hand off.
- The sky: the full screen, `SKY` of `selena-frame.ts` (a dusk blue), in the list's below layer, opacity 1 at s 8.6, fading to 0 over the tail (s 8.6 to 9.1). The next section either draws the same sky in its own layer or lets this one dissolve; the ground behind is `storm` (#05070c).
- DOM: the window, the title, the names and the buttons are gone (opacity 0, buttons `aria-disabled="true"`, no pointer events).
- What the next section imports: `selenaEnd`, `selenaFree`, `dollHang`, `DRAWER_SHARE`, `SKY` from `sections/list/selena-frame.ts`.

## 7. Numbers to tune

`hand/timeline.ts`: `HAND_AT`, `LIST_AT`, `handGeometry` (height 0.55 H, a phone 0.6 H with scale 0.85 and a step of -40 px, the drop 0.08 H, the doll's size 0.17 H on the palm), `J6` and `HIPS_ABOVE_FEET`. `hand/carry.ts`: `SEAT_DROP`, `ARC` (the toss's height), `TOSS_FLICK`. `list/layout.ts`: the window (0.70 H tall, centred 0.58 H down), the doll's seat. `list/selena-frame.ts`: `DRAWER_SHARE`, `SKY`, the fills, `dollHang`. `list/viewer.ts`: `DURATION`, the margin.

## 8. Calls made without the owner

- **The lengths stay 3.4 and 8.6.** `kernel/layout.test.ts` pins the starts of every later section; a longer hand section would move them. The interactive rest of the hand (fingers live, doll sitting, no motion) is 0.35 screens at 2.4 to 2.75 and the hand stays live through the start of the drop and the list's first 0.14 screens. If the owner wants a longer rest, the integrator can give the hand up to 4.25 screens.
- **J7, "the hand has sunk to 0.3 of the screen height from the bottom", is read as a small drop of 0.08 H.** A drop of 0.3 H would take the palm, and the doll on it, below the bottom edge (the palm is 0.17 H above it at rest). The owner's own words are "come down for a bit". The wrist ends 0.08 H below the edge, the palm about 0.09 H above it.
- **"The hand will place the doll on the frame" is a toss**: the frame is 0.7 of a screen above the hand, which cannot reach it. She crouches in the palm, the hand flicks (a quick close and open), she flies a parabola to the top edge stretched and flailing, lands with a bump and a puff, and sits. The hand then sinks out.
- **The text stays above and leaves**: it holds while the hand goes down, then rises 0.22 H and fades as the frame arrives (a frame that arrives under it would overlap the title).
- **The name of the frame is at the left, under the title "Characters"** (oryzo's "SO PORTABLE," and "it's wearable" arrangement), above nothing else. The owner wrote "in the left".
- **The frame is 4:5**, 0.70 H tall, centred 0.58 H down (oryzo's is 85:110 and 0.8 H). The room above it is where the doll sits under the bar.
- **No side thumbnails and no drawing in of the dashed chrome.** Oryzo has both; the owner asked for the frame and the strip. The chrome (a dashed square, a dot at the top right) is there, static, and fades as the frame grows.
- **The frame's sky** is a dusk blue gradient (`selena-frame.ts` `SKY`), a DOM layer under the canvas. The owner left the background of Selena's scene to us. The section after the list draws the same sky or lets this one fade over the tail.
- **The 3D frame gets her standing pose** (`city_interaction_R_loop`, the hands at the mouth) fitted to the 4:5 window, her far claws cropped on purpose (`POSE_FIT.hands`). In the full screen state she is `city_idle` fitted to the free area right of the drawer (`selenaEnd`).
- **The doll's "hang" is the actor's fake** (a stretched arm, a mitten above the hair, a roll about the hand; `actor-doll.md`). It does not grip. Her hand is on the top edge of the screen, between the drawer's words and the bar's logo (`dollHang`).
- **A still has a slow push** (a Ken Burns of 7 percent) while it is the frame in the window, because no motion exists for Fanny and Layla in the owner's folders (`media.md` section 7).
- **The cursor label over the window is "Click to view"**; over the open view the close cursor is "Close".

## 9. Not verified, not done

**Looked at and measured (dev server on 3100, real Chrome, real GPU, headless, 1440 x 900, 1706 x 950 and 390 x 844).** Frame sheets of both sections at 21 positions per size (`probe2` of the run; the probe is `scripts/qa/probes/home-s4a.cjs`), a real wheel from 0.6 screens before the hand to the end of the list (60 and 90 px steps) with frames taken on the way, the joint J6 as two frozen frames on either side of the hand's start (the doll, the pose and the face are the same; only the bolt section's streak mark differs), the loops (one plays, for the frame in the window; the others stay paused), the viewer by mouse, keyboard and touch. The probe passes 15 of 15 checks with no console error: the pointer over a fingertip hits the hand, over the doll hits the doll, one open button is live over a 4:5 window with the cursor "Click to view", a click opens the dialog, the page does not scroll while it is open, Escape closes it and gives the focus back, a press on the margin closes it, real Tab presses go name 0, button 0, name 1 and bring the strip to frame 1, Enter opens, Selena and the doll are drawn at the end of the list, a tap on a phone opens it and a tap on the margin closes it. Frame times over the wheel run: median 16.7 ms, p95 16.8 to 16.9 ms, p99 17 ms once the actors were built.

**Not done, cut, or not verified.**

- **One-time stalls while the actors are built**: in the dev server on a busy machine the wheel run showed one frame of 0.55 to 0.8 s where the hand and the doll are built (about S 17.3) and one of 0.8 to 1.2 s where Selena is built (about S 19.4 to 19.7), and a few of 67 to 133 ms. They are single long tasks (parsing a model, compiling programs, sending pictures) of the actors' `ensure` functions, which the actors' notes already call "compiled and uploaded before it resolves". Building when the page is idle keeps them out of a pause in the scroll; a visitor who never pauses pays them at the timeout. Not measured on the production build, which is 2 to 3 times faster in JS.
- The cost of the section's own `update` (the carry, the strip, the words) was not read; the actors' own costs are in their notes (hand 0.04 ms, doll 0.11 to 0.19 ms, Selena 0.25 ms). The section writes about 40 style properties a frame through `put` (only when a value changes), allocates nothing per frame except template strings.
- **Cut**: oryzo's side thumbnails and the dashed chrome drawing itself in; the entry roll and zoom of the 3D frame matching the DOM seam (the 3D frame enters in the strip like the others, without the 10 degree roll); a growth of the Selena card (her still) when her model has not arrived by the time the frame grows (the window then shows her card and fades out at the end, the sky stays, and the section after the list shows whatever it shows); a gyro on touch; a scroll snap (`useScrollSnap`) on the frame's growth (the owner's one second settle rule applies to joins; the list has none of its own).
- **Touch on the hand and the doll** was not tried with a finger (the touch run only tapped the list); the actors' notes say a finger drives the hand while it is down.
- The doll's **landing puff and the seat puff** fire on a forward crossing of a small step (a wheel, a key, a link's smooth scroll), never after a jump; a smooth scroll that passes through them (a name link from far away) fires them on the way.
- **Resize with the viewer open** closes it (a layout for the old size would be wrong); resizing the page with the list on screen re-lays the strip on the next frame (looked at once in a probe; not in a frame sheet).
- **A press of the doll's feet** over the first 9 px of the frame's top edge goes to the open button, not to her (DOM controls win over 3D, by the kernel's rule).
- The marks of the bolt section (the white streaks and the grey clouds at its air) stay on the screen in the hand section's first frames after a jump (a frozen probe frame at hand 0 and 0.5 shows them). They are the bolt section's; with a real wheel they were not seen to stay beyond the hand's start. Reported, not touched.
- The selena section (S4b) was a stub with a label while this was written and began to draw its words in the list's tail during the run: the two overlap for the half screen of the list's tail (the sky, Selena and the doll are mine until the end of the tail, the words are theirs).
- Firefox, Safari, a real phone, a weak machine, the production build, a slow connection (the loading order was written, not watched through the bar), the text zoom, context loss with the hand and Selena on screen.
- The **hover curl** of the hand and the doll's hop were checked by the hit target and by looking at one frame each in the earlier run (`D:
enaspirant-workhomeS4ashotsi-*.png`), not as a sequence.
