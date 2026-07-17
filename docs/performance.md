# Performance

This document defines how Solace performance should be measured. It does not claim unverified results.

## Current Validation

The repository currently validates behavior with:

- Unit tests for reactivity, scheduler, renderer, components, events, JSX runtime, store, and package exports.
- Playwright e2e tests for basic counter, todo app, and a 10,000-row large list example.
- Rollup production build checks.
- Tinybench smoke benchmarks for initial render, list diff, keyed insert/remove/move/reorder,
  Fragment rendering, batched component updates, and mount/unmount loops.
- Chromium browser production benchmark for large-list initial render, reactive update, and unmount
  through `pnpm benchmark:browser`.

The large-list e2e test confirms that 10,000 rows can render and one selected row can update in a browser smoke test. It is not a benchmark result.

## Latest Local Benchmark Run

Date: 2026-07-13

Environment:

| Item         | Value                   |
| ------------ | ----------------------- |
| OS           | Darwin 25.4.0 arm64 arm |
| Node         | v22.22.2                |
| Runtime      | darwin arm64            |
| Vitest       | 4.1.10                  |
| CPU / memory | Recorded by metadata    |

Command:

```bash
pnpm benchmark
```

The command logs a `benchmark metadata` JSON line before running the jsdom benchmark suite. The metadata includes package name/version, Node version, OS platform/release/architecture, CPU model, logical CPU count, total memory, benchmark runner, benchmark environment, sample size, and an ISO timestamp.

`sampleSize` defaults to `1` so `pnpm benchmark` remains a smoke benchmark run. Set
`SOLACE_BENCHMARK_SAMPLE_SIZE=3 pnpm benchmark` to run three independent Vitest benchmark samples.
The command reports the configured sample size in metadata, but it does not yet aggregate medians.

Set `SOLACE_BENCHMARK_HISTORY_PATH=.benchmark-history/jsdom.jsonl pnpm benchmark` to append one
JSONL record after a successful jsdom benchmark run. History recording is opt-in and records
metadata plus run status; it does not yet parse Tinybench timings, compute medians, or persist
browser benchmark results.

Result summary:

| Scenario                                         | File                                          | Status | Notes                                                                                                                                      |
| ------------------------------------------------ | --------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1,000 component initial render                   | `tests/performance/render.bench.ts`           | Passed | Uses jsdom and Tinybench, intended for trend tracking                                                                                      |
| 10,000 row create/update/delete/reorder          | `tests/performance/list-diff.bench.ts`        | Passed | Covers list creation, text-to-list mount, initial element child mount, unkeyed append/remove, local text update, delete, and keyed reorder |
| 10,000 row keyed local insert/remove/move        | `tests/performance/list-diff.bench.ts`        | Passed | Covers focused middle insert, middle remove, tail-to-head move, mixed insert/move, adjacent insert/move, and adjacent remove/move          |
| 5,000 Fragment child initial render/patch/insert | `tests/performance/fragment.bench.ts`         | Passed | Covers Fragment child mount, keyed text patch, and keyed middle insert                                                                     |
| 1,000 component batched reactive update          | `tests/performance/component-update.bench.ts` | Passed | Covers scheduler batching across many component consumers                                                                                  |
| Component mount/unmount loop                     | `tests/performance/memory.bench.ts`           | Passed | Observes repeated cleanup path and records heap delta during the run                                                                       |

Conclusion:

- The benchmark command is reproducible and currently passes.
- These runs are smoke benchmarks in jsdom, not browser production benchmarks.
- No claim is made that Solace meets or exceeds a specific framework performance target yet.
- The latest renderer follow-ups batch all-element Fragment initial mounts through a `DocumentFragment`,
  batch all-element array children during element initial mount and text-to-array child replacement, skip
  stable child component updates when parent rerenders do not change child props or children, and skip
  unchanged keyed element sibling patches during local list updates. Unkeyed appended all-element suffixes
  batch through a `DocumentFragment` after index patching, and safe removed leaf suffixes detach through
  a temporary `DocumentFragment`, including adjacent old keyed runs removed during mixed placement. Keyed
  mixed insert/move patches now mount new children directly at their final anchor instead of appending and
  moving them. Contiguous all-element keyed insert segments also batch through a `DocumentFragment` before
  one parent insert, including adjacent new runs discovered during mixed keyed placement. Next optimization
  work should focus on additional browser trend samples.

## Browser Production Benchmark

Command:

```bash
pnpm benchmark:browser
```

This command builds `examples/performance-benchmark`, serves the production output through Vite
preview, and runs `tests/e2e/browser-benchmark.spec.ts` in Chromium.

Measured scenarios:

| Scenario                    | Scale       | Assertion                              |
| --------------------------- | ----------- | -------------------------------------- |
| Initial large-list render   | 10,000 rows | selected row 1 is rendered             |
| Reactive selected-row patch | 10,000 rows | selected row 5000 reflects final state |
| Large-list unmount          | 10,000 rows | row nodes are removed                  |

The command logs a `browser benchmark summary` JSON line. It intentionally does not enforce absolute
timing thresholds because browser, CPU, power mode, and background process variance can dominate
individual runs.

The summary also includes reproducibility metadata:

| Field                                                                        | Source                          |
| ---------------------------------------------------------------------------- | ------------------------------- |
| `metadata.packageName` / `metadata.packageVersion`                           | `package.json`                  |
| `metadata.node`                                                              | `process.version`               |
| `metadata.platform`, `metadata.release`, `metadata.arch`                     | Node `os` module                |
| `metadata.cpuModel`, `metadata.logicalCpuCount`, `metadata.totalMemoryBytes` | Node `os` module                |
| `metadata.browserName`, `metadata.browserVersion`, `metadata.projectName`    | Playwright                      |
| `metadata.sampleSize`                                                        | Current benchmark harness       |
| `metadata.runAt`                                                             | ISO timestamp for the local run |

`metadata.sampleSize` defaults to `1` so `pnpm benchmark:browser` remains a smoke benchmark run. Set
`SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=3 pnpm benchmark:browser` to run three independent browser benchmark samples in
one Playwright run. The command logs one `browser benchmark summary` line per sample.

Set `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl pnpm benchmark:browser`
to append one JSONL record after each successful Chromium production benchmark sample. Browser history
records persist the existing summary object; they do not add timing thresholds or statistical aggregation.

Run `pnpm benchmark:history` to summarize local JSONL history from `.benchmark-history/jsdom.jsonl`
and `.benchmark-history/browser.jsonl`. Use `pnpm benchmark:history -- --json <path>` for
machine-readable output. The summary reports record counts plus median, p95, and variance for
numeric browser timing metrics; it does not enforce thresholds.

Use `pnpm benchmark:history -- --min-browser-count 5` to require each browser benchmark scenario
to have at least five local history records. This is an opt-in trend quality gate for local or CI
checks; it is not a timing threshold and does not compare measured performance against a target.
Use `pnpm benchmark:history -- --latest-browser-count 5` to summarize only the latest five browser
records per scenario while leaving jsdom record counts in the summary. This is useful when older
slow samples dominate full-history p95 and the next runtime hotspot needs a fresher trend window.
Run `pnpm benchmark:history -- --help` to list the supported summary options.

### Latest Local Browser History Summary

Date: 2026-07-17

Local history command:

```bash
pnpm benchmark:history -- --min-browser-count 15 --json
```

The local ignored history currently contains seventeen Chromium `large-list` production benchmark records. The
`--min-browser-count 15` trend gate passes locally. p95 still reflects the slowest observed samples and should be
treated as trend context only, not a release threshold.

| Metric            | Count | Median | p95  | Variance |
| ----------------- | ----- | ------ | ---- | -------- |
| `initialRenderMs` | 17    | 8.1    | 28.7 | 31.53    |
| `updateMs`        | 17    | 3.6    | 15.9 | 9.06     |
| `unmountMs`       | 17    | 1.2    | 3.5  | 0.31     |

Latest-window command:

```bash
pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json
```

The latest five Chromium `large-list` records show lower p95 and variance than the full 12-record
history, which indicates older slow samples still dominate the full-history p95.

| Metric            | Count | Median | p95  | Variance |
| ----------------- | ----- | ------ | ---- | -------- |
| `initialRenderMs` | 5     | 7.1    | 13.8 | 7.63     |
| `updateMs`        | 5     | 3.5    | 5.5  | 0.8      |
| `unmountMs`       | 5     | 1.1    | 1.3  | 0.01     |

## Benchmark Principles

Benchmarks should:

- Run in production mode where possible.
- Separate initial render, update, and unmount costs.
- Record browser, OS, Node, package version, and commit.
- Avoid comparing development builds against production builds.
- Report medians and variance, not a single best run.
- Keep benchmark fixtures in source control.

## Suggested Benchmarks

### Reactivity

- Create many reactive objects.
- Track many effects.
- Trigger narrow and broad dependency sets.
- Measure computed cache hits and invalidations.

### Renderer

- Mount 1,000 and 10,000 simple elements.
- Patch text props across a large list.
- Insert, remove, and move keyed children.
- Unmount nested component trees.

### Components

- Mount many small components.
- Batch repeated state writes in one tick.
- Repeatedly mount and unmount component subtrees.
- Verify no retained effects after unmount.

### Store

- Read state directly in components.
- Read computed getters in components.
- Dispatch actions that update narrow state paths.

## Reporting Template

```text
Scenario:
Build mode:
Browser / Node:
Machine:
Sample size:
Median:
p95:
Notes:
```

Performance claims should only be added after this data exists.
