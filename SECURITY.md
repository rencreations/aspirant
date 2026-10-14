# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Report them privately through
GitHub: **Security → Advisories → Report a vulnerability** on this repository (or email
`it@labmgm.org`). We aim to acknowledge reports within 3 working days.

## Supported versions

Only the latest release and the `main` branch receive security fixes.

## Supply-chain controls in this repository

- Dependencies are locked (`pnpm-lock.yaml`) and installs are frozen in CI.
- `minimumReleaseAge` in `pnpm-workspace.yaml` and Dependabot `cooldown` delay brand-new releases.
- Dependency lifecycle scripts are blocked except an explicit allow-list (`onlyBuiltDependencies`).
- CI runs CodeQL, dependency review, Trivy (repo and image), Gitleaks, `pnpm audit` and OpenSSF Scorecard.
- Container images are published to GHCR with a CycloneDX SBOM, max-mode build provenance and a
  keyless Sigstore (cosign) signature.

Verify an image:

```sh
cosign verify ghcr.io/<owner>/<repo>:<tag> \
  --certificate-identity-regexp 'https://github.com/<owner>/<repo>/' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```
