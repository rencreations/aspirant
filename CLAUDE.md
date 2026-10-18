# Project rules

The Aspirants: a static, immersive Next.js site for the Aspirant story series. Read `README.md` and `docs/design/` first. These rules apply to every change.

## Loading: everything goes in the progress bar

The first loading screen and every page transition report real work. Keep it that way.

- Anything a page needs on first paint is declared in `apps/web/src/lib/route-preloads.ts` as a `PreloadItem` (an image, a data file, a lazy code chunk, fonts). The loading bar, its label and the preloading all come from that list.
- When you add an asset, a lazy chunk or a data fetch that matters at first paint, add it to the list for that route. If it is not in the list, it is not in the bar and the page will pop in late.
- Pre-load for speed: warm the cache before the page opens. Items run in parallel, share a cache, and never block longer than 12 seconds.
- A component with a slow first paint (a WebGL scene) calls `expectReady(id)` from `lib/page-ready.ts` and marks itself ready once it shows something, so the curtain waits for it.
- Never fake progress. Never add a timer that pretends to load.
- A page that is not ready 500 ms after a navigation shows the loading state of the logo transition. Do not remove that.

## Logo

The logo is a vector (`components/logo/`, traced from the bitmap by `scripts/logo/build.py`). Use `AspirantLogo` wherever the logo appears. The letters are windows: the plate never covers them. The page transition (`components/curtain/`, `components/transition/`) zooms through those windows.

## Look and feel

Light mode by default (`data-theme="daybreak"`). Dark (`storm`) only where the story needs it. Modern, minimal, futuristic with a mechanical feel: generous spacing, thin lines, few effects, no glow or gradient clutter.

## Writing

Formal English written like to a friend but business. Short sentences. No em-dashes or en-dashes anywhere. No generic AI-sounding writing. "Aspirant power", never "conviction". Spell it Terrinia, Selrick, Storm Citadel. See `docs/design/canon-rules.md`.

## Workflow

- Run on `http://localhost:3000` (`pnpm dev`).
- Commit with conventional commits (headers under 100 characters) and push to `main` when done.
- Do not list Claude or any AI as an author, co-author or contributor, in commits, pull requests, docs or file headers.
- `pnpm check` must pass before pushing: format, typecheck, lint, unit tests, knip.
