# Keyed Reorder Anchor Optimization and Shape Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce keyed reorder move-loop anchor lookups to zero by tracking a running anchor node, and expand the browser benchmark to cover five deterministic keyed reorder shapes.

**Architecture:** Add an inline `anchorNode` variable inside `patchKeyedChildren()` that mirrors the current `getAnchor(newChildren, index + 1)` semantics. Extend the browser benchmark scenario type from a plain string to a `{ scenario: "keyed-reorder"; shape: KeyedReorderShape }` discriminated union while keeping `large-list` unchanged. Add seeded shuffle, neighbor swap, identity, and window-shift transforms to the benchmark fixture.

**Tech Stack:** TypeScript, Solace renderer internals, Vitest, Playwright, Vite, Markdown docs.

---

## File Structure

- Modify `src/renderer/diff.ts`: replace `getAnchor(...)` calls in the keyed move/mount loop with a running `anchorNode`.
- Modify `tests/unit/renderer/diff.test.ts`: add tests asserting `anchorLookups === 0` for multiple reorder shapes.
- Modify `tests/e2e/browser-benchmark-history.ts`: add `shape` field to the keyed-reorder history result type.
- Modify `tests/unit/scripts/browser-benchmark-history.test.ts`: include `shape` in the keyed-reorder fixture and assert JSONL preservation.
- Modify `tests/e2e/browser-benchmark.spec.ts`: iterate all shapes, assert each shape's DOM order and qualitative move-path counts.
- Modify `examples/performance-benchmark/src/main.tsx`: support shape parameter, implement transforms, and include `shape` in the result.
- Modify `docs/performance.md`: document the shape matrix and latest-window results.
- Create `solace-project-log/solace-entries/2026-07-23-keyed-reorder-anchor-optimization-and-shapes.md`: implementation log.
- Modify `solace-project-log/index.md`: append the new log row.

---

### Task 1: Add Renderer RED Tests for Zero Anchor Lookups

**Files:**

- Modify: `tests/unit/renderer/diff.test.ts`

- [ ] **Step 1: Import the instrumentation helpers**

Ensure the test file already imports:

```ts
import {
  disableKeyedReorderMovePathInstrumentation,
  enableKeyedReorderMovePathInstrumentation,
  getKeyedReorderMovePathCounts,
  resetKeyedReorderMovePathCounts,
} from "../../../src/renderer/keyed-reorder-instrumentation";
```

- [ ] **Step 2: Update `afterEach` to reset counters**

Confirm `afterEach` reads:

```ts
afterEach(() => {
  clearDevtoolsListeners();
  resetKeyedReorderMovePathCounts();
  disableKeyedReorderMovePathInstrumentation();
  vi.restoreAllMocks();
});
```

- [ ] **Step 3: Add a RED test for reverse with zero anchor lookups**

Add this test near the existing keyed reorder tests:

```ts
it("tracks keyed reverse reorder without anchor lookups", () => {
  const container = document.createElement("div");

  render(
    h("ul", null, [
      h("li", { key: "a" }, "A"),
      h("li", { key: "b" }, "B"),
      h("li", { key: "c" }, "C"),
      h("li", { key: "d" }, "D"),
    ]),
    container,
  );

  enableKeyedReorderMovePathInstrumentation();

  render(
    h("ul", null, [
      h("li", { key: "d" }, "D"),
      h("li", { key: "c" }, "C"),
      h("li", { key: "b" }, "B"),
      h("li", { key: "a" }, "A"),
    ]),
    container,
  );

  expect([...container.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
    "D",
    "C",
    "B",
    "A",
  ]);
  expect(getKeyedReorderMovePathCounts()).toEqual({
    keyedMiddleSegments: 1,
    matchedOldChildren: 4,
    newChildrenMounted: 0,
    removedOldChildren: 0,
    lisLength: 1,
    stableMoveSkips: 1,
    movedExistingChildren: 3,
    anchorLookups: 0,
  });
});
```

- [ ] **Step 4: Add RED tests for sorted, swap-neighbors, and shift-window**

Add these tests after the reverse test:

```ts
it("tracks sorted keyed children with no moves and no anchor lookups", () => {
  const container = document.createElement("div");

  render(
    h("ul", null, [
      h("li", { key: "a" }, "A"),
      h("li", { key: "b" }, "B"),
      h("li", { key: "c" }, "C"),
    ]),
    container,
  );

  enableKeyedReorderMovePathInstrumentation();

  render(
    h("ul", null, [
      h("li", { key: "a" }, "A"),
      h("li", { key: "b" }, "B"),
      h("li", { key: "c" }, "C"),
    ]),
    container,
  );

  expect([...container.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
    "A",
    "B",
    "C",
  ]);
  expect(getKeyedReorderMovePathCounts()).toEqual({
    keyedMiddleSegments: 1,
    matchedOldChildren: 3,
    newChildrenMounted: 0,
    removedOldChildren: 0,
    lisLength: 3,
    stableMoveSkips: 3,
    movedExistingChildren: 0,
    anchorLookups: 0,
  });
});

it("tracks adjacent swaps with half moves and no anchor lookups", () => {
  const container = document.createElement("div");

  render(
    h("ul", null, [
      h("li", { key: "a" }, "A"),
      h("li", { key: "b" }, "B"),
      h("li", { key: "c" }, "C"),
      h("li", { key: "d" }, "D"),
    ]),
    container,
  );

  enableKeyedReorderMovePathInstrumentation();

  render(
    h("ul", null, [
      h("li", { key: "b" }, "B"),
      h("li", { key: "a" }, "A"),
      h("li", { key: "d" }, "D"),
      h("li", { key: "c" }, "C"),
    ]),
    container,
  );

  expect([...container.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
    "B",
    "A",
    "D",
    "C",
  ]);

  const counts = getKeyedReorderMovePathCounts();

  expect(counts.keyedMiddleSegments).toBe(1);
  expect(counts.matchedOldChildren).toBe(4);
  expect(counts.newChildrenMounted).toBe(0);
  expect(counts.removedOldChildren).toBe(0);
  expect(counts.stableMoveSkips).toBe(2);
  expect(counts.movedExistingChildren).toBe(2);
  expect(counts.anchorLookups).toBe(0);
});

it("tracks window shift reorder with few moves and no anchor lookups", () => {
  const container = document.createElement("div");

  render(
    h("ul", null, [
      h("li", { key: "a" }, "A"),
      h("li", { key: "b" }, "B"),
      h("li", { key: "c" }, "C"),
      h("li", { key: "d" }, "D"),
      h("li", { key: "e" }, "E"),
    ]),
    container,
  );

  enableKeyedReorderMovePathInstrumentation();

  render(
    h("ul", null, [
      h("li", { key: "d" }, "D"),
      h("li", { key: "e" }, "E"),
      h("li", { key: "a" }, "A"),
      h("li", { key: "b" }, "B"),
      h("li", { key: "c" }, "C"),
    ]),
    container,
  );

  expect([...container.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
    "D",
    "E",
    "A",
    "B",
    "C",
  ]);

  const counts = getKeyedReorderMovePathCounts();

  expect(counts.keyedMiddleSegments).toBe(1);
  expect(counts.matchedOldChildren).toBe(5);
  expect(counts.newChildrenMounted).toBe(0);
  expect(counts.removedOldChildren).toBe(0);
  expect(counts.movedExistingChildren).toBe(2);
  expect(counts.anchorLookups).toBe(0);
});
```

- [ ] **Step 5: Run renderer RED tests**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm vitest run tests/unit/renderer/diff.test.ts
```

Expected: the new tests fail because `anchorLookups` is still greater than 0. Existing tests should still pass.

- [ ] **Step 6: Keep RED changes uncommitted until Task 2 passes**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
git status --short
```

Expected: `tests/unit/renderer/diff.test.ts` is modified locally. Do not commit this failing RED state.

---

### Task 2: Implement Running Anchor Node in `patchKeyedChildren()`

**Files:**

- Modify: `src/renderer/diff.ts`
- Test: `tests/unit/renderer/diff.test.ts`

- [ ] **Step 1: Add `anchorNode` initialization**

Inside `patchKeyedChildren()`, immediately after the LIS length recording block, add:

```ts
let anchorNode = getAnchor(newChildren, newEnd + 1);
```

The surrounding code should read:

```ts
const stablePositions = getIncreasingSubsequence(newIndexToOldIndexMap);
if (shouldRecordMovePath) {
  recordKeyedReorderLisLength(stablePositions.length);
}
let stableIndex = stablePositions.length - 1;

let anchorNode = getAnchor(newChildren, newEnd + 1);
```

- [ ] **Step 2: Replace batched mount anchor lookup**

Replace the batched new-children branch from:

```ts
if (runStart < index && canBatchMountChildren(newChildren, runStart, index)) {
  if (shouldRecordMovePath) {
    recordKeyedReorderMountedChildren(index - runStart + 1);
    recordKeyedReorderAnchorLookup();
  }
  mountNewChildren(
    newChildren,
    runStart,
    index,
    container,
    getAnchor(newChildren, index + 1),
    parentComponent,
    appProvides,
  );
  index = runStart;
  continue;
}
```

To:

```ts
if (runStart < index && canBatchMountChildren(newChildren, runStart, index)) {
  if (shouldRecordMovePath) {
    recordKeyedReorderMountedChildren(index - runStart + 1);
  }
  mountNewChildren(
    newChildren,
    runStart,
    index,
    container,
    anchorNode,
    parentComponent,
    appProvides,
  );
  anchorNode = newChildren[runStart].el ?? anchorNode;
  index = runStart;
  continue;
}
```

- [ ] **Step 3: Replace single mount anchor lookup**

Replace the single new-child branch from:

```ts
if (shouldRecordMovePath) {
  recordKeyedReorderMountedChildren(1);
  recordKeyedReorderAnchorLookup();
}
patch(
  null,
  newChildren[index],
  container,
  getAnchor(newChildren, index + 1),
  parentComponent,
  appProvides,
);
continue;
```

To:

```ts
if (shouldRecordMovePath) {
  recordKeyedReorderMountedChildren(1);
}
patch(null, newChildren[index], container, anchorNode, parentComponent, appProvides);
anchorNode = newChildren[index].el ?? anchorNode;
continue;
```

- [ ] **Step 4: Replace stable skip and move anchor lookups**

Replace the stable/move branch from:

```ts
const childEl = newChildren[index].el;
if (childEl === null) {
  continue;
}

if (stableIndex >= 0 && index - newStart === stablePositions[stableIndex]) {
  if (shouldRecordMovePath) {
    recordKeyedReorderStableMoveSkip();
  }
  stableIndex -= 1;
  continue;
}

if (shouldRecordMovePath) {
  recordKeyedReorderMovedExistingChild();
  recordKeyedReorderAnchorLookup();
}
insert(childEl, container, getAnchor(newChildren, index + 1));
```

To:

```ts
const childEl = newChildren[index].el;
if (childEl === null) {
  continue;
}

if (stableIndex >= 0 && index - newStart === stablePositions[stableIndex]) {
  if (shouldRecordMovePath) {
    recordKeyedReorderStableMoveSkip();
  }
  stableIndex -= 1;
  anchorNode = childEl;
  continue;
}

if (shouldRecordMovePath) {
  recordKeyedReorderMovedExistingChild();
}
insert(childEl, container, anchorNode);
anchorNode = childEl;
```

- [ ] **Step 5: Run renderer tests**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm vitest run tests/unit/renderer/diff.test.ts
```

Expected: all 30+ tests pass, including the new zero-anchor-lookup tests.

- [ ] **Step 6: Commit renderer optimization and tests**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
git add src/renderer/diff.ts tests/unit/renderer/diff.test.ts
git commit -m "perf: track keyed reorder anchor node without lookups"
```

Expected: one focused commit containing the anchor optimization and passing renderer tests.

---

### Task 3: Add Shape Support to Browser Benchmark Types

**Files:**

- Modify: `tests/e2e/browser-benchmark-history.ts`
- Modify: `tests/unit/scripts/browser-benchmark-history.test.ts`

- [ ] **Step 1: Add the `shape` field to history types**

In `tests/e2e/browser-benchmark-history.ts`, update the keyed-reorder branch of `BrowserBenchmarkHistoryResult`:

```ts
| {
    scenario: "keyed-reorder";
    shape: string;
    rows: number;
    initialRenderMs: number;
    reorderMs: number;
    unmountMs: number;
    firstRowText: string;
    remainingNodesAfterUnmount: number;
    domMutationCounts: DomMutationCounts;
    movePathCounts: MovePathCounts;
  };
```

- [ ] **Step 2: Update the keyed-reorder fixture**

In `tests/unit/scripts/browser-benchmark-history.test.ts`, add `shape: "reverse"` to `keyedReorderSummary` immediately after `scenario`:

```ts
const keyedReorderSummary: BrowserBenchmarkHistorySummary = {
  scenario: "keyed-reorder",
  shape: "reverse",
  rows: 10_000,
  ...
};
```

And extend the `toMatchObject` assertion in the keyed-reorder history test:

```ts
expect(record.summary).toMatchObject({
  scenario: "keyed-reorder",
  shape: "reverse",
  ...
});
```

- [ ] **Step 3: Run history unit tests**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts
```

Expected: passes.

- [ ] **Step 4: Commit history type updates**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
git add tests/e2e/browser-benchmark-history.ts tests/unit/scripts/browser-benchmark-history.test.ts
git commit -m "test: add keyed reorder shape to browser benchmark history"
```

---

### Task 4: Extend Browser Benchmark Fixture with Shapes

**Files:**

- Modify: `examples/performance-benchmark/src/main.tsx`
- Modify: `tests/e2e/browser-benchmark.spec.ts`

- [ ] **Step 1: Update scenario type and API shape**

In `examples/performance-benchmark/src/main.tsx`, replace:

```ts
type BrowserBenchmarkScenario = "large-list" | "keyed-reorder";
```

With:

```ts
type KeyedReorderShape = "reverse" | "sorted" | "swap-neighbors" | "shuffle" | "shift-window";

type BrowserBenchmarkScenario =
  "large-list" | { scenario: "keyed-reorder"; shape: KeyedReorderShape };
```

- [ ] **Step 2: Update the global API type**

Replace the global declaration with:

```ts
declare global {
  interface Window {
    __SOLACE_BENCHMARK__?: {
      runScenario(scenario: BrowserBenchmarkScenario): Promise<BrowserBenchmarkResult>;
    };
  }
}
```

- [ ] **Step 3: Implement seeded shuffle**

Add this helper near the top of the file after the `rows` declaration:

```ts
function seededRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function shuffleArray<T>(source: T[], seed: number): T[] {
  const values = source.slice();
  const next = seededRandom(seed);

  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(next() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }

  return values;
}
```

- [ ] **Step 4: Implement shape transforms**

Add this helper below `shuffleArray`:

```ts
function applyKeyedReorderShape(rowOrder: number[], shape: KeyedReorderShape): number[] {
  switch (shape) {
    case "reverse":
      return rowOrder.slice().reverse();
    case "sorted":
      return rowOrder.slice();
    case "swap-neighbors":
      return rowOrder.flatMap((row, index) =>
        index % 2 === 0 ? [rowOrder[index + 1] ?? row, row] : [],
      );
    case "shuffle":
      return shuffleArray(rowOrder, 42);
    case "shift-window": {
      const windowSize = 100;
      const shifted = rowOrder.slice(windowSize);
      shifted.unshift(...rowOrder.slice(0, windowSize));
      return shifted;
    }
  }
}
```

- [ ] **Step 5: Update `runScenario` dispatcher**

Replace the dispatcher body with:

```ts
async function runScenario(scenario: BrowserBenchmarkScenario): Promise<BrowserBenchmarkResult> {
  if (scenario === "large-list") {
    return runLargeListBenchmark();
  }

  if (typeof scenario === "object" && scenario.scenario === "keyed-reorder") {
    return runKeyedReorderBenchmark(scenario.shape);
  }

  throw new Error(`Unknown browser benchmark scenario: ${JSON.stringify(scenario)}`);
}
```

- [ ] **Step 6: Update `runKeyedReorderBenchmark` signature and result**

Change the function signature to:

```ts
async function runKeyedReorderBenchmark(shape: KeyedReorderShape): Promise<BrowserBenchmarkResult> {
```

Replace the reorder update line:

```ts
state.rowOrder = [...state.rowOrder].reverse();
```

With:

```ts
state.rowOrder = applyKeyedReorderShape(state.rowOrder, shape);
```

And add `shape` to the result object right after `scenario`:

```ts
const result: BrowserBenchmarkResult = {
  scenario: "keyed-reorder",
  shape,
  rows: rows.length,
  ...
};
```

- [ ] **Step 7: Update the Playwright spec to iterate shapes**

In `tests/e2e/browser-benchmark.spec.ts`, replace:

```ts
const browserBenchmarkScenarios = ["large-list", "keyed-reorder"] as const;
```

With:

```ts
const keyedReorderShapes = [
  "reverse",
  "sorted",
  "swap-neighbors",
  "shuffle",
  "shift-window",
] as const;

const browserBenchmarkScenarios = [
  { scenario: "large-list" as const },
  ...keyedReorderShapes.map((shape) => ({ scenario: "keyed-reorder" as const, shape })),
];
```

Update the loop to pass the scenario object directly:

```ts
for (const scenario of browserBenchmarkScenarios) {
  const result = await page.evaluate(async (scenario) => {
    const benchmarkWindow = window as Window & {
      __SOLACE_BENCHMARK__?: {
        runScenario(scenario: BrowserBenchmarkScenario): Promise<BrowserBenchmarkResult>;
      };
    };
    const api = benchmarkWindow.__SOLACE_BENCHMARK__;
    if (api === undefined) {
      throw new Error("Missing browser benchmark API");
    }

    return api.runScenario(scenario);
  }, scenario);

  const summary = createBrowserBenchmarkSummary(
    result,
    {
      browserName,
      browserVersion: browser.version(),
      projectName: testInfo.project.name,
    },
    sampleSize,
  );

  expectBrowserBenchmarkSummary(summary, sampleSize, scenario);
  console.log(`browser benchmark summary: ${JSON.stringify(summary)}`);

  if (historyPath !== undefined) {
    await appendBrowserBenchmarkHistory(historyPath, summary);
  }
}
```

- [ ] **Step 8: Update `expectBrowserBenchmarkResult` to handle shapes**

Change the function signature to:

```ts
function expectBrowserBenchmarkResult(
  result: BrowserBenchmarkResult,
  scenario: BrowserBenchmarkScenario,
): void {
```

At the top, add:

```ts
const isLargeList = scenario === "large-list" || scenario.scenario === "large-list";
```

Then replace the `large-list` branch check and the keyed-reorder assertions with:

```ts
if (isLargeList) {
  expectFinitePositive(result.updateMs);
  expect(result.selectedText).toContain("Row 5000 selected");
  return;
}

expectFinitePositive(result.reorderMs);
expect(result.shape).toBe(scenario.shape);
expectMovePathCounts(result.movePathCounts);
expect(result.movePathCounts.keyedMiddleSegments).toBe(1);
expect(result.movePathCounts.matchedOldChildren).toBe(10_000);
expect(result.movePathCounts.newChildrenMounted).toBe(0);
expect(result.movePathCounts.removedOldChildren).toBe(0);
expect(result.movePathCounts.anchorLookups).toBe(0);

switch (scenario.shape) {
  case "reverse":
    expect(result.firstRowText).toBe("Row 10000");
    expect(result.movePathCounts.lisLength).toBe(1);
    expect(result.movePathCounts.stableMoveSkips).toBe(1);
    expect(result.movePathCounts.movedExistingChildren).toBe(9999);
    expect(result.domMutationCounts.insertBefore).toBe(9999);
    break;
  case "sorted":
    expect(result.firstRowText).toBe("Row 1");
    expect(result.movePathCounts.lisLength).toBe(10_000);
    expect(result.movePathCounts.stableMoveSkips).toBe(10_000);
    expect(result.movePathCounts.movedExistingChildren).toBe(0);
    expect(result.domMutationCounts.insertBefore).toBe(0);
    break;
  case "swap-neighbors":
    expect(result.firstRowText).toBe("Row 2");
    expect(result.movePathCounts.stableMoveSkips).toBe(5000);
    expect(result.movePathCounts.movedExistingChildren).toBe(5000);
    expect(result.domMutationCounts.insertBefore).toBeGreaterThan(0);
    break;
  case "shuffle":
    expect(result.movePathCounts.movedExistingChildren).toBeGreaterThan(0);
    expect(result.domMutationCounts.insertBefore).toBeGreaterThan(0);
    break;
  case "shift-window":
    expect(result.firstRowText).toBe("Row 1");
    expect(result.movePathCounts.movedExistingChildren).toBe(100);
    expect(result.domMutationCounts.insertBefore).toBeGreaterThan(0);
    break;
}

expect(result.domMutationCounts.setAttribute).toBe(0);
expect(result.domMutationCounts.removeAttribute).toBe(0);
expect(result.domMutationCounts.textContent).toBe(0);
expect(result.domMutationCounts.removeChild).toBe(0);
```

Also update `expectBrowserBenchmarkSummary` signature:

```ts
function expectBrowserBenchmarkSummary(
  summary: BrowserBenchmarkSummary,
  sampleSize: number,
  scenario: BrowserBenchmarkScenario,
): void {
```

- [ ] **Step 9: Run focused checks**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts
```

Expected: passes.

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm benchmark:browser
```

Expected: passes and logs one `large-list` summary and five `keyed-reorder` summaries (one per shape).

- [ ] **Step 10: Commit browser shape fixture**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
git add examples/performance-benchmark/src/main.tsx tests/e2e/browser-benchmark.spec.ts
git commit -m "perf: add keyed reorder shape matrix to browser benchmark"
```

---

### Task 5: Update Documentation and Project Log

**Files:**

- Modify: `docs/performance.md`
- Create: `solace-project-log/solace-entries/2026-07-23-keyed-reorder-anchor-optimization-and-shapes.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update `docs/performance.md`**

Update the measured scenarios table to:

```md
| Scenario                    | Scale       | Assertion                              |
| --------------------------- | ----------- | -------------------------------------- |
| Initial large-list render   | 10,000 rows | selected row 1 is rendered             |
| Reactive selected-row patch | 10,000 rows | selected row 5000 reflects final state |
| Large-list unmount          | 10,000 rows | row nodes are removed                  |
| Keyed reorder (reverse)     | 10,000 rows | first row becomes `Row 10000`          |
| Keyed reorder (sorted)      | 10,000 rows | first row stays `Row 1`                |
| Keyed reorder (swap)        | 10,000 rows | first row becomes `Row 2`              |
| Keyed reorder (shuffle)     | 10,000 rows | first row matches seeded result        |
| Keyed reorder (shift)       | 10,000 rows | first row stays `Row 1`                |
```

Add a note about the shape matrix and seeded shuffle near the `movePathCounts` paragraph:

```md
`keyed-reorder` runs a shape matrix: `reverse`, `sorted`, `swap-neighbors`, `shuffle`, and
`shift-window`. The `shuffle` shape uses a seeded PRNG so results are deterministic across runs.
Each shape logs its own browser benchmark summary record, allowing comparison of move-path behavior
across stable, pathological, and realistic reorder distributions.
```

- [ ] **Step 2: Create implementation log entry**

Create `solace-project-log/solace-entries/2026-07-23-keyed-reorder-anchor-optimization-and-shapes.md` with a structure matching previous entries. Include:

- Summary: added running anchor node and shape matrix.
- Reason: instrumentation showed 9,999 anchor lookups in reverse.
- Scope: renderer diff, browser benchmark, history types/tests, docs.
- Files: list all modified files.
- Verification table with commands and results (fill after running).
- Follow-up: refresh browser trend window.

- [ ] **Step 3: Update log index**

In `solace-project-log/index.md`, add a row for 2026-07-23 entry 001:

```md
| 001 | 优化 keyed reorder anchor lookup 并扩展 shape matrix | renderer performance、browser benchmark、项目日志 | `src/renderer/diff.ts`, `tests/unit/renderer/diff.test.ts`, `examples/performance-benchmark/src/main.tsx`, `tests/e2e/browser-benchmark.spec.ts`, `tests/e2e/browser-benchmark-history.ts`, `tests/unit/scripts/browser-benchmark-history.test.ts`, `docs/performance.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-23-keyed-reorder-anchor-optimization-and-shapes.md) |
```

- [ ] **Step 4: Format and run validation**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm prettier --write docs/performance.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-23-keyed-reorder-anchor-optimization-and-shapes.md
pnpm vitest run tests/unit/renderer/diff.test.ts
pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts
pnpm benchmark:browser
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
git diff --check
```

Expected: all pass.

- [ ] **Step 5: Commit documentation and log**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
git add docs/performance.md docs/superpowers/plans/2026-07-23-keyed-reorder-anchor-optimization-and-shapes.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-23-keyed-reorder-anchor-optimization-and-shapes.md
git commit -m "docs: record keyed reorder anchor optimization and shape matrix"
```

---

### Task 6: Refresh Browser Trend Window

**Files:**

- Modify: `docs/performance.md`
- Create: `solace-project-log/solace-entries/2026-07-23-keyed-reorder-anchor-shape-trend-refresh.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Run a five-sample browser benchmark refresh**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 pnpm benchmark:browser
```

Expected: passes and appends five samples per shape to local ignored history.

- [ ] **Step 2: Summarize the latest window**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json
```

Expected: passes and reports groups for `large-list`, `keyed-reorder:reverse`, `keyed-reorder:sorted`, `keyed-reorder:swap-neighbors`, `keyed-reorder:shuffle`, and `keyed-reorder:shift-window`.

- [ ] **Step 3: Update `docs/performance.md` latest window**

Replace the previous latest-window section with the observed fresh values. Add a short note:

```md
After the anchor-node optimization, every keyed-reorder shape reports `movePathCounts.anchorLookups: 0`.
The `reverse` shape still performs 9,999 DOM `insertBefore` operations, confirming the optimization
removed renderer-internal anchor lookups without changing DOM behavior.
```

- [ ] **Step 4: Create trend refresh log entry**

Create `solace-project-log/solace-entries/2026-07-23-keyed-reorder-anchor-shape-trend-refresh.md` matching the structure of previous trend-refresh entries.

- [ ] **Step 5: Update log index**

Add a row for 2026-07-23 entry 002:

```md
| 002 | 刷新 keyed reorder anchor optimization 与 shape matrix 趋势 | browser benchmark、本地 history、性能文档、项目日志 | `docs/performance.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-23-keyed-reorder-anchor-shape-trend-refresh.md) |
```

- [ ] **Step 6: Format and validate**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm prettier --write docs/performance.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-23-keyed-reorder-anchor-shape-trend-refresh.md
pnpm format:check
git diff --check
```

Expected: all pass.

- [ ] **Step 7: Commit trend refresh**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
git add docs/performance.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-23-keyed-reorder-anchor-shape-trend-refresh.md
git commit -m "docs: refresh keyed reorder anchor optimization trend"
```

**Important:** Do not commit `.benchmark-history/**`.

---

## Final Verification

Run after all tasks:

```bash
cd /Users/alone/Desktop/TEST/Solace
git status --short
```

Expected: no tracked source/doc changes remain.

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm quality
```

Expected: exits with code 0.

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm benchmark:browser
```

Expected: exits with code 0 and logs six summaries (one `large-list` and five `keyed-reorder` shapes).

## Self-Review

- **Spec coverage:**
  - Running anchor optimization: Task 2.
  - Zero anchor lookups: Task 1 tests + Task 2 implementation.
  - Shape matrix: Tasks 3 and 4.
  - Seeded shuffle: Task 4 Step 3.
  - Documentation and trend refresh: Tasks 5 and 6.
- **Placeholder scan:** No TBD/TODO; all steps include concrete code/commands.
- **Type consistency:** `shape` field appears consistently in `BrowserBenchmarkScenario`, `BrowserBenchmarkHistoryResult`, fixture, spec assertions, and benchmark result object.
