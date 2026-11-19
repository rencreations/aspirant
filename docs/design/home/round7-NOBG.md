# Round seven, NOBG: no dynamic background after the character page (20 Nov 2026)

Request (word for word in `docs/superpowers/specs/2026-11-20-home-feedback-7-request.md`): "remove ALL dynamic background below the character page and just use normal background."

## API

None. This part only removes things. Nothing new is exported and nothing in it needs a call from another helper.

What the other helpers can rely on:

- The sections after the list (selena, voices, music, funny, chase, bend, archive, footer) never call `backdrop.set`, never `warm` a shader and never wait for one in `ready()`. The ground behind them is the plain daybreak ground with its dots (`bg: "daybreak"`).
- The Selena section has no sky of its own any more: no pastel dawn, no stars, no four point star. Whatever sits behind her in the 3D scene (the skybox of SEL-camera-sky) is part of the scene, not of the page. Its drawer (a pale panel with the words), its `white` and `front` layers are untouched.
- The DOM hooks `data-selena-sky`, `data-selena-stars` and `data-selena-star` are gone. The hooks the out animation may need (`data-selena-white`, `data-selena-front`, `data-selena-drawer`) are still there.

## What was removed

| Section | Removed                                                                                                                                                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| selena  | The aurora call and its colours, the warm, `backdropOn` and `warmed` (`ready()` is `built` now), the list's pastel sky element, the stars, the four point star, the radial lights inside the drawer glass (`.lights`), `stars.ts` and `stars.test.ts`                          |
| voices  | The waves call and the warm (`ready()` is gone: nothing to wait for)                                                                                                                                                                                                           |
| music   | The gradient blinds call, the warm, and the beat pulse of the backdrop (`readBeat`, `beat`, the analyser bins; the `beat` field of `window.__homeMusic.state()`). The gramophone, the records, the notes and the sound are untouched                                           |
| funny   | The soft aurora and the light rays (`drawSky`) and the warm                                                                                                                                                                                                                    |
| chase   | The speed lines, the soft sky and the halftone (`chase/backdrop.ts` and its test) and the warm                                                                                                                                                                                 |
| bend    | All nine backdrops: the four element backdrops, the wall's soft aurora, the ring's iridescence, the spiral's aurora, the particles and the comic's halftone (`bend/backdrop.ts` and its test, the warm, `ready()`); three assertions of `plays.test.ts` that read `backdropAt` |
| archive | The squares grid and the calm iridescence (`archive/backdrop.ts` and its test), the warm, `ready()`. Second pass: the teal pool and the beam under the drone (the two elements, their CSS, the `--glow` write, `light()` and its constants in `archive/runtime.ts`)            |
| footer  | The iridescence call, the warm, and the pink pool of light behind the drone's ring (its element, its CSS and its per frame write)                                                                                                                                              |

`sections/backdrops.ts` has no entry for these sections (it covers the hero to the strip only), so it is unchanged. The engine, `fx/backdrop` and the first four sections are untouched: the strip keeps its mist.

## What was kept on purpose

- The drawer's pale glass and grain, the cards, the lines and the buttons.
- The voices' picture placeholder gradient (`.fig`, behind the art), the footer card's lip and the archive's veil over the covers that are not lit: they belong to a card, not to the ground.

The first pass kept the archive's pool and beam as content (the light the drone throws on the lit cover). On the second pass I looked at the frame: the pool is a large coloured haze that changes with the room, so it reads as a dynamic background, and the owner said ALL. Both are removed. The lit cover still reads as chosen (full colour and lifted, the others under a veil) and the drone rests above it. To bring the light back, restore `.pool`, `.beam`, `light()` and the `--glow` write from git history.

## Checked

Real Chrome, the dev server, `window.__home.seek` to 27.5, 28.5, 29.8, 31.5, 34, 37.5, 41.5, 46, 50, 52.5, 55.5 and 57.8 screens. At every one the backdrop's canvas is `visibility: hidden` and the `backdrop` actor is not visible. Also looked at 1440 by 900 at 33.5, 36.5, 38.5, 40.5, 42.5, 44.5, 48, 53.5 and 57.8 and at 390 by 844 (touch) at 28.5, 31.5, 34, 37.5, 46, 52.5, 55.5 and 57.8: plain ground, legible words, the drones and Tetra read well on it. Second pass (re-checked, not trusted): a new probe (`D:\aspirant-work\home\NOBG\probe.cjs`) seeked to three stops in every section after the list at 1440 by 900 (27 frames) and to ten stops at 390 by 844. At every stop the backdrop canvas is `hidden`, the `backdrop` actor is not visible and the console has no errors. Contact sheets (`d1.png`, `d2.png`, `d3.png`, `a1.png`, `m1.png`) are in `D:\aspirant-work\home\NOBG\`. The filtered `tsc --noEmit -p apps/web` is clean.

A note for whoever measures this: `window.__home.lab("backdrop")` pins the backdrop actor visible, so a probe that calls it shows the last kind for ever. Read the canvas visibility and `state().actors` instead.

On a jump (`seek`) the passed sections (the aspirants) are replayed once before the kernel hides every actor, so the silk of the rows is asked for one frame and never drawn.

## Not done

- `stageTop` (`archive/route.ts`) is used only by its test now (the footer's pool was its last caller). A cleanup pass may drop it.
- The old section notes (`section-selena.md`, `fx-backdrop.md` and the other section notes) still describe the removed backdrops. This note is the newer word.
