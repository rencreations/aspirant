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

| wave | what                                                                                                                                                                                                              | status  | notes                                                                                                                                                                                                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0    | recon (ten digests), request and design written, housekeeping                                                                                                                                                     | done    | commit "docs(home): record the owner's home page request and the recon digests"                                                                                                                                                                  |
| 1    | K kernel + walking skeleton; X infra; M1 models; M2 models; D media                                                                                                                                               | done    | five helpers reported; pnpm check green in the main session; skeleton seen on 3100                                                                                                                                                               |
| 2    | actors (drone, duo, Silverbolt, doll, Selena, hand, gramophone+records, Tetra), comic marks+trails, image field, logo wave                                                                                        | done    | eleven helpers reported (workflow wf_378d209d-f63 after a usage-limit cut); committed in five milestones; format, typecheck, lint, 2834 tests pass; knip lists only what no section imports yet (selena preload)                                 |
| 3    | boot+intro (A2), film plane (VP), hero+aspirants (S1), rows+strip (S2, after VP), bolt+fall (S3), hand+list (S4a), selena (S4b, after S4a), voices+music (S5), funny+chase (S6), bend (S7a), archive+footer (S7b) | running | workflow run wf_1a494cc6-9d5, script in the session scratchpad (home-wave3.js), eight at a time. After a cut-off relaunch with `args: [the failed task names]` (the briefs say to resume from partial files); S2 needs VP and S4b needs S4a done |
| 4    | integration, performance, QA, docs, push                                                                                                                                                                          | pending |                                                                                                                                                                                                                                                  |

## Decisions log

See section 2 of the design. Changes after the fact are listed here with the date.

- 18 Nov: actors get a per-frame `update(frame)` (kernel), a lab (`window.__home.lab(name)` builds an actor from `kernel/lab.ts`, pins it shown) so each can be looked at on the real stage, and a shared cast pass (`actors/shared/cast.ts`: lit PBR, one light rig, one PMREM, scissor clip) plus `gltf.ts` and `ensure.ts`.
- 18 Nov: the boot loader, tap gate and intro (helper A) moved to wave 3: they need the drone, the duo and the logo from wave 2.
- 18 Nov: the character pages and the story reader still play voice files that never get the gain `g` (about 9 LU louder than the room): the owner decides; left alone.

- 18 Nov: wave 3 adds `fx/video-plane` (VP: the trailer plane, the ten previews, hover, fly-off), a shared drone route for the first four sections (`features/home/drone-route.ts`), the fly-off of the strip lives in the strip's tail, and S4a owns `sections/list/selena-frame.ts` (Selena's full-screen placement, joint J8).
- 18 Nov: kernel: `FrameInfo.time` holds while frozen; `StageTarget.dispose` removes itself from the stage.

## Verified so far

- Wave 2: format, typecheck, lint, tests (261 files, 2834 tests) pass; knip fails only on `actors/selena/preload.ts` (no section imports it yet).

- Wave 1: format, typecheck, lint, unit tests (166 files) and knip all pass. The skeleton renders all 16 sections on the dev server with no console errors (probe `home.cjs`).

- 18 Nov, 21:25: wave 3 first run `wf_1a494cc6-9d5` finished VP (film plane, `fx-video-plane.md`) and S1 (hero and aspirants, `section-hero-aspirants.md`); the other eight helpers were cut off by the usage limit and left partial files. Relaunched as `wf_bdf30a79-382` with `args` naming A2, S4a, S3, S6, S7a, S5, S7b, S2 and S4b (S4b waits for S4a).

## RESUME HERE (written on the evening of 18 Nov, when the usage limit was close)

If this session stopped, a new one picks up from this section.

**State.** Waves 0 to 2 are done and committed on the local `main`. `main` is NOT pushed to origin on purpose: the home is mid rebuild, and a push to `main` deploys it to aspirant.cc (the old home is already gone from the tree). Wave 3 (the sections) is the workflow run `wf_1a494cc6-9d5`; its helpers write straight into the working tree of `D:\aspirant`.

**Nothing is lost.** A detached loop (`docs/superpowers/plans/home-snapshot.cjs.txt`, run as `node snapshot.cjs loop`, saved under `D:\ren\aspirant-work\home\`) saves the whole working tree every 10 minutes as one commit on the side branch `origin/home-wip` (no deploy: Pages runs on `main` only). On another machine or after a crash: `git fetch origin home-wip`, then `git checkout home-wip -- .` in a clean clone of `main`. The log is `D:\ren\aspirant-work\home\snapshot.log`.

**Finding out what wave 3 got done.** Each helper writes `docs/design/home/<ws>.md` (`boot.md`, `fx-video-plane.md`, `section-hero-aspirants.md`, `section-rows-strip.md`, `section-bolt-fall.md`, `section-hand-list.md`, `section-selena.md`, `section-voices-music.md`, `section-funny-chase.md`, `section-bend.md`, `section-archive-footer.md`): a note with "End states" means that helper finished. The journal of the run is `C:\Users\muham\.claude\projects\D--aspirant\fd0c2cef-a780-4648-9a84-d597a6e52568\subagents\workflows\wf_1a494cc6-9d5\journal.jsonl`.

**Relaunching helpers that were cut off.** Copy `docs/superpowers/plans/home-wave3-workflow.js.txt` to a `.js` file and run it with `Workflow({ scriptPath, args: ["S1-hero", ...] })`, naming only the failed tasks (names: VP-videoplane, A2-boot, S1-hero, S2-rows-strip, S3-bolt-fall, S4a-hand-list, S4b-selena, S5-voices-music, S6-funny-chase, S7a-bend, S7b-archive-footer). Rule 11 of the briefs tells a helper to continue from the partial files. S2 needs VP finished and S4b needs S4a finished. A helper that is cut off leaves partial files that were never run: it must read them first.

**Then, in order (wave 4, integration).**

1. `pnpm check` in the main session (knip will list files no section imports until the sections land: the preload files of the actors, `drone-route.ts`).
2. Walk the whole page top to bottom on `localhost:3100` with a real wheel at 1440x900, 1706x950 and 390x844 and fix every joint (design section 4.1, and each helper's End states). Fix what looks wrong before polishing anything.
3. Loading: the waited list is only the first screens; check the bar on a throttled network.
4. Performance on the production build with `scripts/perf/weak.mjs`. Accessibility and Lighthouse on `/index.html` (accessibility must stay 1.0). Run the e2e specs on the build.
5. Remove the orphan dependencies of the old home (`@react-three/fiber`, `@gsap/react`) and the old home assets (`public/img/portal`) once nothing imports them.
6. Docs: CLAUDE.md (ninth autoplay exception, a home section, the loader line, the one canvas rule, the lit PBR exception, the voice gain rule), HANDOFF, README, `docs/design/design-system.md`.
7. Build the production site and serve it on port 3000 (`npx serve out -l 3000 --no-clipboard` from `apps/web`; free only that port; it now serves `next dev`).
8. `pnpm check` green, then `git push origin main`, watch the deploy with `gh run list`, check https://aspirant.cc. Never put an assistant as an author, co-author or in a trailer.
