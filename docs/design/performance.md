# Performance

The site must not lag on an ordinary laptop, and it must degrade by itself on a weak one. This is
what that means, how it is kept, and how to check it. Selena's page is the heaviest page (a 60
frames a second picture, drawers with long text, many animations), so it sets the budget.

## The budget

Measured on the production build, with the browser made weak on purpose (`scripts/perf/weak.mjs`):
the CPU slowed 4 times, a 1366 by 768 window, with the GPU on, and again with the GPU and the
video acceleration off. This stands in for a mid-range laptop.

| What                | Target on the weak browser                                 |
| ------------------- | ---------------------------------------------------------- |
| Idle, welcome       | steady frame rate, no frame over 50 ms                     |
| A press             | at least 45 frames a second, no frame over about 130 ms    |
| A page opens, exits | no frame over about 150 ms (the first opening of a drawer) |
| Moving the pointer  | never restyles the whole page (a test guards this)         |

Where it was and where it is, in the same harness (GPU on, CPU slowed 4 times):

|                         | Before                              | After                           |
| ----------------------- | ----------------------------------- | ------------------------------- |
| A press (About)         | 8 to 11 fps, frames 300 ms and more | 45 to 80 fps, worst 180 ms      |
| A page exits            | worst frame 436 ms                  | worst frame about 110 to 140 ms |
| Idle, drawers building  | one frame of 690 ms                 | no frame over 90 ms             |
| Software decoding, idle | 44 fps                              | a steady 60 fps                 |

Your own preview runs the dev server, which is two to three times slower than the production build
on the same machine (a press frame of 1,000 ms against 300 ms). Judge speed on `pnpm build` and
`pnpm start`, not on `pnpm dev`.

## What was wrong, in the order it mattered

1. **The cursor restyled the whole page on every frame.** The cursor marked `<html>` with
   `data-lantern="on"`, and its own scan for `[data-lantern]` elements (the ones it lights up) found
   `<html>`. So it wrote `--mx` and `--my` onto the root on every frame the pointer moved. A custom
   property on the root is inherited by every element, so each write restyled the whole document:
   24 full restyles of 1,670 elements, about 11 ms each, in 1.5 seconds. It also wrote `--lx` and
   `--ly` there, which nothing read. This was on every page of the site.
2. **Script moved things that animate.** The touch points were moved by script on every frame, which
   restyled them and everything animated inside them, about 180 times a second. They are Web
   Animations of `transform` now, run by the browser's compositor.
3. **The press animated `width` and `left`** inside an element with a `drop-shadow` filter, so every
   frame was layout and a redraw of the filter. It animates `transform` only now.
4. **SVG attributes were written every frame**: the sound bars (14 writes a frame while sound is on)
   and the logo in the navigation (four endless tweens). The bars are drawn on a canvas. The logo
   flourishes for two seconds and rests for four and a half.
5. **The drawers were big and always laid out.** The About drawers are 1,100 elements and the story
   is 21 chapters, more than 30,000 pixels. The long blocks use `content-visibility: auto`, the story
   builds a few chapters at a time, the two sides build one after the other, a drawer that is not
   shown is not rendered (`content-visibility: hidden`), and its content is drawn (off screen) in
   the middle of the entrance, not when it slides in.
6. **The first layout of Japanese titles looked for system fonts**, 15 to 25 ms per group of
   characters, all at once. They are laid out a few at a time while she idles (`glyph-warm.ts`).
7. **The loading screen was told about every network chunk**, thousands of times a second, and
   collected chunks in script. The bar is told ten times a second, the browser builds the Blob, and
   at most four big downloads run at once, the videos she starts with first.
8. **Too many video decoders were alive** (14 videos at 4K). A video is attached when needed and let
   go when done. The small loop beside the skill list is at 60 frames a second, because a 30 fps
   video next to the 60 fps picture made the browser draw the whole page at half rate.

## Rules

- Never write a CSS custom property or an inline style on `<html>` or `<body>` per frame. A test
  (`selena.spec.ts`, "never rewrites the style of <html>") fails if it happens.
- Never mark an element with an attribute that a script then selects by (`data-lantern` on `<html>`).
- Animate `transform` and `opacity` only, in CSS or the Web Animations API. Not `width`, `height`,
  `left`, `top`, `margin`. When an animation needs a distance in pixels, measure it once.
- No `filter`, `backdrop-filter` or `mix-blend-mode` over the live picture, and no `filter` on an
  element that has animated children. Use a static shadow element.
- No per-frame writes to SVG attributes. Draw to a canvas, or keep it to a short flourish.
- Script that runs on every frame reads layout first and writes after, or does not read layout.
- Something that follows the video goes on the compositor (a Web Animation whose clock is set from
  the video a few times a second), not a `requestAnimationFrame` loop.
- Long lists and long text: `content-visibility: auto`, built in small slices, off the critical frames.
- Heavy work (building drawers, laying out text, decoding) waits for a moment nothing else moves.

## Performance levels

`lib/perf.ts`. Three levels, written on `<html data-perf>` for the CSS: `full`, `balanced`, `lite`.

- **At the start**, from the device: hardware video decoding (`mediaCapabilities`, `powerEfficient`),
  cores, memory, data saving. A device that decodes in software gets `lite` with fewer than 6 cores,
  `balanced` with fewer than 12.
- **Remembered** (`localStorage`, `aspirants:perf`): a level the governor chose for half an hour (a drop is often a busy page, not the device, and it must not flatten every page for a day), any other for five days. Vexana's page does not step down on its own (`raiseOnly`): its hero is always built (the scene gives up pixels and noise first when frames are slow), and a remembered drop can come back up after half a minute of smooth frames. Its muted pictures run on every level except with data saving on.
- **Overridden** with `?quality=full|balanced|lite`. `?quality=auto` forgets what was remembered.
  The tests pin a level this way.
- **Lowered by a governor** (`startGovernor`) that watches the real frame rate and the video's
  dropped frames while she plays, from the end of the welcome. Two bad stretches of two seconds in
  a row lower it one step, then it waits six seconds. It ignores hidden tabs, and it does not judge
  the frame rate while the picture runs faster to get to a frame (time skip). The same governor
  raises the level: a device that sits below what its hardware suggests (`levelFor`) and plays
  smoothly for twelve stretches in a row (24 seconds) tries one step up, and one bad stretch after
  that sends it back down and stops it trying again (`failedUp` in the memory) until the memory
  expires. A level lowered in a visit is never raised in that visit. This was added because a step
  down used to stick for five days, so one busy moment could keep a fast laptop on a smaller,
  softer picture. When it lowers the level, the smaller videos load in the background, and
  the idle loop is swapped under the cover wipe if she is idling (otherwise the next time she
  returns to it).

What a level changes:

| Level      | Video                                             | Effects                                                                                                                                            |
| ---------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `full`     | the size the display needs, up to 2160            | everything                                                                                                                                         |
| `balanced` | at most 1080                                      | no light disc blend on the cursor, no drift or ripple on the touch points, no bobbing, no drawer shadow, no logo flourish, no loading screen loops |
| `lite`     | the light tier: 1280 by 576 at 30 frames a second | also a press without the jump and the stomp, no breathing on the touch points, the small skill loop does not start by itself                       |

The light tier (`scripts/selena/build.py`, tier `lite`) keeps every other frame of the 60 fps
timeline, so its loops and seams, which are measured in time, work unchanged (the director is tested
with a video that shows every other frame).

## Bad connections

The site is several gigabytes of media, so a poor connection is the normal hard case, not an edge
case. What was measured with `scripts/perf/net.mjs` (the production build, Chromium with the network
limited), before and after the fixes:

| Case                                    | Before                              | After                                                           |
| --------------------------------------- | ----------------------------------- | --------------------------------------------------------------- |
| 1.5 Mbit/s, Vexana's first visit        | the loading screen holds 83 seconds | "Enter now" after 12 seconds, the wait ends at 60               |
| 400 kbit/s, the home page               | 77 seconds                          | 42 seconds, and "Enter now" is there                            |
| The connection drops while loading      | home page empty, console errors     | the page text stays, a calm notice says the device is offline   |
| Offline, a click on a page never opened | a nearly blank page                 | the page stays, the notice shows, "Back online" when it returns |
| A file of an old deploy is gone         | a silent half-working page          | one reload by itself, never a loop, never while offline         |

How it is built:

- `components/loader-gate.tsx`: "Enter now" after 12 seconds, a stop at 60. The files still arriving
  go on and arrive late, and they must not move the curtain once it has started to open
  (`setBoot` overwrites only its own bar: a plain `overwrite: true` killed the animation that opens
  the page).
- `lib/preload.ts` (`capWait`) and the transition provider: a page change waits at most 25 seconds.
- `lib/media-store.ts`: a download that gets no byte for 20 seconds, or ends short of the length
  the server gave, is dropped and the plain address is used (the browser streams it); a file that
  failed is asked for again the next time.
- `components/offline-notice.tsx`, `lib/offline.ts`: the notice, and no navigation to a page that
  was never opened while offline.
- `lib/chunk-guard.ts`, `components/runtime-guard.tsx`: one reload for a stale tab (after a deploy
  the file names change), once a minute at most, and only when online; promises nobody caught are
  logged once each.
- `app/error.tsx`, `app/global-error.tsx`: a page that throws shows a way back, not a blank screen.
- Every page degrades without its media: posters and text stay when the videos, the audio, the data
  or the pictures fail (tested with 404 and 500 answers).

## How to check

- `scripts/perf/weak.mjs`: the weak browser. `FULL=1 node scripts/perf/weak.mjs http://127.0.0.1:3190 gpu 4 1366 768 1`
  runs the boot, the welcome, idle, and a press, a page and an exit for each of the three pages, and
  prints the frame rate and the slowest frames of each. `soft` as the second argument turns the GPU
  and the video acceleration off.
- `scripts/perf/trace.mjs`: a Chromium trace of a press with the style invalidation tracking, and a
  count of the style recalculations by what caused them. This is how the cursor was found.
- `scripts/perf/net.mjs`: bad connections (slow, offline, failing files, a stale tab, the "Enter now" button).
- Serve the production build (`pnpm build`, then `node apps/web/e2e/static-server.mjs --port 3190`).

## What was measured about video

One looping fullscreen video at 1920 by 1080, CPU time of all browser processes (a fast 32-thread
CPU, so every number is a lower bound for a weak laptop):

| Video                | Hardware decoding | Software decoding |
| -------------------- | ----------------- | ----------------- |
| 4K, 60 fps           | 0.23 cores        | 1.77 cores        |
| 2560 by 1152, 60 fps | 0.22              | 0.96              |
| 1920 by 864, 60 fps  | 0.21              | 0.72              |
| 1280 by 576, 60 fps  | 0.22              | 0.52              |
| 1280 by 576, 30 fps  | 0.18              | 0.30              |

With hardware decoding the size hardly matters. Without it the size and the frame rate decide, so
the level follows hardware decoding, and the light tier halves the frame rate.

## Ideas that were weighed and left out

- **More detail on the face and less on the background** (a sharp face video over a softer base).
  It needs two decoders kept in step, which costs more than it saves and drifts, and the numbers
  above say the resolution is not the bottleneck.
- **Videos cropped to what a phone shows.** Phones decode in hardware, so a crop only saves bytes,
  and it would add a second set of videos, a remap of the touch points and more to check.
