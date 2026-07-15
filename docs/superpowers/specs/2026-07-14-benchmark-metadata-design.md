# Browser Benchmark Metadata Design

## Context

Solace already has jsdom Tinybench smoke benchmarks and a Chromium production-build browser benchmark. The
browser benchmark logs a `browser benchmark summary` JSON line with measured timings, but the output does not
record the browser version, Node version, OS, package version, CPU, memory, or sample size. `docs/performance.md`
also notes that CPU and memory were not recorded for the latest local benchmark run.

The README next-step list explicitly calls out benchmark trend metadata as a priority. This design keeps that work
narrow and local: improve benchmark reproducibility metadata without adding thresholds, network services, result
storage, or framework comparisons.

## Goals

- Include reproducibility metadata in the browser production benchmark summary.
- Keep the measured browser fixture API focused on runtime measurements.
- Keep the browser benchmark spec scoped to `pnpm benchmark:browser`, not the default example e2e suite.
- Document the metadata fields and the current single-sample behavior.
- Add a project log entry for the change.
- Validate with the existing browser benchmark command plus static checks.

## Non-Goals

- Do not add absolute timing thresholds.
- Do not compare Solace with React, Vue, Svelte, or native DOM.
- Do not persist benchmark history to files or external services.
- Do not change runtime package exports or public framework APIs.
- Do not expand the jsdom Tinybench reporter in this step.

## Recommended Approach

The benchmark app should continue returning only measured browser-side scenario data through
`window.__SOLACE_BENCHMARK__.run()`. The Playwright benchmark test should wrap that result with Node-side metadata
before logging:

- package name and version from `package.json`,
- Node version from `process.version`,
- OS platform, release, and architecture from `node:os`,
- CPU model, logical CPU count, and total memory from `node:os`,
- Playwright browser name and version,
- Playwright project name,
- sample size, fixed to `1` for the current smoke benchmark,
- run timestamp as an ISO string.

The console line should remain prefixed with `browser benchmark summary:` so existing humans/scripts can still find
it. The JSON payload should become a combined object:

```json
{
  "scenario": "large-list",
  "rows": 10000,
  "initialRenderMs": 0,
  "updateMs": 0,
  "unmountMs": 0,
  "selectedText": "Row 5000 selected",
  "remainingNodesAfterUnmount": 0,
  "metadata": {
    "packageName": "solace",
    "packageVersion": "0.0.0",
    "node": "v22.22.2",
    "platform": "darwin",
    "release": "25.4.0",
    "arch": "arm64",
    "cpuModel": "Apple ...",
    "logicalCpuCount": 10,
    "totalMemoryBytes": 17179869184,
    "browserName": "chromium",
    "browserVersion": "...",
    "projectName": "chromium",
    "sampleSize": 1,
    "runAt": "2026-07-14T00:00:00.000Z"
  }
}
```

The default Playwright config should ignore `browser-benchmark.spec.ts`. That spec depends on the production
benchmark fixture served by `playwright.benchmark.config.ts`; the ordinary `pnpm test:e2e` command serves example
apps and should only run the basic counter, todo app, and large-list e2e specs.

## Alternatives Considered

1. **Write benchmark metadata into the browser fixture.** This would make the app aware of Node and Playwright
   concerns it cannot reliably collect itself, so it would blur the fixture boundary.
2. **Add a standalone metadata CLI.** This would be reusable for jsdom and browser benchmarks, but it would not
   automatically bind the metadata to the actual browser benchmark output.
3. **Persist benchmark history to a JSON file.** This is useful later, but it creates churn and raises questions
   about when local machine results should be committed.

The Playwright-wrapper approach is the smallest useful step.

## Testing

- Add assertions in `tests/e2e/browser-benchmark.spec.ts` that validate metadata shape and values.
- Run `pnpm benchmark:browser` to verify production build, preview server, browser execution, and summary output.
- Run `pnpm test:e2e` to verify the default e2e config still excludes the benchmark-only spec.
- Run `pnpm test` for the normal Vitest suite.
- Run `pnpm typecheck`, `pnpm lint`, and `pnpm format:check`.

## Documentation And Logging

- Update `docs/performance.md` to describe benchmark summary metadata and sample size.
- Update `readme.md` so the next-step list reflects that browser benchmark metadata exists, while trend recording
  still remains future work.
- Add `solace-project-log/solace-entries/2026-07-14-002-benchmark-metadata.md`.
- Add the 2026-07-14 `002` row to `solace-project-log/index.md`.

## Risks

- Browser version availability is Playwright-dependent. The test should validate it as a non-empty string rather
  than relying on a fixed format.
- CPU model can be unavailable on unusual runtimes. The metadata builder should fall back to `"unknown"`.
- Timing values remain environment-sensitive. Documentation should keep avoiding performance claims.
- The benchmark spec lives under `tests/e2e`, so default Playwright config must keep excluding it from the ordinary
  example e2e suite.
