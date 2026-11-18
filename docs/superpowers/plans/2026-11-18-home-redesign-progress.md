# Home redesign: progress ledger

Resume from this file. The request is `docs/superpowers/specs/2026-11-18-home-page-request.md`, the design and the calls are `...-home-page-redesign.md`, the recon digests are in `docs/design/home-reference/`.

## Standing rules for every helper

- No assistant or tool name in the repository or its history: no `Co-Authored-By`, no session links, nowhere. After a commit run `git log -1 --format=%B`.
- Helpers do not commit, push or run `pnpm build`. The main session commits, builds and pushes.
- Dev server for helpers: `http://localhost:3100` (`npx next dev -p 3100` from `apps/web`). Port 3000 is the owner's: only the main session restarts it, with the production build of `main` (`npx serve out -l 3000 --no-clipboard` from `apps/web`). Free a specific port only, never kill other node processes.
- Python: `C:\Users\muham\anaconda3\python.exe -I`. Blender: `"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" -b --python`. C: is nearly full: write work files to `D:\ren\aspirant-work\home\`.
- Never edit `public/models/about/*`, `public/data/library/*` or a mirror by hand. Never write an R2 key twice.
- Writing: no em or en dashes, "Aspirant power", Terrinia, Selrick, Storm Citadel. `node scripts/qa/scan-text.mjs <roots>` with explicit roots (the default includes `apps/web/out` and takes minutes).
- `main` stays shippable. The main session pushes `main` only when the new home works end to end and the checks are green. Work is committed locally in milestones; a backup branch `home-redesign` may be pushed.

## Waves

| wave | what                                                          | status  | notes                                                                           |
| ---- | ------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| 0    | recon (ten digests), request and design written, housekeeping | done    | commit "docs(home): record the owner's home page request and the recon digests" |
| 1    | K kernel + walking skeleton; M1 models; M2 models; D media    | pending |                                                                                 |
| 2    | A boot + intro + drone/duo; SB, DL, SL, HD, GR, TT actors     | pending |                                                                                 |
| 3    | sections S1 to S7                                             | pending |                                                                                 |
| 4    | integration, performance, QA, docs, push                      | pending |                                                                                 |

## Decisions log

See section 2 of the design. Changes after the fact are listed here with the date.

## Verified so far

Nothing yet.
