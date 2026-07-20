# Browser Keyed Reorder Benchmark Design

## Context

Solace has shipped `@italone/solace@0.0.1` and the development line is back on performance work. The latest local
Chromium browser benchmark history contains 50 `large-list` production records. The latest five browser samples show
median timings of 7.0 ms initial render, 3.5 ms selected-row update, and 1.1 ms unmount.

The browser benchmark currently measures only initial mount, one reactive text/class update, and unmount for a 10,000
row keyed list. It does not measure keyed reorder behavior in a real production browser build. The jsdom benchmark
suite does include `10000 row keyed reorder`, and that task remains the largest jsdom timing hotspot. Before choosing a
runtime optimization for keyed reorder, the benchmark harness should expose that scenario in Chromium.

## Goal

Add a Chromium production browser benchmark scenario for 10,000-row keyed reorder and record `reorderMs` in browser
history summaries.

## Non-Goals

- Do not change renderer diff behavior, keyed LIS behavior, VNode shape, component behavior, or public APIs.
- Do not add timing thresholds or fail release checks based on absolute timing values.
- Do not compare Solace against external frameworks.
- Do not commit local `.benchmark-history/**` files.
- Do not replace the existing `large-list` browser scenario.
- Do not add a general benchmark scenario plugin system in this slice.

## Proposed Approach

Keep the benchmark harness small and explicit. Extend `examples/performance-benchmark/src/main.tsx` from one `run()`
method into an API that can run named scenarios:

- `large-list`: the existing initial render, selected-row update, and unmount scenario.
- `keyed-reorder`: a new scenario that mounts 10,000 keyed rows, reorders them in reverse order, measures the reorder
  patch, verifies the first visible row is `Row 10000`, then unmounts.

The Playwright benchmark should call both scenarios for each sample. It should continue to write one JSONL browser
history record per scenario per sample when `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH` is set.

`tests/e2e/browser-benchmark-history.ts` should widen the browser result type so `large-list` keeps `updateMs` while
`keyed-reorder` has `reorderMs`. `scripts/summarize-benchmark-history.mjs` should include `reorderMs` in
`numericBrowserMetrics` so `pnpm benchmark:history -- --json` reports count, median, p95, and variance for the new
scenario.

## Alternatives Considered

### Add Reorder Timing To The Existing Scenario

This would be the smallest fixture change, but it would mix reactive selected-row update and full keyed reorder into
one result shape. Separate scenarios make trend output clearer and keep the current `large-list` history comparable.

### Add A Generic Scenario Registry

A registry would make future scenario additions tidier, but it is more abstraction than this slice needs. Two explicit
methods keep the benchmark surface easy to inspect.

### Optimize Keyed Reorder Immediately

The jsdom task is clearly hot, but the browser benchmark does not yet prove how keyed reorder behaves in Chromium. The
next runtime optimization should be chosen after this browser scenario exists and has a small trend window.

## Result Shape

`large-list` history records should remain compatible with existing local history:

```json
{
  "scenario": "large-list",
  "rows": 10000,
  "initialRenderMs": 7,
  "updateMs": 3.5,
  "unmountMs": 1.1
}
```

New keyed reorder records should include `reorderMs` instead of `updateMs`:

```json
{
  "scenario": "keyed-reorder",
  "rows": 10000,
  "initialRenderMs": 7,
  "reorderMs": 50,
  "unmountMs": 1.1,
  "firstRowText": "Row 10000",
  "remainingNodesAfterUnmount": 0
}
```

Exact timing values are illustrative. Implementation should use real browser measurements and keep all reproducibility
metadata already attached to browser summaries.

## Behavioral Requirements

- `pnpm benchmark:browser` still runs in Chromium against the Vite production preview build.
- The existing `large-list` scenario keeps its current assertions and history compatibility.
- The new `keyed-reorder` scenario mounts 10,000 keyed rows before measuring reorder time.
- The reorder step must preserve DOM node count and put `Row 10000` first after reversing the list.
- The scenario must unmount and verify no row nodes remain.
- `SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 pnpm benchmark:browser` should run both scenarios five times.
- `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl pnpm benchmark:browser` should append one
  record per scenario per sample.
- `pnpm benchmark:history -- --json` should summarize `keyed-reorder` as a separate browser group and include
  `reorderMs` metrics.

## Test Plan

Implementation should use focused tests around the benchmark types and summary behavior:

- Update browser history unit tests to accept the `keyed-reorder` result shape.
- Add a benchmark history summary unit test proving `reorderMs` is summarized for `keyed-reorder`.
- Run the browser benchmark once to verify both scenarios execute in Chromium.
- Run the benchmark with a history path and sample size when refreshing local trend context.

Validation commands:

- `pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts`
- `pnpm vitest run tests/unit/scripts/benchmark-history-summary.test.ts`
- `pnpm benchmark:browser`
- `pnpm benchmark:history -- --json`
- `pnpm test:e2e`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`
- `git diff --check`

## Documentation And Logging

Implementation should update:

- `docs/performance.md` to list the new Chromium keyed reorder scenario and explain `reorderMs`.
- `solace-project-log/index.md` and a new implementation log entry.

This design document is tracked as `2026-07-20-014`.

## Risk And Safety

The main risk is contaminating existing `large-list` history or making trend summaries ambiguous. Keeping scenario names
separate and preserving existing `large-list` fields prevents old records from becoming unreadable. The second risk is
making the browser benchmark too slow for release checks. The scenario should reuse the existing 10,000-row fixture and
remain a smoke benchmark by default with `sampleSize` equal to 1.
