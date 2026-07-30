# Benchmark Reporting Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen browser benchmark reporting so keyed reorder runs prove first, middle, and last
row order while preserving the current renderer and benchmark shape contracts.

**Architecture:** Keep the current object-shaped keyed reorder scenario API:
`{ scenario: "keyed-reorder", shape }`. Add row-order evidence to keyed reorder results at the
browser benchmark source, then mirror that evidence in e2e and history tests. Do not merge the stale
`perf/keyed-reorder-move-path-instrumentation` branch or change renderer diff behavior.

**Tech Stack:** TypeScript, TSX, Solace runtime, Playwright, Vitest, pnpm, Prettier.

---

## File Structure

- Modify `examples/performance-benchmark/src/main.tsx`: add keyed reorder row-order evidence
  helpers and include `middleRowText` and `lastRowText` in keyed reorder benchmark results.
- Modify `tests/e2e/browser-benchmark.spec.ts`: assert row-order evidence for each existing keyed
  reorder shape.
- Modify `tests/e2e/browser-benchmark-history.ts`: allow keyed reorder history summaries to carry
  optional `middleRowText` and `lastRowText` for backward-compatible JSONL records.
- Modify `tests/unit/scripts/browser-benchmark-history.test.ts`: prove appended keyed reorder
  history preserves row-order evidence.
- Modify `tests/unit/scripts/benchmark-history-summary.test.ts`: keep keyed reorder shape grouping
  and `--min-jsdom-count` coverage pinned with records that may include row-order evidence.

## Task 1: Add Browser Benchmark Row-Order Assertions

**Files:**

- Modify: `tests/e2e/browser-benchmark.spec.ts`
- Modify: `examples/performance-benchmark/src/main.tsx`

- [ ] **Step 1: Write the failing e2e assertion**

In `tests/e2e/browser-benchmark.spec.ts`, extend the keyed reorder result type with row-order
evidence:

```ts
  | {
      scenario: "keyed-reorder";
      shape: KeyedReorderShape;
      rows: number;
      initialRenderMs: number;
      reorderMs: number;
      unmountMs: number;
      firstRowText: string;
      middleRowText: string;
      lastRowText: string;
      remainingNodesAfterUnmount: number;
      domMutationCounts: DomMutationCounts;
      movePathCounts: MovePathCounts;
    };
```

Add this helper after `const rowCount = 10_000;`:

```ts
function getExpectedKeyedReorderRows(shape: KeyedReorderShape): {
  firstRowText: string;
  middleRowText: string;
  lastRowText: string;
} {
  switch (shape) {
    case "reverse":
      return { firstRowText: "Row 10000", middleRowText: "Row 5000", lastRowText: "Row 1" };
    case "sorted":
      return { firstRowText: "Row 1", middleRowText: "Row 5001", lastRowText: "Row 10000" };
    case "swap-neighbors":
      return { firstRowText: "Row 2", middleRowText: "Row 5002", lastRowText: "Row 9999" };
    case "shuffle":
      return { firstRowText: "Row 9898", middleRowText: "Row 6576", lastRowText: "Row 2524" };
    case "shift-window":
      return { firstRowText: "Row 9901", middleRowText: "Row 4901", lastRowText: "Row 9900" };
  }
}
```

In `expectBrowserBenchmarkResult()`, after `expectFinitePositive(result.reorderMs);`, add:

```ts
const expectedRows = getExpectedKeyedReorderRows(scenario.shape);
expect(result.firstRowText).toBe(expectedRows.firstRowText);
expect(result.middleRowText).toBe(expectedRows.middleRowText);
expect(result.lastRowText).toBe(expectedRows.lastRowText);
```

Remove the per-shape `expect(result.firstRowText)...` assertions from the `switch` block because the
new helper covers every shape.

- [ ] **Step 2: Run e2e to verify RED**

Run:

```bash
pnpm exec playwright test --config playwright.benchmark.config.ts
```

Expected: FAIL for keyed reorder shapes because `middleRowText` and `lastRowText` are `undefined` in
the current browser benchmark result.

- [ ] **Step 3: Implement benchmark row-order evidence**

In `examples/performance-benchmark/src/main.tsx`, add this type below `type KeyedReorderShape`:

```ts
type KeyedReorderRowTexts = {
  firstRowText: string;
  middleRowText: string;
  lastRowText: string;
};
```

Extend the keyed reorder result type with:

```ts
firstRowText: string;
middleRowText: string;
lastRowText: string;
```

Add these helpers after `applyKeyedReorderShape()`:

```ts
function readKeyedReorderRowTexts(container: Element): KeyedReorderRowTexts {
  const rowNodes = container.querySelectorAll("#rows > div");
  const middleIndex = Math.floor(rowNodes.length / 2);

  return {
    firstRowText: rowNodes[0]?.textContent?.trim() ?? "",
    middleRowText: rowNodes[middleIndex]?.textContent?.trim() ?? "",
    lastRowText: rowNodes[rowNodes.length - 1]?.textContent?.trim() ?? "",
  };
}

function getExpectedKeyedReorderRows(shape: KeyedReorderShape): KeyedReorderRowTexts {
  switch (shape) {
    case "reverse":
      return { firstRowText: "Row 10000", middleRowText: "Row 5000", lastRowText: "Row 1" };
    case "sorted":
      return { firstRowText: "Row 1", middleRowText: "Row 5001", lastRowText: "Row 10000" };
    case "swap-neighbors":
      return { firstRowText: "Row 2", middleRowText: "Row 5002", lastRowText: "Row 9999" };
    case "shuffle":
      return { firstRowText: "Row 9898", middleRowText: "Row 6576", lastRowText: "Row 2524" };
    case "shift-window":
      return { firstRowText: "Row 9901", middleRowText: "Row 4901", lastRowText: "Row 9900" };
  }
}

function assertKeyedReorderRows(shape: KeyedReorderShape, actualRows: KeyedReorderRowTexts): void {
  const expectedRows = getExpectedKeyedReorderRows(shape);

  if (
    actualRows.firstRowText !== expectedRows.firstRowText ||
    actualRows.middleRowText !== expectedRows.middleRowText ||
    actualRows.lastRowText !== expectedRows.lastRowText
  ) {
    throw new Error(
      `Unexpected keyed reorder ${shape} row order: ${JSON.stringify({
        expected: expectedRows,
        actual: actualRows,
      })}`,
    );
  }
}
```

In `runKeyedReorderBenchmark()`, replace:

```ts
const reorderedFirstRow = container.querySelector("#rows > div:first-child");
const firstRowText = reorderedFirstRow?.textContent?.trim() ?? "";
```

with:

```ts
const rowTexts = readKeyedReorderRowTexts(container);
assertKeyedReorderRows(shape, rowTexts);
```

Then replace `firstRowText,` in the result object with:

```ts
    ...rowTexts,
```

- [ ] **Step 4: Run e2e to verify GREEN**

Run:

```bash
pnpm exec playwright test --config playwright.benchmark.config.ts
```

Expected: PASS for the browser benchmark scenario suite.

- [ ] **Step 5: Format and commit**

Run:

```bash
pnpm exec prettier --write examples/performance-benchmark/src/main.tsx tests/e2e/browser-benchmark.spec.ts
git add examples/performance-benchmark/src/main.tsx tests/e2e/browser-benchmark.spec.ts
git commit -m "test: assert keyed reorder benchmark row order"
```

Expected: one commit with browser benchmark result and e2e assertion changes.

## Task 2: Preserve Row Evidence In Browser Benchmark History

**Files:**

- Modify: `tests/e2e/browser-benchmark-history.ts`
- Modify: `tests/unit/scripts/browser-benchmark-history.test.ts`

- [ ] **Step 1: Write the history append coverage**

In `tests/unit/scripts/browser-benchmark-history.test.ts`, extend `keyedReorderSummary` with:

```ts
  middleRowText: "Row 5000",
  lastRowText: "Row 1",
```

In the `"appends a keyed reorder browser benchmark history record"` expectation, add:

```ts
        middleRowText: "Row 5000",
        lastRowText: "Row 1",
```

Add this second summary constant after `keyedReorderSummary`:

```ts
const shiftWindowKeyedReorderSummary: BrowserBenchmarkHistorySummary = {
  scenario: "keyed-reorder",
  shape: "shift-window",
  rows: 10_000,
  initialRenderMs: 1,
  reorderMs: 3,
  unmountMs: 1,
  firstRowText: "Row 9901",
  middleRowText: "Row 4901",
  lastRowText: "Row 9900",
  remainingNodesAfterUnmount: 0,
  domMutationCounts: {
    insertBefore: 1,
    setAttribute: 0,
    removeAttribute: 0,
    textContent: 0,
    removeChild: 0,
  },
  movePathCounts: {
    keyedMiddleSegments: 1,
    matchedOldChildren: 10_000,
    newChildrenMounted: 0,
    removedOldChildren: 0,
    lisLength: 9_900,
    stableMoveSkips: 9_900,
    movedExistingChildren: 100,
    movedExistingBatches: 1,
    anchorLookups: 0,
  },
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

Add this test after the keyed reorder append test:

```ts
test("appends keyed reorder row-order evidence for another shape", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "solace-browser-benchmark-history-"));
  const historyPath = join(tempDir, "nested", "browser.jsonl");

  try {
    await appendBrowserBenchmarkHistory(historyPath, shiftWindowKeyedReorderSummary);

    const [line] = (await readFile(historyPath, "utf8")).trim().split("\n");
    const record = JSON.parse(line) as {
      kind: string;
      status: string;
      sampleCount: number;
      summary: BrowserBenchmarkHistorySummary;
    };

    expect(record.summary).toMatchObject({
      scenario: "keyed-reorder",
      shape: "shift-window",
      firstRowText: "Row 9901",
      middleRowText: "Row 4901",
      lastRowText: "Row 9900",
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run unit test to verify RED**

Run:

```bash
pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts
```

Expected: FAIL during transform or type-aware editor feedback until `BrowserBenchmarkHistorySummary`
allows `middleRowText` and `lastRowText` on keyed reorder summaries. If Vitest transpilation does
not typecheck this file, run `pnpm typecheck` and expect the type error there.

- [ ] **Step 3: Update history result type**

In `tests/e2e/browser-benchmark-history.ts`, extend the keyed reorder result type with optional row
evidence fields:

```ts
      firstRowText: string;
      middleRowText?: string;
      lastRowText?: string;
      remainingNodesAfterUnmount: number;
```

Keep these fields optional so existing JSONL records without row-order evidence remain valid.

- [ ] **Step 4: Run unit test and typecheck to verify GREEN**

Run:

```bash
pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts
pnpm typecheck
```

Expected: PASS for the unit test and typecheck.

- [ ] **Step 5: Format and commit**

Run:

```bash
pnpm exec prettier --write tests/e2e/browser-benchmark-history.ts tests/unit/scripts/browser-benchmark-history.test.ts
git add tests/e2e/browser-benchmark-history.ts tests/unit/scripts/browser-benchmark-history.test.ts
git commit -m "test: preserve benchmark row evidence history"
```

Expected: one commit with history type and append coverage changes.

## Task 3: Pin Summary Compatibility And Renderer Non-Regression

**Files:**

- Modify: `tests/unit/scripts/benchmark-history-summary.test.ts`

- [ ] **Step 1: Strengthen summary test inputs**

In `tests/unit/scripts/benchmark-history-summary.test.ts`, update the helper type for keyed reorder
records so row-order evidence can be supplied:

```ts
  | {
      scenario: "keyed-reorder";
      shape?: string;
      initialRenderMs: number;
      reorderMs: number;
      unmountMs: number;
      firstRowText?: string;
      middleRowText?: string;
      lastRowText?: string;
    };
```

In `createBrowserRecord()`, replace the keyed reorder extra fields branch:

```ts
        : { firstRowText: "Row 10000" }),
```

with:

```ts
        : {
            firstRowText: options.firstRowText ?? "Row 10000",
            middleRowText: options.middleRowText ?? "Row 5000",
            lastRowText: options.lastRowText ?? "Row 1",
          }),
```

In the `"groups keyed-reorder browser records by shape"` test, add row-order evidence to at least one
record for each shape group:

```ts
            firstRowText: "Row 10000",
            middleRowText: "Row 5000",
            lastRowText: "Row 1",
```

for `shape: "reverse"`, and:

```ts
            firstRowText: "Row 1",
            middleRowText: "Row 5001",
            lastRowText: "Row 10000",
```

for `shape: "sorted"`.

- [ ] **Step 2: Run summary unit test**

Run:

```bash
pnpm vitest run tests/unit/scripts/benchmark-history-summary.test.ts
```

Expected: PASS. This is a compatibility pin: the implementation already groups by `scenario:shape`,
and the test proves adding row-order evidence does not change grouping or metrics.

- [ ] **Step 3: Run renderer non-regression test**

Run:

```bash
pnpm vitest run tests/unit/renderer/diff.test.ts
```

Expected: PASS. This proves the migration did not change renderer diff behavior or
`movedExistingBatches` expectations.

- [ ] **Step 4: Format and commit**

Run:

```bash
pnpm exec prettier --write tests/unit/scripts/benchmark-history-summary.test.ts
git add tests/unit/scripts/benchmark-history-summary.test.ts
git commit -m "test: pin benchmark summary row evidence compatibility"
```

Expected: one commit with summary compatibility coverage.

## Final Verification

- [ ] **Step 1: Run focused unit validation**

Run:

```bash
pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts tests/unit/scripts/benchmark-history-summary.test.ts tests/unit/renderer/diff.test.ts
```

Expected: PASS for all selected unit tests.

- [ ] **Step 2: Run browser benchmark validation**

Run:

```bash
pnpm exec playwright test --config playwright.benchmark.config.ts
```

Expected: PASS for the browser benchmark e2e suite.

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Inspect final diff**

Run:

```bash
git status --short
git log --oneline -n 6
```

Expected: clean worktree after commits, with design, plan, and implementation commits on
`benchmark-reporting-stabilization`.
