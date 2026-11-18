# Home redesign: progress ledger

Resume from this file. The request is `docs/superpowers/specs/2026-11-18-home-page-request.md`, the design and the calls are `...-home-page-redesign.md`, the recon digests are in `docs/design/home-reference/`.

## Standing rules for every helper

- No assistant or tool name anywhere in the repository or its history: no trailer lines that credit a tool, no session links. After a commit run `git log -1 --format=%B`.
- Helpers do not commit, push or run `pnpm build`. The main session commits, builds and pushes.
- Dev server for helpers: `http://localhost:3100` (`npx next dev -p 3100` from `apps/web`). Port 3000 is the owner's: only the main session restarts it, with the production build of `main` (`npx serve out -l 3000 --no-clipboard` from `apps/web`). Free a specific port only, never kill other node processes.
- Python: `C:\Users\muham\anaconda3\python.exe -I`. Blender: `"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" -b --python`. C: is nearly full: write work files to `D:\ren\aspirant-work\home\`.
- Never edit `public/models/about/*`, `public/data/library/*` or a mirror by hand. Never write an R2 key twice.
- Writing: no em or en dashes, "Aspirant power", Terrinia, Selrick, Storm Citadel. `node scripts/qa/scan-text.mjs <roots>` with explicit roots (the default includes `apps/web/out` and takes minutes).
- `main` stays shippable. The main session pushes `main` only when the new home works end to end and the checks are green. Work is committed locally in milestones; a backup branch `home-redesign` may be pushed.

## Waves

| wave | what                                                                                                                       | status  | notes                                                                                                                                                                                                                                                                               |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | recon (ten digests), request and design written, housekeeping                                                              | done    | commit "docs(home): record the owner's home page request and the recon digests"                                                                                                                                                                                                     |
| 1    | K kernel + walking skeleton; X infra; M1 models; M2 models; D media                                                        | done    | five helpers reported; pnpm check green in the main session; skeleton seen on 3100                                                                                                                                                                                                  |
| 2    | actors (drone, duo, Silverbolt, doll, Selena, hand, gramophone+records, Tetra), comic marks+trails, image field, logo wave | running | workflow run wf_378d209d-f63 (the first run, wf_b3bff944-f43, was cut off by a usage limit after 19 minutes; its partial files were kept and the helpers told to continue from them), script in the session scratchpad (home-wave2.js), eight at a time; boot+intro moved to wave 3 |
| 3    | sections S1 to S7                                                                                                          | pending |                                                                                                                                                                                                                                                                                     |
| 4    | integration, performance, QA, docs, push                                                                                   | pending |                                                                                                                                                                                                                                                                                     |

## Decisions log

See section 2 of the design. Changes after the fact are listed here with the date.

- 18 Nov: actors get a per-frame `update(frame)` (kernel), a lab (`window.__home.lab(name)` builds an actor from `kernel/lab.ts`, pins it shown) so each can be looked at on the real stage, and a shared cast pass (`actors/shared/cast.ts`: lit PBR, one light rig, one PMREM, scissor clip) plus `gltf.ts` and `ensure.ts`.
- 18 Nov: the boot loader, tap gate and intro (helper A) moved to wave 3: they need the drone, the duo and the logo from wave 2.
- 18 Nov: the character pages and the story reader still play voice files that never get the gain `g` (about 9 LU louder than the room): the owner decides; left alone.

## Verified so far

- Wave 1: format, typecheck, lint, unit tests (166 files) and knip all pass. The skeleton renders all 16 sections on the dev server with no console errors (probe `home.cjs`).
