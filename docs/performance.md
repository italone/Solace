# Performance

This document defines how Solace performance should be measured. It does not claim unverified results.

## Current Validation

The repository currently validates behavior with:

- Unit tests for reactivity, scheduler, renderer, components, events, JSX runtime, store, and package exports.
- Playwright e2e tests for basic counter, todo app, and a 10,000-row large list example.
- Rollup production build checks.
- Tinybench smoke benchmarks for initial render, list diff, keyed insert/remove/move/reorder,
  Fragment rendering, batched component updates, and mount/unmount loops.
- Chromium browser production benchmark for large-list initial render, reactive update, unmount,
  and keyed reorder through `pnpm benchmark:browser`.

The large-list e2e test confirms that 10,000 rows can render and one selected row can update in a browser smoke test. It is not a benchmark result.

## Latest Local Benchmark Run

Date: 2026-07-21

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
SOLACE_BENCHMARK_HISTORY_PATH=.benchmark-history/jsdom.jsonl SOLACE_BENCHMARK_SAMPLE_SIZE=3 pnpm benchmark
```

The command logs a `benchmark metadata` JSON line before running the jsdom benchmark suite. The metadata includes package name/version, Node version, OS platform/release/architecture, CPU model, logical CPU count, total memory, benchmark runner, benchmark environment, sample size, and an ISO timestamp.

`sampleSize` defaults to `1` so `pnpm benchmark` remains a smoke benchmark run. Set
`SOLACE_BENCHMARK_SAMPLE_SIZE=3 pnpm benchmark` to run three independent Vitest benchmark samples.
The command reports the configured sample size in metadata, but it does not yet aggregate medians.

Set `SOLACE_BENCHMARK_HISTORY_PATH=.benchmark-history/jsdom.jsonl pnpm benchmark` to append one
JSONL record after a successful jsdom benchmark run. History recording is opt-in and records
metadata plus run status. Records created by the current benchmark runner also include
task-level Tinybench metrics under `summary.tasks`.

The local ignored jsdom history currently contains records with task-level Tinybench metrics when created by the current
benchmark runner. `pnpm benchmark:history -- --json` summarizes those jsdom task metrics with count, median, p95, and
variance while still accepting older metadata-only records.

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
  stable child component updates when parent rerenders do not change child props or children, skip
  unchanged keyed element sibling patches during local list updates, and avoid prop patching plus `Object.keys`
  props scans for keyed child-only updates. Unkeyed appended all-element suffixes
  batch through a `DocumentFragment` after index patching, and safe removed leaf suffixes detach through
  a temporary `DocumentFragment`, including adjacent old keyed runs removed during mixed placement. Keyed
  mixed insert/move patches now mount new children directly at their final anchor instead of appending and
  moving them. Contiguous all-element keyed insert segments also batch through a `DocumentFragment` before
  one parent insert, including adjacent new runs discovered during mixed keyed placement. The component update path
  also avoids repeated enqueue attempts while a component update is already pending. The component initial mount path
  also batches child inserts through a `DocumentFragment`. The initial element mount path now uses a conservative props
  fast path for ordinary attributes, avoiding `Object.entries()` scans and redundant attribute removals on fresh
  elements. It also uses a direct HTML `className` fast path for `class` props while keeping the existing attribute
  fallback for non-HTML nodes. Fully matched keyed middle segments also skip unused-old `Set` tracking and unmount
  scanning, so stable keyed reorders avoid bookkeeping that cannot produce removals while preserving the existing LIS
  move path. The keyed reorder move loop also batches consecutive moved existing children through `DocumentFragment`
  inserts, reducing high-movement DOM insert calls while preserving node identity. Next optimization work should focus
  on additional browser trend samples.

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
| Keyed reorder (reverse)     | 10,000 rows | first row becomes `Row 10000`          |
| Keyed reorder (sorted)      | 10,000 rows | first row stays `Row 1`                |
| Keyed reorder (swap)        | 10,000 rows | first row becomes `Row 2`              |
| Keyed reorder (shuffle)     | 10,000 rows | first row matches seeded result        |
| Keyed reorder (shift)       | 10,000 rows | first row becomes `Row 9901`           |

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
one Playwright run. Each sample runs both `large-list` and `keyed-reorder`, and the command logs one
`browser benchmark summary` line per scenario per sample.

Set `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl pnpm benchmark:browser`
to append one JSONL record after each successful Chromium production benchmark sample. Browser history
records persist the existing summary object; they do not add timing thresholds or statistical aggregation.

The keyed reorder browser result also includes `domMutationCounts`, measured only during the reorder update window.
These counters are diagnostic context for choosing the next renderer performance slice. They are not timing thresholds.
For the current stable reverse reorder fixture, `insertBefore` should be greater than zero, while `setAttribute`,
`removeAttribute`, `textContent`, and `removeChild` should remain zero.

`keyed-reorder` results also include `movePathCounts`, an internal renderer diagnostic captured only during the measured
reorder update window. `domMutationCounts` describes browser-visible DOM writes; `movePathCounts` describes renderer
move-path intent: keyed middle segments, matched old children, new mounts, old removals, LIS length, stable move skips,
existing-node moves, and move-loop anchor lookups. These counters are diagnostic trend context and are not release
thresholds.

`keyed-reorder` runs a shape matrix: `reverse`, `sorted`, `swap-neighbors`, `shuffle`, and
`shift-window`. The `shuffle` shape uses a seeded PRNG so results are deterministic across runs.
Each shape logs its own browser benchmark summary record, allowing comparison of move-path behavior
across stable, pathological, and realistic reorder distributions. After the anchor-node
optimization, every keyed-reorder shape reports `movePathCounts.anchorLookups: 0`.

Run `pnpm benchmark:history` to summarize local JSONL history from `.benchmark-history/jsdom.jsonl`
and `.benchmark-history/browser.jsonl`. Use `pnpm benchmark:history -- --json <path>` for
machine-readable output. The summary reports record counts plus median, p95, and variance for
numeric browser timing metrics, including `initialRenderMs`, `updateMs`, `reorderMs`, and `unmountMs`,
and jsdom task metrics; it does not enforce thresholds.

Use `pnpm benchmark:history -- --min-browser-count 5` to require each browser benchmark scenario
to have at least five local history records. This is an opt-in trend quality gate for local or CI
checks; it is not a timing threshold and does not compare measured performance against a target.
Use `pnpm benchmark:history -- --latest-browser-count 5` to summarize only the latest five browser
records per scenario while leaving jsdom record counts in the summary. This is useful when older
slow samples dominate full-history p95 and the next runtime hotspot needs a fresher trend window.
Run `pnpm benchmark:history -- --help` to list the supported summary options.

### Latest Local Browser History Summary

Date: 2026-07-23

Local history command:

```bash
pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json
```

The local ignored history now contains fresh Chromium production benchmark records from the keyed move-run batching run.
The latest five samples per browser scenario were used for the summary below.

Latest-window `large-list` summary:

| Metric            | Count | Median | p95  | Variance |
| ----------------- | ----- | ------ | ---- | -------- |
| `initialRenderMs` | 5     | 6.4    | 12.6 | 6.34     |
| `updateMs`        | 5     | 3.1    | 5.4  | 1.03     |
| `unmountMs`       | 5     | 1.1    | 4.1  | 1.47     |

Latest-window `keyed-reorder:reverse` summary:

| Metric            | Count | Median | p95 | Variance |
| ----------------- | ----- | ------ | --- | -------- |
| `initialRenderMs` | 5     | 4.7    | 6.5 | 0.62     |
| `reorderMs`       | 5     | 7      | 8.9 | 1.01     |
| `unmountMs`       | 5     | 1.1    | 1.2 | 0.00     |

Latest-window `keyed-reorder:sorted` summary:

| Metric            | Count | Median | p95 | Variance |
| ----------------- | ----- | ------ | --- | -------- |
| `initialRenderMs` | 5     | 5.1    | 6.3 | 0.28     |
| `reorderMs`       | 5     | 2.8    | 3.2 | 0.15     |
| `unmountMs`       | 5     | 1.2    | 1.3 | 0.01     |

Latest-window `keyed-reorder:swap-neighbors` summary:

| Metric            | Count | Median | p95 | Variance |
| ----------------- | ----- | ------ | --- | -------- |
| `initialRenderMs` | 5     | 4.6    | 5.3 | 0.11     |
| `reorderMs`       | 5     | 4      | 5.1 | 0.29     |
| `unmountMs`       | 5     | 1.1    | 1.3 | 0.01     |

Latest-window `keyed-reorder:shuffle` summary:

| Metric            | Count | Median | p95 | Variance |
| ----------------- | ----- | ------ | --- | -------- |
| `initialRenderMs` | 5     | 5      | 5.2 | 0.06     |
| `reorderMs`       | 5     | 6.5    | 7.9 | 0.59     |
| `unmountMs`       | 5     | 1.2    | 1.3 | 0.00     |

Latest-window `keyed-reorder:shift-window` summary:

| Metric            | Count | Median | p95 | Variance |
| ----------------- | ----- | ------ | --- | -------- |
| `initialRenderMs` | 5     | 5.3    | 6.5 | 0.33     |
| `reorderMs`       | 5     | 3.9    | 5   | 0.70     |
| `unmountMs`       | 5     | 1.3    | 1.6 | 0.05     |

After batching consecutive moved existing keyed children through `DocumentFragment` inserts,
every keyed-reorder shape continues to report `movePathCounts.anchorLookups: 0`.
The `reverse` shape now performs one DOM `insertBefore` and one `movePathCounts.movedExistingBatches`
for 9,999 moved existing children. The seeded `shuffle` shape performs 193 DOM `insertBefore`
operations and 191 moved-existing batches for 9,805 moved existing children. The `shift-window`
shape also performs one DOM `insertBefore` and one moved-existing batch. The `sorted` shape performs
zero moves and zero insertions because the renderer's prefix/suffix sync consumes the fully matched
list before entering the keyed middle segment.

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
