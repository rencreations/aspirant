# Performance

The site must not lag on an ordinary laptop. It does not degrade on a weak one: there is one version
of the site (see "One version" below). This is what the budget means, how it is kept, and how to
check it. Selena's page is the heaviest page (a 60
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

## One version

There are no performance levels. Since 1 Nov 2026 (owner decision) the site is the same full version
on every device and every connection. Removed: `lib/perf.ts` (the levels `full`, `balanced` and
`lite`, the governor that stepped them down, the remembered level, `?quality=`), `lib/device.ts`
(the device tier), `<html data-perf>` and every stylesheet rule and script branch that depended on
it.

- **Video size** comes from the display alone (`pickTier` in `stage/media.ts`: the width the picture
  needs in device pixels, taken when a tier reaches 82 percent of it, 76 percent from 2560). Data
  saving, the connection class, the memory, the cores and touch never lower it. The 1280 by 576
  tier at 30 frames a second (`lite` in `scripts/*/build.py`) is never chosen.
- **Muted pictures** on Vexana's and Guinevere's pages play by themselves on every device.
- **Reduced motion** is ignored (no `prefers-reduced-motion` rule, no toggle). This costs
  accessibility for visitors who ask their system for less motion. It was weighed and accepted by the
  owner.
- **A weak device or a slow link waits behind the loading screen** until everything is loaded (see
  below). It is never given less.
- Because nothing is switched off, every effect has to be cheap for everyone: transform and opacity
  only, the compositor for anything that follows a video, `content-visibility: auto` for long
  content. Judge it with `scripts/perf/weak.mjs`, which makes the browser weak on purpose.

## Bad connections

**One version only. A slow connection waits behind the loading screen** (owner decision, 1 Nov 2026). The site is several gigabytes of media, so a poor connection is the normal hard case. It is never given a cut, plain or partial page. The first loading screen and every page change wait until everything the page needs has arrived, however long that takes, and show the real progress while they do.

What a visitor meets:

| Case                                    | What happens                                                                                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A slow connection                       | The loading screen stays up. After 15 seconds a note says the connection is slow and shows the real percentage and bytes. There is no "Enter now" and no limit. |
| A download stalls or drops              | It is started again after a short wait (1 s growing to 10 s), for as long as it takes. The bar never goes back.                                                 |
| The connection is lost while loading    | The loading screen keeps waiting, says "Offline. Waiting for the connection.", and goes on by itself when it returns.                                           |
| Offline, a click on a page never opened | The page stays, a calm notice shows, "Back online" when it returns.                                                                                             |
| A file the server says is gone (404)    | Skipped and logged: nothing can fix it, and it must not hold every visitor for ever.                                                                            |
| A file of an old deploy is gone         | One reload by itself, never a loop, never while offline.                                                                                                        |

How it is built:

- `app/layout.tsx` and `styles/base.css`: the boot script paints a cover (the wordmark, a sweeping
  line and notes that change after 15 and 90 seconds) the moment the page arrives and keeps it until
  the scripts have started. Before this the plain server text showed for as long as the scripts took
  on a slow connection, which looked like a site with no animations. No timer lets it go. Its
  only exit is the reload link it shows after 90 seconds, for a visitor whose scripts have failed.
- `components/loader-gate.tsx`: waits for the whole list. After 15 seconds a note shows the real
  percentage and bytes (`lib/loading-note.ts`); offline it says it is waiting for the connection.
  The files still arriving after the page opens are the deferred ones only, and they must not move
  the curtain once it has started to open (`setBoot` overwrites only its own bar: a plain
  `overwrite: true` killed the animation that opens the page).
- `lib/preload.ts` and the transition provider: an item and a page change wait as long as the files
  need. A page change that takes more than 500 ms shows the loading state with the real percentage.
  `lib/page-ready.ts` has the only time limit left: 30 seconds for a component to say it has drawn,
  counted after every file is in.
- `lib/retry.ts`: a failed or stalled download is tried again after 1, 2, 4, 8, then 10 seconds, and
  waits for the `online` event while the device is offline. Only a 404 or 410 (or a picture that
  arrives and will not decode five times) is skipped and logged.
- `lib/media-store.ts`: a download that gets no byte for 20 seconds, or ends short of the length the
  server gave, is dropped and tried again; the bytes already in are kept and the rest is asked for
  with a range request (the whole file again if the server cannot give a range). The plain address
  is given only for a file that is gone. Until a file has arrived the browser streams the plain
  address, so a clip asked for early still plays.
- `components/offline-notice.tsx`, `lib/offline.ts`: the notice, and no navigation to a page that
  was never opened while offline.
- `lib/chunk-guard.ts`, `components/runtime-guard.tsx`: one reload for a stale tab (after a deploy
  the file names change), once a minute at most, and only when online; promises nobody caught are
  logged once each.
- `app/error.tsx`, `app/global-error.tsx`: a page that throws shows a way back, not a blank screen.
- A page still stands on its posters and text if a file turns out to be gone (tested with 404 answers).

## How to check

`scripts/qa/probes/` has quick looks at a running site in a real Chrome (`routes.cjs`: does every route run animated, `first-visit.cjs`: a first visit on a slow phone connection second by second, `menu-shots.cjs`, `drama-flow.cjs`). The heavier measurements are below.

- `scripts/perf/weak.mjs`: the weak browser. `FULL=1 node scripts/perf/weak.mjs http://127.0.0.1:3190 gpu 4 1366 768 1`
  runs the boot, the welcome, idle, and a press, a page and an exit for each of the three pages, and
  prints the frame rate and the slowest frames of each. `soft` as the second argument turns the GPU
  and the video acceleration off.
- `scripts/perf/trace.mjs`: a Chromium trace of a press with the style invalidation tracking, and a
  count of the style recalculations by what caused them. This is how the cursor was found.
- `scripts/perf/net.mjs`: bad connections (slow, offline, failing files, a stale tab, and `holds`: the loading screen must keep waiting).
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

With hardware decoding the size hardly matters. Without it the size and the frame rate decide. The
site still sends the size the display needs to every device (see "One version"), so a device that
decodes in software pays the cost on the biggest sizes. That is accepted.

## Ideas that were weighed and left out

- **More detail on the face and less on the background** (a sharp face video over a softer base).
  It needs two decoders kept in step, which costs more than it saves and drifts, and the numbers
  above say the resolution is not the bottleneck.
- **Videos cropped to what a phone shows.** Phones decode in hardware, so a crop only saves bytes,
  and it would add a second set of videos, a remap of the touch points and more to check.
