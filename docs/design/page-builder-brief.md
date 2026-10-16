# Page builder brief (shared by every page engineer)

You build one part of "The Aspirants", a static, immersive, Awwwards-level site. Read these first, in order, all of them:

1. `docs/design/spec.md` (product, concept, per-page design, rules)
2. `docs/design/canon-rules.md` (content and writing rules; hard)
3. `docs/design/design-system.md` (components, hooks, tokens: use them, do not reinvent)
4. `docs/design/references.md` (techniques)
5. `docs/design/assets.md` (every processed asset, paths and gotchas)

## Workspace

- You work in your own git worktree on your own branch. Run `pnpm install` once at the start (fast, uses the shared store).
- Run a private dev server: `NEXT_DIST_DIR=.next-<name> pnpm --filter @aspirant/web exec next dev -p <your port>`. Never use port 3000 (the owner's preview). Stop your servers when done.
- In Git Bash use `MSYS_NO_PATHCONV=1` when setting `BASE_PATH=/aspirant`.
- Playwright Chromium is installed or install it with `pnpm --filter @aspirant/web exec playwright install chromium`. Take screenshots into the scratchpad dir given in your task and LOOK at them with the Read tool. Be self-critical. Iterate until it is beautiful, not merely working.
- Commit your work on your branch with conventional commit messages (`feat(home): ...`). No AI or tool is named as author or co-author anywhere. Do not push. Do not merge. Commit often, at least after every major piece.

## Your territory

Only the paths named in your task. Shared code (`components/`, `lib/`, `styles/`, `content/`, `app/layout.tsx`, `next.config.ts`, configs) is read-only for you, with one exception: you may ADD new files in `components/` or `lib/` when a primitive you need is missing and general, with a short doc comment and a line in `docs/design/design-system.md` under "Additions". If you need a change to an existing shared file, make the smallest additive change and list it in your final report. Do not edit another page's feature folder.

## Content access

- Typed content: `@/content/...` (characters, entities, world, site-copy, story). Story text and voice lines are JSON and audio under `public/`; fetch them with `asset()` from `@/lib/asset`. Never hardcode `/img/...` or `/audio/...` URLs. Never call `fetch('/...')`.
- Everything you write (code, comments, copy, alt text) follows `canon-rules.md`: no em-dashes or en-dashes, "aspirant power", Terrinia, never resolve the open questions, no invented lore, credit fan art. Run `node scripts/qa/scan-text.mjs` before each commit.

## Quality bar (hard gates)

- `pnpm check` passes (format, typecheck, lint, tests, knip) in your worktree before your final commit. Fix knip by deleting unused code, not by ignoring.
- `pnpm build` passes, and `MSYS_NO_PATHCONV=1 BASE_PATH=/aspirant pnpm build` has all assets prefixed.
- e2e: add or extend a Playwright spec in `apps/web/e2e/` for your routes (phone 390x844, tablet 820x1180, desktop 1440x900): loads, one `h1`, no console errors, no horizontal overflow, your key interactions work, axe has no serious or critical violations.
- Accessibility: every hover effect has tap and keyboard equivalents; all controls named; `prefers-reduced-motion` and the site's Reduce motion toggle respected (no particles, no pinning, no parallax; crossfades only; content and interaction still work); no focus traps except modals; touch targets 44 px.
- Responsive: design and CHECK at 320, 390, 768, 1024, 1440, 1920, 2560x1080 (21:9), 3440x1440, plus landscape phone 844x390 and tall 390x844. No horizontal scroll, no overlapped HUD, nothing clipped. Use `dvh`, safe-area insets.
- Performance: lazy-load heavy scenes (`next/dynamic`, `ssr: false`), pause off screen and when the tab is hidden, cap DPR at 1.75, lower counts on phones, dispose Three.js resources, no per-frame React state updates. Keep each route's first-load JS reasonable (under about 250 KB excluding lazy chunks).
- Everything is interactive in some way: hover, click, tap, idle, pointer, scroll. Add small delights (sound blips via `audio.blip`, voice lines on hover or click where the character is on screen, idle breathing).
- Visual identity: Selrick Academy Resonance Terminal. Mecha HUD like Arknights: Endfield and Honkai Impact 3rd. Frames are never plain rectangles. Daybreak versus Storm contrast. The lantern motif ("someone is always waiting"). Match the rest of the site; do not invent a new look.
- Copy: formal English like to a friend but business, concise, short sentences, warm and personal to the visitor. No hype, no cliches, no AI-sounding filler.

## Final report (under 60 lines)

What you built (routes, modules), what you verified (viewports, screenshots, interactions), shared-file changes, known issues, and the exact commit hash on your branch.
