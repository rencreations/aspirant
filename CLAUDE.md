# Project rules

The Aspirants: a static, immersive Next.js site for the Aspirant story series. Read `README.md` and `docs/design/` first. These rules apply to every change.

## Loading: everything goes in the progress bar

The first loading screen and every page transition report real work. Keep it that way.

- Anything a page needs on first paint is declared in `apps/web/src/lib/route-preloads.ts` as a `PreloadItem` (an image, a data file, a lazy code chunk, fonts). The loading bar, its label and the preloading all come from that list.
- When you add an asset, a lazy chunk or a data fetch that matters at first paint, add it to the list for that route. If it is not in the list, it is not in the bar and the page will pop in late.
- Pre-load for speed: warm the cache before the page opens. Items run in parallel, share a cache, and never block longer than 12 seconds. Big media may set a longer `timeoutMs` (Selena's page waits up to two minutes: a long first load is accepted so that nothing waits afterwards).
- A component with a slow first paint (a WebGL scene) calls `expectReady(id)` from `lib/page-ready.ts` and marks itself ready once it shows something, so the curtain waits for it.
- Big media (the Selena videos, skill clips, trailer, music) is loaded whole into memory through `lib/media-store.ts` by a `PreloadItem` that reports the bytes received, so the bar is real, and it is saved in the browser (Cache Storage) so the next visit does not download it again. Small files read as bytes (data, voice lines) use `cachedFetch`. Replacing a file under the same address means bumping the cache name in `media-store.ts`. Her page and its three pages (`/character/selena/{about,skills,gallery}/`) share one list.
- Never fake progress. Never add a timer that pretends to load.
- A page that is not ready 500 ms after a navigation shows the loading state of the logo transition. Do not remove that.

## Logo

The logo is a vector (`components/logo/`, traced from the bitmap by `scripts/logo/build.py`). Use `AspirantLogo` wherever the logo appears. The letters are windows: the plate never covers them. The page transition (`components/curtain/`, `components/transition/`) zooms through those windows.

## Navbar and menu

The bar is sticky and always visible. Pages open from the full-screen menu (`components/nav/`), not from links in the bar. Each page has a pair of aspirants shown as art only, never with names. The menu art is built by `scripts/menu/build.py` so every figure has the same size and the eyes sit on one line. If you add or change a portrait, rebuild with that script. The art is warmed after the site opens and is not part of the loading bar.

## Video

Use the custom player in `components/video-player/` (`VideoCard`) for new videos, not a bare `<video controls>`. Videos never start by themselves. Selena's page is built from recordings cut by `scripts/selena/build.py`: do not re-cut by hand, change the constants there and rebuild. The page picks a size for the visitor's display, held back to what the device decodes smoothly, and loads all of that size before it opens. The videos have no sound (muted): sound is the music and the voice lines. Keep a video that plays beside the stage at 60 fps, since a 30 fps one makes the page pace at half rate.

## Look and feel

Light mode by default (`data-theme="daybreak"`). Dark (`storm`) only where the story needs it. Modern, minimal, futuristic with a mechanical feel: generous spacing, thin lines, few effects, no glow or gradient clutter.

## Writing

Formal English written like to a friend but business. Short sentences. No em-dashes or en-dashes anywhere. No generic AI-sounding writing. "Aspirant power", never "conviction". Spell it Terrinia, Selrick, Storm Citadel. See `docs/design/canon-rules.md`.

## Workflow

- Run on `http://localhost:3000` (`pnpm dev`).
- Commit with conventional commits (headers under 100 characters) and push to `main` when done.
- Do not list Claude or any AI as an author, co-author or contributor, in commits, pull requests, docs or file headers.
- `pnpm check` must pass before pushing: format, typecheck, lint, unit tests, knip.
