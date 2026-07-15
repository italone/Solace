# Browser Production Benchmark Design

## Context

Solace currently has jsdom-based tinybench coverage through `pnpm benchmark` and browser smoke
coverage through Playwright e2e tests. The performance documentation explicitly says those jsdom
runs are not browser production benchmarks, and README lists real-browser production benchmark data
as a next step.

The next increment should add a reproducible browser benchmark harness without changing Solace
runtime behavior or making unstable machine-dependent performance claims.

## Goal

Add a dedicated browser production benchmark path that measures these scenarios in Chromium:

- initial render of a large keyed list,
- reactive update of a selected row,
- unmount or replace of the large rendered tree.

The benchmark should produce machine-readable and human-readable timing output, while avoiding
absolute pass/fail thresholds for speed.

## Recommended Approach

Create a focused benchmark example and Playwright spec:

- Add `examples/performance-benchmark/` as a Vite app that imports Solace from the package root.
- Expose benchmark controls/results on `window.__SOLACE_BENCHMARK__`.
- Use `performance.now()` in the browser to measure render, update, and unmount durations.
- Add a Playwright spec under `tests/e2e/` that opens the production preview URL, triggers the
  benchmark API, validates result shape, and logs summary timings.
- Add package scripts that build and preview this example before the Playwright benchmark runs.

This keeps the benchmark close to real user execution: bundled app, browser DOM, Chromium runtime,
and production Vite preview rather than the dev server.

## Benchmark App Design

The benchmark app should render into `#app` and expose a small API:

```ts
type BrowserBenchmarkResult = {
  scenario: "large-list";
  rows: number;
  initialRenderMs: number;
  updateMs: number;
  unmountMs: number;
  selectedText: string;
  remainingNodesAfterUnmount: number;
};

window.__SOLACE_BENCHMARK__ = {
  run(): Promise<BrowserBenchmarkResult>;
};
```

The implementation should:

- Use 10,000 keyed rows, matching the existing large-list example and jsdom benchmark scale.
- Measure initial render from before `render(<LargeList />)` until the selected row is present.
- Measure update by changing reactive state, awaiting `nextTick()`, and checking the selected row.
- Measure unmount by rendering a replacement node and checking the list nodes are gone.
- Write a compact visible result into the page so a manual browser run is still inspectable.

## Playwright Design

Add a dedicated Playwright config or script for the benchmark so normal e2e tests stay stable and
fast. The benchmark test should:

- Start from a production build and preview server for `examples/performance-benchmark`.
- Navigate to the benchmark page.
- Call `window.__SOLACE_BENCHMARK__.run()` with `page.evaluate()`.
- Assert that all timing fields are finite positive numbers and that unmount cleanup leaves no row
  nodes behind.
- Print a single JSON summary line for later manual comparison.

Do not fail on absolute timing values. This benchmark establishes repeatable measurement, not a
performance guarantee.

## Scripts

Add package scripts with explicit names:

- `build:benchmark:browser`: build the Vite benchmark example.
- `benchmark:browser`: run Playwright against the production preview benchmark.

The exact implementation can use a separate Playwright config if that keeps the existing e2e config
unchanged.

## Documentation And Logs

Update:

- `docs/performance.md` with the new browser benchmark command and reporting caveats.
- `readme.md` to replace the duplicated browser benchmark future bullets with a concise follow-up
  about tracking benchmark trends and recording machine metadata.
- `solace-project-log/**` with entry `2026-07-13-016-browser-production-benchmark.md`.

## Validation

Use scoped validation:

- `pnpm benchmark:browser`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`

Run full `pnpm test:e2e` only if the shared Playwright config for existing examples changes.

## Non-Goals

- No runtime renderer optimization.
- No absolute performance threshold.
- No comparison against React, Vue, Svelte, or other frameworks.
- No browser matrix beyond the existing Chromium baseline.
- No CI release gate change until benchmark runtime and flake profile are understood.
