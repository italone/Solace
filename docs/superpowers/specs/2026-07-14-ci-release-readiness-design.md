# CI Release Readiness Design

## Context

Solace has a local `pnpm release:readiness` command that checks package metadata, Changesets public access,
release scripts, package file allowlist, and the intentional `"private": true` state. CI currently runs code
quality, build, tests, package smoke, benchmarks, and e2e, but it does not run release readiness.

## Goals

- Add `pnpm release:readiness` to GitHub Actions CI.
- Run it immediately after dependency installation so release metadata problems fail early.
- Keep the existing CI step-by-step structure.
- Update release docs and project log.

## Non-Goals

- Do not publish.
- Do not change `"private": true`.
- Do not replace CI with a single `pnpm release:check`.
- Do not change runtime or package exports.

## Design

Update `.github/workflows/ci.yml`:

```yaml
- name: Install dependencies
  run: pnpm install --frozen-lockfile

- name: Release readiness
  run: pnpm release:readiness

- name: Format check
  run: pnpm format:check
```

This step is cheap, does not need browser dependencies, and catches release script or package metadata drift before
the longer quality/test/benchmark sequence.

## Testing

- Run `pnpm release:readiness`.
- Run `pnpm format:check`.
- Run `pnpm lint` and `pnpm build` for CI-config validation recommendation.
- Confirm CI workflow order by inspecting `.github/workflows/ci.yml`.

## Risks

- Low: readiness is read-only and already passes locally.
- The step intentionally warns about `"private": true` but exits 0 in default mode.
