# The Aspirants

An immersive, static website for **Aspirant**, a story series set in an alternate universe of Mobile Legends: Bang Bang. It explains the series, tells the whole story by scrolling, introduces the ten Aspirants and archives every film, song, comic and piece of art.

This is a fan project. It is not affiliated with or endorsed by Moonton. Official art keeps its original marks. Fan art is shown with credit and a link to the original.

Live at **https://aspirant.cc**.

## Pages

| Route                                        | What it is                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/`                                          | Logo loading screen, then Home: portal-face hero, what Aspirant is, versus stage, the ten, hall of fame           |
| `/experience`                                | The story told by scrolling: the whole short story as a web novel, scenes behind the text, hover cards, toys      |
| `/story`                                     | The world explained: places, before and after, the Cycle, the hierarchy, coupling lab, time order, open questions |
| `/character`                                 | The roster wall, ten panels that scroll sideways                                                                  |
| `/character/{slug}`                          | One page for each of the ten Aspirants. Each pair has its own concept (see below)                                 |
| `/character/selena/{about,skills,gallery}`   | Selena's three pages, on the same stage as her first screen                                                       |
| `/character/obsidia/{about,skills,gallery}`  | Obsidia's three pages                                                                                             |
| `/character/vexana/story/{academic,ender}`   | Vexana's two stories (the first is titled "Human" on the page)                                                    |
| `/character/guinevere/story/{alone,partner}` | Guinevere's two stories                                                                                           |
| `/collection`                                | Films, music, comics, art, fan art and every voice line                                                           |

The pairs, from the newest to the oldest: Selena and Obsidia (a live stage with video poses), Guinevere and Vexana (one long scroll with timed transitions between its sections), Lesley and Chang'e (a scope and a bench), Ruby and Angela (night shift and first sunrise), Fanny and Layla (a shared line, shots and notes).

## Quick start

You need **Node 22.13 or newer** (24 works), **pnpm 10.28** and about **10 GB of free disk**: the site carries its media (about 4 GB of video, audio and pictures) inside the repository.

```sh
git clone https://github.com/rencreations/aspirant.git
cd aspirant
corepack enable                 # picks the pinned pnpm. If it fails, see "Troubleshooting".
pnpm install                    # about 20 seconds with a warm store
pnpm dev                        # http://localhost:3000
```

The first page compiles on its first visit (a few seconds). Nothing else is needed: all media is already in `apps/web/public`.

To skip the old history and save time, clone with `git clone --depth 1 https://github.com/rencreations/aspirant.git`. The media of the current version is still downloaded (about 4 GB).

Run it on another port when 3000 is taken:

```sh
PORT=3201 pnpm dev             # macOS, Linux, Git Bash
$env:PORT=3201; pnpm dev       # Windows PowerShell
```

### The production build

```sh
pnpm build                     # about 2 minutes, writes the static site to apps/web/out (about 4 GB)
pnpm start                     # serves apps/web/out on http://localhost:3000
```

`pnpm start` uses `serve`. For another port: `pnpm --filter @aspirant/web exec serve out -l 3200`. Judge speed and behaviour on this build, not on `pnpm dev`, which is two to three times slower.

### Checks

```sh
pnpm check                     # Prettier, typecheck, ESLint, unit tests and Knip (the CI gate), about 2 minutes
node scripts/qa/scan-text.mjs  # dashes and banned words in shipped text
pnpm test:e2e:install          # once: the Playwright Chromium build
pnpm test:e2e                  # Playwright against apps/web/out (phone, tablet, desktop, axe); build first
```

## Commands

| Command                                | What it does                                                    |
| -------------------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                             | Next.js dev server (port 3000, or `PORT`)                       |
| `pnpm build`                           | Static export to `apps/web/out`                                 |
| `pnpm start`                           | Serve the export locally on port 3000                           |
| `pnpm check`                           | The CI gate                                                     |
| `pnpm test:e2e`                        | Playwright against the static export                            |
| `pnpm test:e2e:install`                | Install the Playwright Chromium build                           |
| `pnpm assets`                          | Rebuild the optimised media of the shared pages (needs sources) |
| `node scripts/content/build-story.mjs` | Rebuild the story JSON from `short-v2.md`                       |

## Environment

| Variable                   | Default                                                                     | Meaning                                                                          |
| -------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`     | `https://aspirant.cc` in a production build, `http://localhost:3000` in dev | Origin used for canonical links, the sitemap, `robots.txt` and share cards       |
| `BASE_PATH`                | empty                                                                       | Only when the site is served from a sub-path (for example a GitHub project page) |
| `PORT`                     | 3000                                                                        | Port of `pnpm dev`                                                               |
| `E2E_PORT`, `E2E_BASE_URL` | 3190                                                                        | Where Playwright serves or finds the site                                        |

The base path is empty because the site is served from the root of its own domain. If it is ever served from a sub-path again, build with `BASE_PATH=/sub-path pnpm build` (Git Bash: prefix `MSYS_NO_PATHCONV=1`). Every URL that is not a Next route goes through `asset()` in `apps/web/src/lib/asset.ts`, which adds the base path.

## Layout

```
apps/web/src/app/            routes, error pages, sitemap, robots, manifest
apps/web/src/components/     shared UI: HUD, frames, cursor, audio, transitions, loading and offline guards
apps/web/src/features/       per-page code: loader, home, experience, story, character (one folder per pair), collection
apps/web/src/lib/            loading and media store, performance governor, audio, hooks
apps/web/src/content/        typed content: characters, entities, world data, site copy
apps/web/public/             processed media and data (committed)
packages/ui/                 shared shadcn/ui components and the Tailwind v4 theme
packages/config/             shared tsconfig, ESLint and Prettier config
scripts/                     media and content builders, QA and performance scripts
docs/                        design spec, canon rules, design system, asset notes, open questions
```

## Stack

Next.js 16 (App Router, static export), React 19, TypeScript, Tailwind v4, three.js, GSAP with ScrollTrigger, Lenis, Motion, Zustand, Zod. Tests: Vitest, Playwright with axe. Quality gates: ESLint, Prettier, Knip, Lighthouse CI.

## Media

The finished media is committed, so a newcomer never has to rebuild it. The originals (about 7 GB of recordings, art, audio and the story text) stay outside the repository. To rebuild a part, point its script at the sources (the default paths are the author's folders and are written at the top of each script). Run Python scripts with `python -I`, with `ffmpeg` and `ffprobe` on the PATH, and Pillow and NumPy installed.

| Script                                            | Builds                                                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `scripts/assets/build.mjs` (`pnpm assets`)        | Shared images, comics, videos, audio and the home portal faces                                      |
| `scripts/content/*.mjs`                           | The story JSON and the voice line lists                                                             |
| `scripts/logo/build.py`                           | The vector logo and the icon                                                                        |
| `scripts/menu/build.py`                           | The portraits of the full-screen menu                                                               |
| `scripts/selena/*.py`, `scripts/obsidia/*.py`     | The stage videos in four sizes, skill clips, about and gallery media                                |
| `scripts/vexana/build.py`, `stage.py`, `drama.py` | Her page, her room and the interactive drama (`drama.py` downloads the episodes and needs `yt-dlp`) |
| `scripts/guinevere/build.py`, `glow.py`           | Her page and the second picture of her first screen                                                 |
| `scripts/ruby-angela/build.py`                    | The pictures of the Ruby and Angela pages                                                           |

## Content rules

All story content is canon from the author's notes. The rules every contributor follows are in [docs/design/canon-rules.md](docs/design/canon-rules.md): spellings, no em-dashes, "aspirant power", and three questions the story leaves open on purpose (the outcome of the Matrix invasion, where the Ender Control Core is, and what happened between Selena and Obsidia).

## Deploy

Pushes to `main` run `.github/workflows/pages.yml`, which builds the static export and deploys it to GitHub Pages at **https://aspirant.cc** (Settings, Pages, Source: GitHub Actions, custom domain `aspirant.cc`). The workflow builds with an empty base path and `NEXT_PUBLIC_SITE_URL=https://aspirant.cc`. It takes about 8 minutes because of the media. The old project address `rencreations.github.io/aspirant` redirects to the domain.

The domain's DNS is on Cloudflare. Two things to know: Cloudflare in front of GitHub Pages terminates HTTPS itself, so turn on "Always Use HTTPS" in Cloudflare instead of "Enforce HTTPS" in GitHub (the two together can redirect in a loop in Flexible mode); and the free plan limits video served through its proxy, so if videos start failing, set the DNS record to "DNS only".

The repository also keeps the container build (`Dockerfile`, nginx on port 8080) and the security workflows.

## Troubleshooting

| Problem                                                                                      | Fix                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `corepack enable` fails with `EPERM` (Windows, nvm)                                          | Use `npm install -g pnpm@10.28.0`, or run the terminal as administrator once.                                                                                                                                                   |
| Port 3000 is in use                                                                          | `PORT=3201 pnpm dev` (PowerShell: `$env:PORT=3201; pnpm dev`).                                                                                                                                                                  |
| `next dev` or `next build` stops on its first run with a note about a security vulnerability | Run the same command again: it continues. `pnpm audit --prod` reports advisories for Next.js 16.4.0 (image optimisation, `use cache` and Server Actions, none used by this static export). Moving to 16.4.1 or newer clears it. |
| `pnpm build` runs out of disk                                                                | The export is about 4 GB on top of the 4 GB of media. Keep 10 GB free.                                                                                                                                                          |
| Playwright says no browser is installed                                                      | `pnpm test:e2e:install`.                                                                                                                                                                                                        |
| A commit is refused                                                                          | The hooks run Prettier and require a conventional commit header under 100 characters, for example `fix(character): centre the voices`.                                                                                          |
| The site loads slowly on a poor connection                                                   | It is built for that: after 12 seconds the loading screen offers "Enter now", a page change never waits more than 25 seconds, and media that fails to load leaves the posters and the rest of the page in place.                |

## Docs

- [Design spec](docs/design/spec.md)
- [Design system](docs/design/design-system.md)
- [Canon and content rules](docs/design/canon-rules.md)
- [Reference techniques](docs/design/references.md)
- [Asset pipeline](docs/design/assets.md)
- [Open questions and defaults](docs/OPEN-QUESTIONS.md)

## License

MIT for the code. The story, characters, official art, audio and video belong to their owners.
