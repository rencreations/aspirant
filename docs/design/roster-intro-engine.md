# The roster intro engine

The opening of `/character`. Up to 2.8 s it copies the owner's recording (`transitions.mov`, 9.5 s at 60 fps) in the browser, with no video of the transition itself. From 2.8 s to 4.2 s the ending is our own: the owner asked for a deliberate hit, not the recording's laser. The spec of the whole job is [roster-intro.md](roster-intro.md). This file is about the engine.

## The ending, 2.8 to 4.2 s

One impact point, the middle of the page's red slash (read from the DOM, never fixed), and one story: charge, hit, boom, reveal.

| Time (s)     | What happens                                                                                                                                                                                                                                                                                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.80 to 2.88 | The charge. Thin white and red lines are drawn in toward the impact point, each picture smaller than the last (stepped on 30). The black and white stripes still cross the panels.                                                                                                                                                                                    |
| 2.88 to 3.00 | A hard cut to dark maroon. The roster is a faint ghost. A seed of white-hot light grows at the impact point inside a crimson glow, and it pulses three times (anticipation).                                                                                                                                                                                          |
| 3.00 to 3.16 | The impact frames. Obsidia's cut-out as a hard silhouette, full screen: black on white, white on black, black on white, white on crimson, crimson on white. Each is bigger than the last and thrown to another side (shake). Ink lines stream out from the point.                                                                                                     |
| 3.16 to 3.20 | A hard cut to white with the seams of a sheet of glass showing in it (a few hundred slanted shards, the same lean as the panels).                                                                                                                                                                                                                                     |
| 3.20 to 3.85 | The boom. The glass breaks from the impact point outward, each shard spinning, then falling and fading, and the real page is under it. A white-hot core, two shock rings, a fire that opens fast (the `fire` still), 160 embers, and the page's slash flares and flickers. The whole page recoils: thrown a few pixels at 30 pictures a second, and settles in 0.6 s. |
| 3.20 to 4.20 | Obsidia on the real page, in the box of her own panel: white-hot with a rainbow edge, then her welcome clip plays, then her splash comes in, then the canvas panel is let go (opacity) so the page's own frame and name show.                                                                                                                                         |
| 4.20         | The page gets `data-intro="done"`: the logo block arrives by the roster's own CSS. The canvas is removed at 4.3.                                                                                                                                                                                                                                                      |

The beams, the thin beam and the black arcs of the recording are no longer used. Their files in `public/img/roster-intro/` (`beam-*.webp`, `ring-arcs.webp`) can be deleted when nobody wants the old ending back.

## Structure

All of it is in `apps/web/src/features/character/roster/intro/`.

| File                                               | What it does                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `timeline.ts`                                      | A pure function `sceneAt(t, out)`: what every layer does at `t` seconds. It allocates nothing when given `out`. The unit tests are in `timeline.test.ts`.                                                                                                                                                                                                                                              |
| `script.ts`, `script-burst.ts`                     | The beats of each panel (the first panel, the burst, and Obsidia's reveal on the page). A beat sets values from its time on and they hold, which keeps the recording's stepped feel.                                                                                                                                                                                                                   |
| `geometry.ts`                                      | Panel corners from the roster's own `SLOTS`, the intro's view (scaled to the window height), and the boxes of the real page (Obsidia's panel, the slash centre) read from the DOM.                                                                                                                                                                                                                     |
| `gl/renderer.ts`                                   | One WebGL2 canvas. Programs: ground, wedge, panel, sprite, hit, glow, shards, embers. A unit quad, plus two small vertex buffers (glass and embers). No per-frame allocation.                                                                                                                                                                                                                          |
| `gl/shaders.ts`                                    | The GLSL. The panel shader does the slanted shape, the slit opening, the impact frame, the glow, the rainbow fringe, the prism flare and the stripes. `HIT` is the full screen silhouette. `GLOW` is the glow, the ring and the hot core. `SHARD_*` is the glass: each shard's flight is worked out in the vertex shader from its own centre. `EMBER_*` are the embers (points, added to the picture). |
| `controller.ts`                                    | Loads the pictures and clips, warms the shaders, waits for the loading curtain, runs the loop, applies the page recoil, handles skip, frees everything. Exposes `window.__rosterIntro`.                                                                                                                                                                                                                |
| `roster-intro.tsx`, `roster-intro-lazy.tsx`        | The component and its `next/dynamic` mount (the page imports only the lazy one).                                                                                                                                                                                                                                                                                                                       |
| `roster-cover.tsx`, `cover.ts`, `cover.module.css` | The black cover (see below).                                                                                                                                                                                                                                                                                                                                                                           |
| `preload-items.ts`                                 | The loading list entries: the code chunk, the stills, Obsidia's cut-out and the clips (none for a visitor who will not see the intro). It must not import the renderer.                                                                                                                                                                                                                                |
| `mode.ts`                                          | `off`, `light` or `full` from reduced motion, `?intro=off`, the route the visitor came from, WebGL support and the performance level.                                                                                                                                                                                                                                                                  |
| `clips.ts`, `stills.ts`                            | The clip table and the still table (the speed lines, the slash, the fire) and Obsidia's cut-out.                                                                                                                                                                                                                                                                                                       |

## When it plays

It plays on a fresh load or refresh of `/character`, and when the visitor comes from another page of the site (the home page, the story, the collection). It does not play when the visitor comes from one of the characters' own pages (`/character/selena/` and the rest, with their about, skills and gallery pages): there is no canvas and no cover.

`lib/route-history.ts` keeps the last two routes, and `components/transition/transition-provider.tsx` notes each route it shows. `routeBefore("/character")` gives the page the visitor came from, whether it is asked while the page change starts (the loading list) or after (the page).

## Black from the first paint

When the intro will play the visitor sees black from the very first paint, with no frame of the roster page before it.

- `RosterCover` is the first element of the page's markup (the server renders it, so a hard load paints black at once; it is first in the markup because the browser can paint before it has read the end of a page). It is fixed, black, at z-index 45 (the site bar is 50), with its look inline as well as in `cover.module.css`.
- A visit that will not play (reduced motion, no WebGL, `?intro=off`, or a return from a character's page) lets it go in a layout effect, before the first paint of a page change. Reduced motion also hides it by CSS alone, so it never shows.
- The intro hides it once its own canvas is up and drawing black, and again when the intro ends for any reason (the played end, a skip, a failure).
- Failsafe: if the scripts never run, the cover lets go by itself after 25 seconds (a CSS animation, no script needed).
- With the logo curtain: the curtain opens onto black, then the intro starts at its hard cut at 0.7 s (black from 0 to 0.7 s, as the recording).
- The boot script's own light cover (the loader, painted when the scripts are slow) is a separate thing and is not changed.
- `node scripts/roster-intro/first-paint.mjs` records the screen (the browser's screencast, every painted frame) for a hard load and for a page change from the home page, each with the processor slowed 4 times, and fails when a frame of the roster comes before the intro's cut.

## Tuning

- Retime or restyle a panel: edit its beats in `script.ts` or `script-burst.ts`. Every comment gives the moment of the recording.
- The ending: the tracks in `sceneAt` (`timeline.ts`) and the constants at its top (`T_CHARGE`, `T_DARK`, `T_HIT`, `T_FLASH`, `T_BOOM`, `T_CLEAR`). The five impact pictures are the `steps` tracks of `hit`. The recoil is `shake` (amplitude 16 and 11 px, 0.6 s). The glass is `buildShards` in `gl/renderer.ts` (size, jitter) and `SHARD_VERT` in `gl/shaders.ts` (delay, speed, spin, fall).
- Where the first panel stands and how steep the lean is: `ANCHOR` and `REF` in `geometry.ts`.
- Clip crop: `clipRect` in `geometry.ts` (the 1.45 factor) and `focus` in `clips.ts`.
- Look of an effect: `gl/shaders.ts`.

## Speed

The ending is shader work and one transform. The page recoil moves the roster's root with a transform only, and the root is promoted to its own layer (`will-change: transform`) a little before the boom, while the picture covers it, so a recoil step costs the compositor only. Without that the page was painted again at every step and frames took 50 to 100 ms. Measured on the dev build at 1920x1080 with `?introDebug`: 60 fps for the whole intro except one or two frames at the very start (the canvas being made).

## Checks

- `?introT=<t>` freezes the intro at `t`. `?intro=off` skips it. `?introDebug` reports GL errors, the reason a renderer failed to start, and the frames whose own work took over 4 ms (`window.__rosterIntro.slow`).
- `window.__rosterIntro = { seek(t): Promise, play(), duration, state }`. `seek` resolves after the clips have reached their frame and the canvas is drawn.
- `node scripts/roster-intro/compare.mjs [--times 1.0,2.5] [--out DIR]` saves the site frame, the reference frame and a side by side image for each time, and sheets of a few. It needs the dev server on 3100, Chrome and ffmpeg. Past 2.8 s the reference is only a guide: the ending is our own.
- `apps/web/e2e/roster-intro.spec.ts` runs against a site address (`E2E_BASE_URL`). It covers the skip paths, the canvas and the cover, "from the home page it plays" and "from `/character/selena/` it does not". The shared helper `skipGate` also sets `sessionStorage aspirants:intro = "off"` so other specs never meet the intro; pass `{ intro: true }` to let it play.

## Rules kept

The intro starts when the curtain has opened, ends by click, tap or Esc, is skipped for reduced motion and without WebGL, loads no clips on the lite level, calls `expectReady` once its first frame is drawn, sits below the site bar (z-index 45, under `--z-nav`), and at its end removes the canvas, pauses and unloads every clip, frees the textures, clears the recoil and the layer hint, and stops the loop.
