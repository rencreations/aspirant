# Collection library: progress ledger

Read this first when resuming. Design: `docs/superpowers/specs/2026-11-04-collection-library-design.md`. Pipeline contract: `scripts/library/README.md`. Branch: `collection-library` (merge to `main` only when all ten rooms are real and the checks pass).

## Owner decisions (4 to 5 Nov 2026)

- Bucket `aspirant` on Cloudflare R2, public at https://s3.aspirant.cc. **All collection assets go to R2** and the site reads them from there. A local mirror with the identical tree is kept at `D:\ren\aspirant-r2` (sync with `python scripts/library/r2.py sync`, rebuild from the bucket with `restore`).
- The first token was account wide. It was replaced by a least privilege token (object read and write on the bucket only, expires 31 Dec 2026, saved in `~/.config/aspirant/r2-scoped.env`). The old copy was deleted from this machine. The owner should revoke the old token "DANGEROUS" in the Cloudflare dashboard (it expires 11 Nov anyway).
- The owner went to sleep and asked for no questions and for the work to be finished by morning: use judgement and keep going until it is completely done. Be creative.
- Judgement calls made without asking: takedown contact is the project's GitHub issues page; cosplay photos are included only when the source names the poster and the post (credited, linked); see the design doc for the rest.

## Environment

- Python `C:/Users/muham/anaconda3/python.exe`. ffmpeg and ffprobe on the PATH, NVENC available (RTX 4060 laptop), 32 cores.
- **C: is nearly full (about 6 GB free). Use D: for everything big.** `D:\ren\aspirant-work` is the scratch folder.
- Mirror server (CORS) for development: `npx serve D:\ren\aspirant-r2 -l 3300 --cors --no-clipboard`. Dev site: `NEXT_PUBLIC_LIBRARY_ORIGIN=http://localhost:3300 npx next dev -p 3100` from `apps/web`.
- Commits: conventional, header under 100 characters, no tool or assistant named anywhere, no Co-Authored-By. Do not push from helper sessions. `pnpm check` before the merge to main.

## Status

| Step                                                                                                                                                                                                                                  | State                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Design, reference frames                                                                                                                                                                                                              | done, committed       |
| R2 token (least privilege), mirror folder, `common.py`, `r2.py`, README                                                                                                                                                               | done                  |
| TS foundation: `lib/library.ts`, `features/library/*` (types, registry, data hook, shell, chips, credit, preload registry, room dispatcher, 10 stubs), routes `/collection`, `/collection/[slug]`, `/collections/...`, route preloads | done, typecheck clean |
| Shelf scene and covers                                                                                                                                                                                                                | not started           |
| Arts (official + scene stills)                                                                                                                                                                                                        | not started           |
| Films                                                                                                                                                                                                                                 | not started           |
| Music, Voicelines                                                                                                                                                                                                                     | not started           |
| Fanart (+ credits)                                                                                                                                                                                                                    | not started           |
| Comic                                                                                                                                                                                                                                 | not started           |
| Lore                                                                                                                                                                                                                                  | not started           |
| Design                                                                                                                                                                                                                                | not started           |
| Animation                                                                                                                                                                                                                             | not started           |
| Others                                                                                                                                                                                                                                | not started           |
| Global search overlay + `search.json`                                                                                                                                                                                                 | not started           |
| Old `features/collection` removal, e2e specs, knip, scan-text, `pnpm check`                                                                                                                                                           | not started           |
| Upload to R2 (`r2.py sync`), verify (`r2.py status`)                                                                                                                                                                                  | not started           |
| Merge to main, push, watch deploy, serve the production build on :3000                                                                                                                                                                | not started           |

## Notes for the next session

5 Nov 2026 (afternoon): twelve helpers launched, each owns one room (see `helper-context.md`). Agent ids, for SendMessage follow ups: shelf aef3db38bb6d8aad4, arts a66860db734bde8e2, scenes a6ce77011c3f3a396, films a2cacae430ac800e8, audio (voicelines+music) a43da607c5f962341, fanart ace132bd6658031f6, comic a1b82f2ddb67c9b35, lore a6b6b9cf6ef5ab0b9, design a7563d197bf0a5cbc, animation builder a49502962a1fb40ea, animation page a4b152e2619620c10, others a39f2a4183bcd1318.

Lead's own to do after the helpers report: commit their work in groups; run `python scripts/library/build_index.py`; add the Search button to the shelf if the shelf helper did not; remove the old `features/collection` (copy anything still used) and its e2e spec, `knip`, `scan-text`, `pnpm check`; production build and look at all eleven pages at 1440, 1920, 390; `python scripts/library/r2.py sync` then `status`; fix the old About and home text that points at `/collection` if needed; update docs (HANDOFF, design-system, README, canon notes); merge to main, push, watch the deploy; serve the production build on :3000.
