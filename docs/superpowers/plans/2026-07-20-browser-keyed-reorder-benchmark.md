# Browser Keyed Reorder Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Chromium benchmark scenario for 10,000-row keyed reorder and keep browser history summaries compatible.

**Architecture:** Extend the browser benchmark fixture to expose explicit named scenario runners, widen the browser history result types to cover both `large-list` and `keyed-reorder`, and teach the summary CLI to aggregate `reorderMs` without changing existing `large-list` history. Keep Playwright responsible for driving both scenarios per sample, and keep history persistence as one JSONL record per scenario.

**Tech Stack:** TypeScript, Playwright, Vite production preview, Node ESM, Vitest, Markdown, Prettier.

---

## File Structure

- Modify `examples/performance-benchmark/src/main.tsx`: split the current single benchmark flow into named scenario runners and return scenario-specific result objects.
- Modify `tests/e2e/browser-benchmark.spec.ts`: run both browser scenarios per sample and assert their distinct results.
- Modify `tests/e2e/browser-benchmark-history.ts`: widen the result, summary, and record types so `large-list` and `keyed-reorder` stay compatible.
- Modify `tests/unit/scripts/browser-benchmark-history.test.ts`: cover keyed-reorder history summary append behavior and result shape.
- Modify `tests/unit/scripts/benchmark-history-summary.test.ts`: cover `reorderMs` aggregation for keyed-reorder records.
- Modify `scripts/summarize-benchmark-history.mjs`: include `reorderMs` in browser numeric metrics.
- Modify `docs/performance.md`: document the new browser scenario and the summary shape.
- Add `solace-project-log/solace-entries/2026-07-20-016-browser-keyed-reorder-benchmark.md`: record the implementation change.
- Modify `solace-project-log/index.md`: append the 2026-07-20 row for this implementation.

No renderer diff behavior, keyed LIS logic, public API, package exports, or timing thresholds should change in this slice.

---

### Task 1: Add Failing History Shape And Summary Tests

**Files:**

- Modify: `tests/unit/scripts/browser-benchmark-history.test.ts`
- Modify: `tests/unit/scripts/benchmark-history-summary.test.ts`

- [x] **Step 1: Add keyed-reorder expectations**

Update the browser history test with a keyed-reorder fixture and append assertion. Use a summary object shaped like this:

```ts
const keyedReorderSummary: BrowserBenchmarkHistorySummary = {
  scenario: "keyed-reorder",
  rows: 10_000,
  initialRenderMs: 1,
  reorderMs: 2,
  unmountMs: 1,
  firstRowText: "Row 10000",
  remainingNodesAfterUnmount: 0,
  metadata: {
    packageName: "@italone/solace",
    packageVersion: "0.0.0",
    node: process.version,
    platform: "darwin",
    release: "test",
    arch: "arm64",
    cpuModel: "test",
    logicalCpuCount: 1,
    totalMemoryBytes: 1,
    browserName: "chromium",
    browserVersion: "test",
    projectName: "chromium",
    sampleSize: 1,
    runAt: "2026-07-15T00:00:00.000Z",
  },
};
```

Assert that the appended JSONL record preserves `scenario: "keyed-reorder"`, `reorderMs`, and `firstRowText`.

- [x] **Step 2: Add summary aggregation coverage**

Extend the benchmark history summary test with keyed-reorder JSONL records and assert the new metric is summarized:

```ts
expect(keyedReorderGroup).toMatchObject({
  scenario: "keyed-reorder",
  recordCount: 3,
});
expect(keyedReorderGroup?.metrics.reorderMs).toEqual({
  count: 3,
  median: 6,
  p95: 8,
  variance: 4,
});
```

Update the record helper so it can build both `large-list` and `keyed-reorder` summaries.

- [x] **Step 3: Verify the tests fail for the right reason**

Run:

```bash
pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts
pnpm vitest run tests/unit/scripts/benchmark-history-summary.test.ts
```

Expected: the browser history test fails because the result type is still `large-list` only, and the summary test fails because `reorderMs` is not yet aggregated.

---

### Task 2: Widen Browser History Types And Summary Metrics

**Files:**

- Modify: `tests/e2e/browser-benchmark-history.ts`
- Modify: `scripts/summarize-benchmark-history.mjs`
- Modify: `tests/unit/scripts/browser-benchmark-history.test.ts`
- Modify: `tests/unit/scripts/benchmark-history-summary.test.ts`

- [x] **Step 1: Expand the browser history result union**

Change `BrowserBenchmarkHistoryResult` into a discriminated union with two scenarios:

```ts
export type BrowserBenchmarkHistoryResult =
  | {
      scenario: "large-list";
      rows: number;
      initialRenderMs: number;
      updateMs: number;
      unmountMs: number;
      selectedText: string;
      remainingNodesAfterUnmount: number;
    }
  | {
      scenario: "keyed-reorder";
      rows: number;
      initialRenderMs: number;
      reorderMs: number;
      unmountMs: number;
      firstRowText: string;
      remainingNodesAfterUnmount: number;
    };
```

Keep `BrowserBenchmarkHistorySummary` as `BrowserBenchmarkHistoryResult & { metadata: ... }`, and keep `appendBrowserBenchmarkHistory()` writing one JSONL record per summary.

- [x] **Step 2: Add `reorderMs` to browser summary metrics**

Update the browser metric list in `scripts/summarize-benchmark-history.mjs` from:

```js
const numericBrowserMetrics = ["initialRenderMs", "updateMs", "unmountMs"];
```

to:

```js
const numericBrowserMetrics = ["initialRenderMs", "updateMs", "reorderMs", "unmountMs"];
```

Do not change the existing browser grouping key logic; `scenario` should keep separating `large-list` and `keyed-reorder`.

- [x] **Step 3: Re-run the focused tests**

Run:

```bash
pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts
pnpm vitest run tests/unit/scripts/benchmark-history-summary.test.ts
```

Expected: both tests pass once the union type and summary metric list are updated.

---

### Task 3: Implement The Dual-Scenario Browser Benchmark

**Files:**

- Modify: `examples/performance-benchmark/src/main.tsx`
- Modify: `tests/e2e/browser-benchmark.spec.ts`

- [x] **Step 1: Split the fixture into named runners**

Replace the current single `runBenchmark()` path with explicit scenario runners, for example:

```ts
type BrowserBenchmarkScenario = "large-list" | "keyed-reorder";

type BrowserBenchmarkApi = {
  runScenario(scenario: BrowserBenchmarkScenario): Promise<BrowserBenchmarkResult>;
};
```

Keep the existing `large-list` behavior unchanged. Add a keyed-reorder runner that mounts 10,000 keyed rows, reverses the row order, measures the reorder patch, asserts the first rendered row text is `Row 10000`, and then unmounts.

- [x] **Step 2: Drive both scenarios from Playwright**

Update the e2e test to iterate over both scenarios for each sample:

```ts
for (const scenario of ["large-list", "keyed-reorder"] as const) {
  const result = await page.evaluate(async () => {
    const api = window.__SOLACE_BENCHMARK__;
    if (api === undefined) {
      throw new Error("Missing browser benchmark API");
    }

    return api.runScenario(scenario);
  });

  expectBrowserBenchmarkResult(result, scenario);
}
```

Keep the history append path unchanged so each scenario still produces one JSONL record per sample.

- [x] **Step 3: Verify the browser benchmark in Chromium**

Run:

```bash
pnpm benchmark:browser
```

Expected: Chromium runs both scenarios successfully, prints one `browser benchmark summary` line per scenario per sample, and preserves the existing `large-list` assertions.

---

### Task 4: Update Documentation, Project Log, And Final Validation

**Files:**

- Modify: `docs/performance.md`
- Add: `solace-project-log/solace-entries/2026-07-20-016-browser-keyed-reorder-benchmark.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Document the new browser scenario**

Update the browser benchmark section in `docs/performance.md` so it lists both measured scenarios:

| Scenario                    | Scale       | Assertion                              |
| --------------------------- | ----------- | -------------------------------------- |
| Initial large-list render   | 10,000 rows | selected row 1 is rendered             |
| Reactive selected-row patch | 10,000 rows | selected row 5000 reflects final state |
| Large-list unmount          | 10,000 rows | row nodes are removed                  |
| Keyed reorder               | 10,000 rows | first row becomes `Row 10000`          |

Also update the latest-history section to mention `reorderMs` in browser summary metrics.

- [x] **Step 2: Add the implementation log entry and index row**

Create `solace-project-log/solace-entries/2026-07-20-016-browser-keyed-reorder-benchmark.md` and append a `2026-07-20` row `016` to `solace-project-log/index.md`. The log should state that this work extends the browser benchmark harness and does not change renderer behavior.

- [x] **Step 3: Run the validation suite**

Run:

```bash
pnpm exec prettier --write docs/superpowers/plans/2026-07-20-browser-keyed-reorder-benchmark.md solace-project-log/solace-entries/2026-07-20-015-browser-keyed-reorder-benchmark-plan.md solace-project-log/index.md
pnpm format:check
pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts
pnpm vitest run tests/unit/scripts/benchmark-history-summary.test.ts
git diff --check
```

Expected: formatting passes, diffs are whitespace-clean, and the plan files match the repository style.

- [ ] **Step 4: Commit the plan**

Run:

```bash
git add docs/superpowers/plans/2026-07-20-browser-keyed-reorder-benchmark.md solace-project-log/solace-entries/2026-07-20-015-browser-keyed-reorder-benchmark-plan.md solace-project-log/index.md
git commit -m "docs: plan browser keyed reorder benchmark"
```

---

## Coverage Check

- Browser benchmark shape: Task 2 and Task 3 cover the new `keyed-reorder` scenario and keep `large-list` compatible.
- Browser history summary: Task 1 and Task 2 cover `reorderMs` aggregation and type widening.
- Browser benchmark execution: Task 3 drives both scenarios from Chromium.
- Documentation and logging: Task 4 updates the performance doc and project log.
