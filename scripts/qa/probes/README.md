# Probes

Small scripts that open the real site in a real Chrome and print or photograph what a visitor would see. They are for looking and for finding the cause of a report, not for gating (the gates are `pnpm check` and `pnpm test:e2e`).

- Run them with plain `node`, from the repository root, against a running site. `BASE` is the address (default `http://localhost:3000`, so serve the production build first: `pnpm build`, then `pnpm start`). Use `BASE=https://aspirant.cc` for the live site.
- They need Chrome installed (Playwright's bundled Chromium cannot play H.264) and Playwright from `apps/web` (`pnpm install` is enough).
- Git Bash turns a lone `/` argument into a Windows path: put `MSYS_NO_PATHCONV=1` in front of the command when a route is passed in an environment variable.
- `serve` (what `pnpm start` uses) answers 404 for a Next prefetch file such as `/experience/__next.experience.__PAGE__.txt`. That one console error is local-only noise (the live site and the e2e server do not have it).
- Files they write (screenshots) go to `OUT`, by default the `aspirant-probes` folder in the temp folder.

| Script            | Answers                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `routes.cjs`      | Does every route run animated after a few seconds? (`data-motion`, `data-perf`, animations, errors) |
| `first-visit.cjs` | What does a first visit on a slow phone connection show, second by second?                          |
| `menu-shots.cjs`  | How does the full-screen menu look at each size with each page hovered?                             |
| `drama-flow.cjs`  | Does the interactive drama save, continue, level select and play as it should?                      |

`scripts/perf/` has the heavier measuring scripts (`weak.mjs`: a weak device, `net.mjs`: bad connections, `trace.mjs`) and `scripts/qa/scan-text.mjs` scans the shipped text.
