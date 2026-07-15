# CI Browser Benchmark Gate Design

## Context

Local `pnpm release:check` now runs both benchmark paths:

- `pnpm benchmark` for jsdom Tinybench smoke scenarios.
- `pnpm benchmark:browser` for the Chromium production-build benchmark.

The GitHub Actions CI workflow still runs `pnpm benchmark` and ordinary `pnpm test:e2e`, but not
`pnpm benchmark:browser`. That means CI no longer matches the local release gate.

## Goals

- Add a CI step that runs `pnpm benchmark:browser`.
- Keep the current CI step granularity for clear failure logs.
- Run the browser benchmark after `pnpm exec playwright install --with-deps chromium`.
- Update docs and project logs so CI coverage is explicit.

## Non-Goals

- Do not replace CI steps with a single `pnpm release:check`.
- Do not add new GitHub Actions jobs or matrix builds.
- Do not change Playwright configuration.
- Do not change runtime or benchmark scenarios.

## Design

Update `.github/workflows/ci.yml`:

```yaml
- name: Install Playwright browsers
  run: pnpm exec playwright install --with-deps chromium

- name: Browser benchmark
  run: pnpm benchmark:browser

- name: E2E
  run: pnpm test:e2e
```

This keeps CI readable while aligning it with the release gate. `benchmark:browser` must run after browser install
because it uses Chromium through Playwright and serves the production benchmark build through Vite preview.

## Testing

- Run `pnpm benchmark:browser` locally to validate the command being added to CI.
- Run `pnpm format:check` because workflow YAML and docs are formatted by Prettier.
- Optionally run `pnpm release:check` when validating the full release gate; it was run after adding
  `benchmark:browser` to `release:check`.

## Risks

- CI duration increases by the browser benchmark build and Playwright run.
- CI needs Chromium dependencies; this is already satisfied by the existing Playwright install step.
- Local sandbox validation requires elevated permission for the Vite preview server port.
