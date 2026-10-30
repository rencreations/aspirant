# The roster intro engine

The opening of `/character`. It copies the owner's recording (`transitions.mov`, 9.5 s at 60 fps) in the browser, with no video of the transition itself. The spec of the whole job is [roster-intro.md](roster-intro.md). This file is about the engine.

## Structure

All of it is in `apps/web/src/features/character/roster/intro/`.

| File                                        | What it does                                                                                                                                                                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timeline.ts`                               | A pure function `sceneAt(t, out)`: what every layer does at `t` seconds. It allocates nothing when given `out`. The unit tests are in `timeline.test.ts`.                                                                        |
| `script.ts`, `script-burst.ts`              | The beats of each panel (the first panel, then the burst). A beat sets values from its time on and they hold, which keeps the recording's stepped feel.                                                                          |
| `geometry.ts`                               | Panel corners from the roster's own `SLOTS`, the intro's view (scaled to the window height), and the boxes of the real page (Obsidia's panel, the slash).                                                                        |
| `gl/renderer.ts`                            | One WebGL2 canvas. Programs: ground, wedge, panel, veil, thin beam, sprite. One unit quad, no per-frame allocation.                                                                                                              |
| `gl/shaders.ts`                             | The GLSL. The panel shader does the slanted shape, the slit opening, the impact frame (a luminance threshold with ragged edges), the white glow, the rainbow fringe, the prism flare, the stripes and the line art of the flash. |
| `controller.ts`                             | Loads the pictures and clips, warms the shaders, waits for the loading curtain, runs the loop, handles skip, frees everything. Exposes `window.__rosterIntro`.                                                                   |
| `roster-intro.tsx`, `roster-intro-lazy.tsx` | The component and its `next/dynamic` mount (the page imports only the lazy one).                                                                                                                                                 |
| `preload-items.ts`                          | The loading list entries: the code chunk, the stills and the clips (none for a visitor who will not see the intro). It must not import the renderer.                                                                             |
| `mode.ts`                                   | `off`, `light` or `full` from reduced motion, `?intro=off`, WebGL support and the performance level.                                                                                                                             |
| `clips.ts`, `stills.ts`                     | The clip table and the still table (`tip` is the point of a beam still, `reach` means it must still reach the screen edge on a wide screen).                                                                                     |

## Time line (seconds)

Constants are at the top of `timeline.ts`. `T_BLACK` 0.7, `T_WEDGE` 2.29, `T_BEAM` 2.8 (pink spear and speed lines), `T_HOLD` 2.883 (held leaf on maroon), `T_FLASH` 3.157 to `T_PAGE` 3.257 (white flash, then the real page is under the canvas), `T_OVERLAY_END` 4.2, `T_DONE` 4.2 (the page gets `data-intro="done"`), `DURATION` 4.7. The pan of the board (`SHIFT_KEYS`) is the camera moving along the row while the panels arrive.

## Tuning

- Retime or restyle a panel: edit its beats in `script.ts` or `script-burst.ts`. Every comment gives the moment of the recording.
- Beam, wedge, speed lines, flash, fire, arcs, veil: the tracks in `sceneAt`.
- Where the first panel stands and how steep the lean is: `ANCHOR` and `REF` in `geometry.ts`.
- Clip crop: `clipRect` in `geometry.ts` (the 1.45 factor) and `focus` in `clips.ts`.
- Look of an effect: `gl/shaders.ts`.

## Checks

- `?introT=<t>` freezes the intro at `t`. `?intro=off` skips it. `?introDebug` reports GL errors and the frames whose own work took over 4 ms (`window.__rosterIntro.slow`).
- `window.__rosterIntro = { seek(t): Promise, play(), duration, state }`. `seek` resolves after the clips have reached their frame and the canvas is drawn.
- `node scripts/roster-intro/compare.mjs [--times 1.0,2.5] [--out DIR]` saves the site frame, the reference frame and a side by side image for each time, and sheets of three. It needs the dev server on 3100, Chrome and ffmpeg.
- `apps/web/e2e/roster-intro.spec.ts` runs against a site address (`E2E_BASE_URL`). The shared helper `skipGate` now also sets `sessionStorage aspirants:intro = "off"` so other specs never meet the intro.

## Rules kept

The intro starts when the curtain has opened, plays on every arrival, ends by click, tap or Esc, is skipped for reduced motion and without WebGL, loads no clips on the lite level, calls `expectReady` once its first frame is drawn, sits below the site bar (z-index 45, under `--z-nav`), and at its end removes the canvas, pauses and unloads every clip, frees the textures and stops the loop.
