# The Aspirants

An immersive, static website for **Aspirant**, a story series set in an alternate universe of Mobile Legends: Bang Bang. It explains the series, tells the whole story by scrolling, introduces the ten Aspirants and archives every film, song, comic and piece of art.

This is a fan project. It is not affiliated with or endorsed by Moonton. Official art keeps its original marks. Fan art is shown with credit and a link to the original.

## Pages

| Route               | What it is                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/`                 | Logo loading screen, then Home: portal-face hero, what Aspirant is, versus stage, the ten, hall of fame           |
| `/experience`       | The story told by scrolling: the whole short story as a web novel, scenes behind the text, hover cards, toys      |
| `/story`            | The world explained: places, before and after, the Cycle, the hierarchy, coupling lab, time order, open questions |
| `/character`        | The roster wall, ten panels that scroll sideways                                                                  |
| `/character/[slug]` | One page per Aspirant, with a voice wall, media and a footer that leads to the next in the queue                  |
| `/collection`       | Films, music, comics, art, fan art and every voice line                                                           |

## Run it

Requires Node 22.13 or newer and pnpm 10 (`corepack enable` picks the pinned version).

```sh
pnpm install
pnpm dev            # http://localhost:3000
```

| Command                                | What it does                                                       |
| -------------------------------------- | ------------------------------------------------------------------ |
| `pnpm dev`                             | Next.js dev server on port 3000                                    |
| `pnpm build`                           | Static export to `apps/web/out`                                    |
| `pnpm start`                           | Serve the export locally on port 3000                              |
| `pnpm check`                           | Prettier, typecheck, ESLint, unit tests and Knip (the CI gate)     |
| `pnpm test:e2e`                        | Playwright against the static export (phone, tablet, desktop, axe) |
| `pnpm test:e2e:install`                | Install the Playwright Chromium build                              |
| `pnpm assets`                          | Rebuild the optimised media from the original source folder        |
| `node scripts/content/build-story.mjs` | Rebuild the story JSON from `short-v2.md`                          |
| `node scripts/qa/scan-text.mjs`        | Scan for dashes and banned words in shipped text                   |

Production is served from the custom domain https://aspirant.cc (GitHub Pages), a domain root, so the base path is empty and a plain `pnpm build` is the production build. If the site is ever served from a sub-path again, build with `BASE_PATH=/sub-path pnpm build` (in Git Bash prefix `MSYS_NO_PATHCONV=1`). Every URL that is not a Next route goes through `asset()` in `apps/web/src/lib/asset.ts`, which adds the base path.

## Layout

```
apps/web/src/app/            routes
apps/web/src/components/     shared UI: HUD, frames, cursor, audio, transitions, text
apps/web/src/features/       per-page code: loader, home, experience, story, character, collection
apps/web/src/content/        typed content: characters, entities, world data, site copy
apps/web/public/             processed media and data (committed)
packages/ui/                 shared shadcn/ui components and the Tailwind v4 theme
packages/config/             shared tsconfig, ESLint and Prettier config
scripts/assets/              media pipeline (ffmpeg, sharp)
scripts/content/             story and voice builders
scripts/qa/                  text scan
docs/                        design spec, canon rules, design system, asset notes, open questions
```

## Stack

Next.js 16 (App Router, static export), React 19, TypeScript, Tailwind v4, three.js through React Three Fiber and drei, GSAP with ScrollTrigger, Lenis, Motion, Zustand, Zod. Tests: Vitest, Playwright with axe. Quality gates: ESLint, Prettier, Knip, Lighthouse CI.

## Media

The original sources (about 7 GB) stay outside the repository. `pnpm assets` reads them and writes optimised outputs into `apps/web/public`: WebP images, H.264 video, AAC audio, depth maps for the Home portal. See [docs/design/assets.md](docs/design/assets.md).

## Content rules

All story content is canon from the author's notes. The rules every contributor follows are in [docs/design/canon-rules.md](docs/design/canon-rules.md): spellings, no em-dashes, "aspirant power", and three questions the story leaves open on purpose (the outcome of the Matrix invasion, where the Ender Control Core is, and what happened between Selena and Obsidia).

## Deploy

Pushes to `main` run `.github/workflows/pages.yml`, which builds the static export and deploys it to GitHub Pages. GitHub Pages needs a public repository or a plan that supports Pages on private repositories, then Settings, Pages, Source: GitHub Actions. See [docs/OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md).

The repository also keeps the container build (`Dockerfile`, nginx on port 8080) and the security workflows from the scaffold.

## Docs

- [Design spec](docs/design/spec.md)
- [Design system](docs/design/design-system.md)
- [Canon and content rules](docs/design/canon-rules.md)
- [Reference techniques](docs/design/references.md)
- [Asset pipeline](docs/design/assets.md)
- [Open questions and defaults](docs/OPEN-QUESTIONS.md)

## License

MIT for the code. The story, characters, official art, audio and video belong to their owners.
