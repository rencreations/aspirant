# Project rules

The Aspirants: a static, immersive Next.js site for the Aspirant story series. Read `README.md` and `docs/design/` first. These rules apply to every change.

## Loading: everything goes in the progress bar

The first loading screen and every page transition report real work. Keep it that way.

- Anything a page needs on first paint is declared in `apps/web/src/lib/route-preloads.ts` as a `PreloadItem` (an image, a data file, a lazy code chunk, fonts). The loading bar, its label and the preloading all come from that list.
- When you add an asset, a lazy chunk or a data fetch that matters at first paint, add it to the list for that route. If it is not in the list, it is not in the bar and the page will pop in late.
- Pre-load for speed: warm the cache before the page opens. Items run in parallel, share a cache, and never block longer than 12 seconds. Big media may set a longer `timeoutMs`. An item that the page does not show until the visitor asks (the other pages' clips, the shorts, the trailer, the voice lines of Selena's and Obsidia's pages) is `deferred`: the bar does not wait for it, it keeps downloading in the background once the page is open, in order of `priority` and behind anything urgent, and the button that needs it shows its loading state until it has arrived. Only the first screen is waited for: the welcome, the idle loop, the buttons, the music and the page the visitor landed on.
- A component with a slow first paint (a WebGL scene) calls `expectReady(id)` from `lib/page-ready.ts` and marks itself ready once it shows something, so the curtain waits for it.
- Big media (the Selena videos, skill clips, trailer, music) is loaded whole into memory through `lib/media-store.ts` by a `PreloadItem` that reports the bytes received, so the bar is real, and it is saved in the browser (Cache Storage) so the next visit does not download it again. Small files read as bytes (data, voice lines) use `cachedFetch`. Replacing a file under the same address means bumping the cache name in `media-store.ts`. Her page and its three pages (`/character/selena/{about,skills,gallery}/`) share one list. Obsidia's page and her three pages (`/character/obsidia/{about,skills,gallery}/`) do the same.
- Never fake progress. Never add a timer that pretends to load.
- A page that is not ready 500 ms after a navigation shows the loading state of the logo transition. Do not remove that.

## Performance

The site must not lag on an ordinary laptop and must lighten itself on a weak one. Read `docs/design/performance.md`. The rules that matter every day:

- Never write a CSS custom property or an inline style on `<html>` or `<body>` per frame (it restyles the whole page), and never give an element an attribute that a script then selects by. A test guards the cursor.
- Animate `transform` and `opacity` only. No `width`, `left`, `top` or `margin` in an animation. No `filter`, `backdrop-filter` or `mix-blend-mode` over the live picture or on an element with animated children. No per-frame SVG attribute writes.
- A transition between two sections of a long page (Vexana's page) is made by the layout, not by an overlay that appears over the next section for no reason: the section holds its last screen, then a scene plays by itself and the page jumps to the next section while the screen is covered (or the next section simply rises over it, or a heart of colour closes on it as the visitor scrolls). There is no scroll indicator of any kind in a transition. A lower join works both ways: the next section has no threshold when you arrive by scrolling down, and has one when you scroll up out of it (the same scene plays back). A stop inside a transition snaps after a moment (half or more goes on, less goes back), so nobody is left standing in one. It waits, with a real progress and never a timer, for what the next section needs. See `seams/` and `docs/design/design-system.md`.
- Something that follows a video runs on the compositor (a Web Animation), not in a frame loop. Long text and long lists use `content-visibility: auto` and are built in small slices.
- Judge speed on the production build, not `pnpm dev` (it is 2 to 3 times slower), with `scripts/perf/weak.mjs`.
- Effects that cost something are gated on the performance level (`:root[data-perf="balanced"]`, `lib/perf.ts`).

## Logo

The logo is a vector (`components/logo/`, traced from the bitmap by `scripts/logo/build.py`). Use `AspirantLogo` wherever the logo appears. The letters are windows: the plate never covers them. The page transition (`components/curtain/`, `components/transition/`) zooms through those windows.

## Navbar and menu

The bar is sticky and always visible. Pages open from the full-screen menu (`components/nav/`), not from links in the bar. Each page has a pair of aspirants shown as art only, never with names. The menu art is built by `scripts/menu/build.py` so every figure has the same size and the eyes sit on one line. If you add or change a portrait, rebuild with that script. The art is warmed after the site opens and is not part of the loading bar.

## Video

Use the custom player in `components/video-player/` (`VideoCard`) for new videos, not a bare `<video controls>`. Videos never start by themselves, with one exception: Vexana's page plays some muted pictures by itself while they are on screen (the signature short, the Reel preview, the skin video of the Registry, the Craft clips, the cover film `final2`, the 3D process clip and the Guinevere dance), they pause when they leave the screen, and none has sound; the livestream and the game start only when the visitor presses a button, and then play with sound. Her page is built by `scripts/vexana/build.py` (see `docs/superpowers/specs/2026-10-24-vexana-page-design.md`). Selena's page is built from recordings cut by `scripts/selena/build.py`, and Obsidia's by `scripts/obsidia/build.py` (both run on the engine in `features/character/stage/`): do not re-cut by hand, change the constants there and rebuild. The page picks a size for the visitor's display, held back to what the device decodes smoothly, and loads that size (Selena's and Obsidia's pages wait before opening only for the welcome and the idle loop, and keep loading the rest in the background). While a page or a short waits for its frame the waiting video runs faster (the time skip in the stage engine). The videos have no sound (muted): sound is the music and the voice lines. Keep a video that plays beside the stage at 60 fps, since a 30 fps one makes the page pace at half rate.

## Look and feel

Light mode by default (`data-theme="daybreak"`). Dark (`storm`) only where the story needs it. Modern, minimal, futuristic with a mechanical feel: generous spacing, thin lines, few effects, no glow or gradient clutter.

## Writing

Formal English written like to a friend but business. Short sentences. No em-dashes or en-dashes anywhere. No generic AI-sounding writing. "Aspirant power", never "conviction". Spell it Terrinia, Selrick, Storm Citadel. See `docs/design/canon-rules.md`.

## Workflow

- Run on `http://localhost:3000` (`pnpm dev`).
- Commit with conventional commits (headers under 100 characters) and push to `main` when done.
- Never list or mention Claude or any AI anywhere in this repository or its history: not as an author, co-author or contributor, and not in commit messages or trailers (no `Co-Authored-By`, no session links), pull requests, docs, code comments or file headers. A tool default that adds such a line is wrong here: leave it out.
- The site is served from the custom domain https://aspirant.cc (the domain root, no `/aspirant` path). The Pages workflow builds with an empty base path.
- `pnpm check` must pass before pushing: format, typecheck, lint, unit tests, knip.
