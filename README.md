# Aspirant

A production-ready monorepo scaffold for a **statically exported Next.js** website, shipped to
**GitHub Pages** and as a hardened **container image on GHCR**, with a full CI/CD and
supply-chain-security pipeline.

- **Framework:** Next.js 16 (App Router, `output: "export"`), React 19, TypeScript 6
- **UI:** shadcn/ui (Radix) + Tailwind CSS v4, shared in `packages/ui`
- **TanStack:** Query (+ persist), DB, Table v9, Form, Virtual, Store, Hotkeys, Pacer, Ranger
- **Interactive:** three.js via React Three Fiber / drei / postprocessing, GSAP + ScrollTrigger, Motion, Lenis
- **State and validation:** Zustand, Zod
- **Quality:** ESLint 9 (type-aware), Prettier, Knip, Vitest, Playwright + axe, Lighthouse CI, Husky + commitlint
- **Supply chain:** CycloneDX SBOM, Trivy, CodeQL, Gitleaks, dependency review, Scorecard, cosign, provenance

## Layout

```
apps/web/            The website (Next.js, static export -> apps/web/out)
packages/ui/         Shared shadcn/ui components, hooks, Tailwind v4 theme (@aspirant/ui)
packages/config/     Shared tsconfig, ESLint flat config, Prettier config (@aspirant/config)
docker/              nginx config + security headers for the container
.github/             Workflows, composite setup action, Dependabot, templates
Dockerfile           Multi-stage build -> non-root nginx on :8080
```

## Quick start

Requires Node >= 22.13 and pnpm 10 (`corepack enable` picks the pinned version).

```sh
pnpm install
pnpm dev            # http://localhost:3000
```

| Command                 | What it does                                                         |
| ----------------------- | -------------------------------------------------------------------- |
| `pnpm dev`              | Next.js dev server                                                   |
| `pnpm build`            | Static export to `apps/web/out`                                      |
| `pnpm start`            | Serve the export locally                                             |
| `pnpm check`            | Prettier check, typecheck, ESLint, unit tests and Knip (the CI gate) |
| `pnpm typecheck`        | `tsc` in every package                                               |
| `pnpm lint`             | ESLint (type-aware) in every package                                 |
| `pnpm format`           | Prettier write                                                       |
| `pnpm test`             | Vitest unit tests                                                    |
| `pnpm test:e2e`         | Playwright against the **static export** (run `pnpm build` first)    |
| `pnpm test:e2e:install` | Install the Playwright Chromium build                                |
| `pnpm sbom`             | CycloneDX SBOM of the lockfile -> `sbom.cdx.json`                    |
| `pnpm audit:prod`       | `pnpm audit` for production dependencies (high and above)            |
| `pnpm docker:build`     | Build the container locally                                          |
| `pnpm docker:run`       | Run it on http://localhost:8080                                      |

## Pages in the demo app

| Route   | Shows                                                                                      |
| ------- | ------------------------------------------------------------------------------------------ |
| `/`     | R3F hero scene (bloom, pointer parallax), Motion entrance, GSAP ScrollTrigger, Lenis       |
| `/ui`   | shadcn/ui components, dialog, toast, switch, slider, TanStack Form + Zod validation        |
| `/data` | Query, DB live query, Table v9 sorting/paging, Virtual list, Pacer, Hotkeys, Ranger, Store |

Replace them with your own; the wiring (providers, theme, stores) is the reusable part.

## Static export and GitHub Pages

`next build` writes plain files to `apps/web/out`. There is no server runtime, so anything that
needs one (API routes, middleware, ISR, `next/image` optimisation, runtime `headers()`) is
unavailable by design.

1. Repository **Settings -> Pages -> Source: GitHub Actions**.
2. Push to `main`; `.github/workflows/pages.yml` builds and deploys.
3. The site is built for a **domain root** (custom domain or `<org>.github.io`). For a project page
   (`https://org.github.io/repo`) set the repository variable `BASE_PATH=/repo`. Optionally set
   `SITE_URL` to override the canonical origin.

`apps/web/public/.nojekyll` is shipped so GitHub Pages serves the `_next/` directory.

## Container (GHCR)

```sh
pnpm docker:build && pnpm docker:run   # http://localhost:8080
```

- Multi-stage: pnpm install (cached on the lockfile) -> static build -> `nginx-unprivileged`.
- Runs as **uid 101** and listens on **8080**. It is designed to run with `--read-only --cap-drop ALL`,
  which is exactly how `docker.yml` runs it in CI.
- `docker/security-headers.conf`: CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, COOP/CORP. `docker/nginx.conf`: immutable caching for hashed assets,
  `no-cache` for HTML, gzip, `/healthz`, proper 404 page.
- The CSP allows `'unsafe-inline'` scripts because Next's static export emits inline bootstrap
  scripts. Move to hashes if you need a stricter policy.
- nginx listens on IPv4 only so it starts on hosts without IPv6; add a `listen [::]:8080;` line to enable it.

Verify a published image:

```sh
cosign verify ghcr.io/<owner>/<repo>:<tag> \
  --certificate-identity-regexp 'https://github.com/<owner>/<repo>/' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

## CI/CD

| Workflow         | Trigger                                 | What it does                                                                                                                                                                                                                                                                           |
| ---------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`         | PR, push to `main`                      | Prettier, typecheck, ESLint, Knip, unit + coverage, build + export check, e2e (desktop + mobile), `pnpm audit`, commitlint, actionlint + hadolint, **`CI passed`** gate                                                                                                                |
| `pages.yml`      | push to `main`                          | Build, deploy to GitHub Pages, smoke-test the live URL                                                                                                                                                                                                                                 |
| `docker.yml`     | PR (container paths), `main`, `v*` tags | Build, Trivy (fail on fixable HIGH/CRITICAL, SARIF to code scanning), run hardened container, smoke + header + non-root checks, **e2e against the container**; on `main`/tags push multi-arch image with SBOM + max provenance, cosign signature, SBOM attestation, GitHub attestation |
| `security.yml`   | PR, `main`, weekly                      | CodeQL, dependency review, Trivy repo scan, Gitleaks (full history), source SBOM, Scorecard, weekly re-scan of the published image                                                                                                                                                     |
| `lighthouse.yml` | PR, `main`                              | Lighthouse CI (accessibility is a hard gate; performance/SEO/best-practices warn)                                                                                                                                                                                                      |
| `release.yml`    | `v*.*.*` tag                            | Full check, packaged site + SBOM with provenance attached to a GitHub Release                                                                                                                                                                                                          |

Make the **`CI passed`** job a required status check in branch protection. Dependabot
(`.github/dependabot.yml`) updates npm, Actions and Docker weekly in grouped PRs with a 3-day cooldown.

### Things to do once the repo is on GitHub

- Pin third-party Actions to commit SHAs (they are on major tags now; Dependabot keeps them current,
  or run `pinact`). Bump `aquasecurity/trivy-action` to its latest release.
- Pin the base images in the `Dockerfile` by digest (`node:22-alpine`, `nginxinc/nginx-unprivileged:stable-alpine`).
- Enable **Dependency graph**, **Code scanning** and **Secret scanning** (CodeQL, dependency review and
  SARIF uploads need them; private repos need GitHub Advanced Security).
- Add a `CODEOWNERS` file for your team.

## Adding shadcn/ui components

`packages/ui/components.json` is configured for the monorepo layout. From `packages/ui`:

```sh
pnpm dlx shadcn@latest add calendar chart drawer command carousel resizable input-otp
```

The libraries behind those components (`react-day-picker`, `recharts`, `vaul`, `cmdk`,
`embla-carousel-react`, `react-resizable-panels`, `input-otp`) are already installed and allow-listed in
`knip.jsonc`; remove each entry once you add the component that uses it. Import from the app with
`@aspirant/ui/components/<name>`.

## Dependency management

Versions live once in the `catalog:` section of `pnpm-workspace.yaml`; packages reference them with
`"dep": "catalog:"`. `minimumReleaseAge` (24h) makes pnpm skip brand-new releases, and dependency
lifecycle scripts are blocked except the `onlyBuiltDependencies` allow-list.

Intentional version choices: **TypeScript 6** (typescript-eslint does not support TS 7 yet),
**ESLint 9** (some plugins do not support 10 yet), **jsdom 29** and **lint-staged 16** (wider Node 22 support).
`@tanstack/react-ranger` still declares a React <= 18 peer range; it is overridden in
`peerDependencyRules` and works with React 19.

TanStack **Router** and **Start** are not included: they are full frameworks that overlap with the Next.js
App Router rather than complementing it.

## License

MIT
