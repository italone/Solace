# Release Browser Benchmark Gate Design

## Context

Solace now has two benchmark paths:

- `pnpm benchmark`: jsdom Tinybench smoke benchmarks with machine/runtime metadata.
- `pnpm benchmark:browser`: Chromium production-build benchmark with browser and machine metadata.

The release gate currently runs `pnpm benchmark` and `pnpm test:e2e`, but it does not run
`pnpm benchmark:browser`. That leaves the production-build browser benchmark outside the documented publish
decision path.

## Goals

- Add `pnpm benchmark:browser` to `release:check`.
- Keep `release:publish` behavior as `pnpm release:check && changeset publish`.
- Keep benchmark scripts unchanged.
- Update release documentation and README so the release gate description matches the script.
- Extend release readiness validation so local metadata checks catch a missing `benchmark:browser` gate.
- Add a project log entry.

## Non-Goals

- Do not add timing thresholds.
- Do not persist benchmark results.
- Do not change browser benchmark scenarios.
- Do not change package publishability or remove `"private": true`.

## Design

Change `package.json`:

```json
"release:check": "pnpm quality && pnpm test:coverage && pnpm package:smoke && pnpm benchmark && pnpm benchmark:browser && pnpm test:e2e"
```

`benchmark:browser` should run before ordinary `test:e2e`, because it builds and serves its own production benchmark
fixture through `playwright.benchmark.config.ts`. The ordinary `test:e2e` remains focused on example app behavior.

Update `scripts/release-readiness-check.mjs` to validate that `release:check` includes `pnpm benchmark:browser`.
This keeps the readiness script aligned with the release gate's intended coverage.

## Testing

- Run `pnpm release:readiness` to verify release metadata and script coverage.
- Run `pnpm benchmark:browser` to verify the production browser benchmark path.
- Run `pnpm release:check` if feasible. This is the strongest validation because it exercises the full gate.
- Run `pnpm typecheck`, `pnpm lint`, and `pnpm format:check`.
- Confirm `package.json` still has `"private": true`.

## Risks

- `pnpm release:check` becomes slower and requires a working Playwright browser/preview-server environment.
- Local sandboxed runs may need elevated permission for Vite/Playwright local port binding.
- CI environments need browser dependencies available; the project already uses Playwright e2e, so this does not add
  a new class of dependency.
