# Keyed Reorder Batch Move Runs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce keyed-reorder DOM mutation cost for high-movement shapes by batching consecutive moved existing children into a single `DocumentFragment` insert inside `patchKeyedChildren()`.

**Architecture:** Keep the existing right-to-left move loop in `src/renderer/diff.ts`. Add a run accumulator that collects moved existing children until the loop hits a stable position, mount, or left boundary, then flushes the run as either a single `insert` or a `DocumentFragment` insert. Add `movedExistingBatches` to the move-path instrumentation so benchmarks can verify the optimization. Refresh the browser benchmark trend and project log after validation.

**Tech Stack:** TypeScript, Solace renderer internals, Vitest, Playwright, Markdown docs.

---

## File Structure

- Modify `src/renderer/keyed-reorder-instrumentation.ts`: add `movedExistingBatches` counter and recorder.
- Modify `src/renderer/diff.ts`: collect consecutive moved existing children and flush as a `DocumentFragment` batch.
- Modify `tests/unit/renderer/diff.test.ts`: add RED tests for batched runs and updated shuffle assertions.
- Modify `tests/e2e/browser-benchmark.spec.ts`: assert `movedExistingBatches` is much smaller than `movedExistingChildren` for `shuffle`.
- Modify `docs/performance.md`: refresh the latest-window browser benchmark summary.
- Create `solace-project-log/solace-entries/2026-07-23-004-keyed-reorder-batch-move-runs.md`: implementation log.
- Modify `solace-project-log/index.md`: append the new entry row.

---

### Task 1: Add Move-Path Batch Counter

**Files:**

- Modify: `src/renderer/keyed-reorder-instrumentation.ts`

- [ ] **Step 1: Add `movedExistingBatches` to the move-path counts type and empty factory**

```ts
export type KeyedReorderMovePathCounts = {
  keyedMiddleSegments: number;
  matchedOldChildren: number;
  newChildrenMounted: number;
  removedOldChildren: number;
  lisLength: number;
  stableMoveSkips: number;
  movedExistingChildren: number;
  movedExistingBatches: number;
  anchorLookups: number;
};

export function createEmptyKeyedReorderMovePathCounts(): KeyedReorderMovePathCounts {
  return {
    keyedMiddleSegments: 0,
    matchedOldChildren: 0,
    newChildrenMounted: 0,
    removedOldChildren: 0,
    lisLength: 0,
    stableMoveSkips: 0,
    movedExistingChildren: 0,
    movedExistingBatches: 0,
    anchorLookups: 0,
  };
}
```

- [ ] **Step 2: Add recorder function**

After `recordKeyedReorderMovedExistingChild` add:

```ts
export function recordKeyedReorderMovedExistingBatch(): void {
  counts.movedExistingBatches += 1;
}
```

- [ ] **Step 3: Run instrumentation unit tests**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts
```

Expected: tests still pass (the fixture does not yet use the new counter).

- [ ] **Step 4: Commit**

```bash
cd /Users/alone/Desktop/TEST/Solace
git add src/renderer/keyed-reorder-instrumentation.ts
git commit -m "feat: add movedExistingBatches move-path counter"
```

---

### Task 2: Add RED Renderer Tests for Batch Move Runs

**Files:**

- Modify: `tests/unit/renderer/diff.test.ts`

- [ ] **Step 1: Add a test for a single two-node moved run**

Add after the existing shuffle move-path test:

```ts
it("batches two consecutive moved children into one movedExistingBatch", () => {
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
      h("li", { key: "c" }, "C"),
      h("li", { key: "a" }, "A"),
      h("li", { key: "d" }, "D"),
    ]),
    container,
  );

  expect([...container.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
    "B",
    "C",
    "A",
    "D",
  ]);

  const counts = getKeyedReorderMovePathCounts();

  expect(counts.keyedMiddleSegments).toBe(1);
  expect(counts.matchedOldChildren).toBe(4);
  expect(counts.newChildrenMounted).toBe(0);
  expect(counts.removedOldChildren).toBe(0);
  expect(counts.anchorLookups).toBe(0);
  expect(counts.movedExistingChildren).toBe(2);
  expect(counts.movedExistingBatches).toBe(1);
  expect(counts.stableMoveSkips).toBe(2);
});
```

- [ ] **Step 2: Add a test for two separated moved runs**

```ts
it("counts two separated moved runs as two movedExistingBatches", () => {
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
      h("li", { key: "b" }, "B"),
      h("li", { key: "a" }, "A"),
      h("li", { key: "d" }, "D"),
      h("li", { key: "e" }, "E"),
      h("li", { key: "c" }, "C"),
    ]),
    container,
  );

  expect([...container.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
    "B",
    "A",
    "D",
    "E",
    "C",
  ]);

  const counts = getKeyedReorderMovePathCounts();

  expect(counts.movedExistingChildren).toBe(4);
  expect(counts.movedExistingBatches).toBe(2);
  expect(counts.stableMoveSkips).toBe(1);
});
```

- [ ] **Step 3: Run RED tests**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm vitest run tests/unit/renderer/diff.test.ts
```

Expected: the two new tests fail because `movedExistingBatches` is still `0`. Existing tests pass.

- [ ] **Step 4: Keep RED changes uncommitted until Task 3 passes**

```bash
cd /Users/alone/Desktop/TEST/Solace
git status --short
```

Expected: `tests/unit/renderer/diff.test.ts` is modified locally. Do not commit yet.

---

### Task 3: Implement Batch Move Runs in `patchKeyedChildren()`

**Files:**

- Modify: `src/renderer/diff.ts`
- Test: `tests/unit/renderer/diff.test.ts`

- [ ] **Step 1: Import the new recorder**

In `src/renderer/diff.ts`, add `recordKeyedReorderMovedExistingBatch` to the keyed-reorder instrumentation import block.

```ts
import {
  isKeyedReorderMovePathInstrumentationEnabled,
  recordKeyedReorderLisLength,
  recordKeyedReorderMatchedOldChild,
  recordKeyedReorderMiddleSegment,
  recordKeyedReorderMountedChildren,
  recordKeyedReorderMovedExistingBatch,
  recordKeyedReorderMovedExistingChild,
  recordKeyedReorderRemovedOldChildren,
  recordKeyedReorderStableMoveSkip,
} from "./keyed-reorder-instrumentation";
```

- [ ] **Step 2: Replace the single-insert move loop with a batched flush**

Replace the move loop from:

```ts
let anchorNode = getAnchor(newChildren, newEnd + 1);

for (let index = newEnd; index >= newStart; index -= 1) {
  if (newIndexToOldIndexMap[index - newStart] === 0) {
    const runStart = getNewRunStart(newIndexToOldIndexMap, newStart, index);
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

    if (shouldRecordMovePath) {
      recordKeyedReorderMountedChildren(1);
    }
    patch(null, newChildren[index], container, anchorNode, parentComponent, appProvides);
    anchorNode = newChildren[index].el ?? anchorNode;
    continue;
  }

  const childEl = newChildren[index].el;
  if (childEl === null) {
    continue;
  }

  if (stableSet[index - newStart]) {
    if (shouldRecordMovePath) {
      recordKeyedReorderStableMoveSkip();
    }
    anchorNode = childEl;
    continue;
  }

  if (shouldRecordMovePath) {
    recordKeyedReorderMovedExistingChild();
  }
  insert(childEl, container, anchorNode);
  anchorNode = childEl;
}
```

To:

```ts
let anchorNode = getAnchor(newChildren, newEnd + 1);
const moveBatch: Node[] = [];

function flushMoveBatch(): void {
  if (moveBatch.length === 0) {
    return;
  }

  if (moveBatch.length === 1) {
    const [node] = moveBatch;
    insert(node, container, anchorNode);
    anchorNode = node;
  } else {
    const fragment = document.createDocumentFragment();
    for (const node of moveBatch) {
      fragment.appendChild(node);
    }
    insert(fragment, container, anchorNode);
    anchorNode = moveBatch[0];
  }

  moveBatch.length = 0;
}

for (let index = newEnd; index >= newStart; index -= 1) {
  if (newIndexToOldIndexMap[index - newStart] === 0) {
    flushMoveBatch();
    const runStart = getNewRunStart(newIndexToOldIndexMap, newStart, index);
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

    if (shouldRecordMovePath) {
      recordKeyedReorderMountedChildren(1);
    }
    patch(null, newChildren[index], container, anchorNode, parentComponent, appProvides);
    anchorNode = newChildren[index].el ?? anchorNode;
    continue;
  }

  const childEl = newChildren[index].el;
  if (childEl === null) {
    flushMoveBatch();
    continue;
  }

  if (stableSet[index - newStart]) {
    flushMoveBatch();
    if (shouldRecordMovePath) {
      recordKeyedReorderStableMoveSkip();
    }
    anchorNode = childEl;
    continue;
  }

  if (shouldRecordMovePath) {
    recordKeyedReorderMovedExistingChild();
  }
  moveBatch.unshift(childEl);
}

flushMoveBatch();
```

- [ ] **Step 3: Record batch count on multi-node flush**

Modify `flushMoveBatch` so it records `movedExistingBatches` only when `moveBatch.length > 1` and instrumentation is enabled:

```ts
function flushMoveBatch(): void {
  if (moveBatch.length === 0) {
    return;
  }

  if (moveBatch.length === 1) {
    const [node] = moveBatch;
    insert(node, container, anchorNode);
    anchorNode = node;
  } else {
    if (shouldRecordMovePath) {
      recordKeyedReorderMovedExistingBatch();
    }
    const fragment = document.createDocumentFragment();
    for (const node of moveBatch) {
      fragment.appendChild(node);
    }
    insert(fragment, container, anchorNode);
    anchorNode = moveBatch[0];
  }

  moveBatch.length = 0;
}
```

- [ ] **Step 4: Run renderer tests**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm vitest run tests/unit/renderer/diff.test.ts
```

Expected: all tests pass, including the two new batch tests and the existing shuffle test.

- [ ] **Step 5: Run full validation**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm format:check
pnpm typecheck
pnpm lint
pnpm vitest run tests/unit/renderer/diff.test.ts tests/unit/scripts/browser-benchmark-history.test.ts
git diff --check
```

Expected: all pass.

- [ ] **Step 6: Commit renderer optimization and tests**

```bash
cd /Users/alone/Desktop/TEST/Solace
git add src/renderer/diff.ts src/renderer/keyed-reorder-instrumentation.ts tests/unit/renderer/diff.test.ts
git commit -m "perf: batch consecutive moved keyed children into DocumentFragment inserts"
```

---

### Task 4: Update Browser Benchmark Spec for Batch Counter

**Files:**

- Modify: `tests/e2e/browser-benchmark.spec.ts`

- [ ] **Step 1: Assert shuffle batch count**

In the `shuffle` switch case of `expectBrowserBenchmarkResult`, add:

```ts
expect(result.movePathCounts.movedExistingBatches).toBeGreaterThan(0);
expect(result.movePathCounts.movedExistingBatches).toBeLessThan(
  result.movePathCounts.movedExistingChildren,
);
```

- [ ] **Step 2: Run browser benchmark**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm benchmark:browser
```

Expected: exits with code 0 and all shape assertions pass. `shuffle` now reports a much smaller `movedExistingBatches` than `movedExistingChildren`.

- [ ] **Step 3: Commit**

```bash
cd /Users/alone/Desktop/TEST/Solace
git add tests/e2e/browser-benchmark.spec.ts
git commit -m "test: assert shuffle moved-existing batches are batched"
```

---

### Task 5: Refresh Browser Benchmark Trend and Project Log

**Files:**

- Modify: `docs/performance.md`
- Create: `solace-project-log/solace-entries/2026-07-23-004-keyed-reorder-batch-move-runs.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Run five-sample browser benchmark**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 pnpm benchmark:browser
```

Expected: passes and appends five samples per shape.

- [ ] **Step 2: Summarize latest window**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json
```

Expected: passes and reports all six scenario groups.

- [ ] **Step 3: Update `docs/performance.md`**

Replace the previous latest-window section with the observed fresh values. Keep the anchor-lookup note and add a note about batch move runs:

```md
After batching consecutive moved keyed children into `DocumentFragment` inserts,
`shuffle` `insertBefore` calls drop from ~9,800 to ~193 while every keyed-reorder
shape continues to report `movePathCounts.anchorLookups: 0`.
```

- [ ] **Step 4: Create implementation log entry**

Create `solace-project-log/solace-entries/2026-07-23-004-keyed-reorder-batch-move-runs.md` matching the structure of previous entries. Include:

- Summary: batched consecutive moved keyed children into DocumentFragment inserts.
- Reason: shuffle analysis showed 9,805 moves grouped into 193 contiguous runs; batching reduces insertBefore calls ~98%.
- Scope: renderer diff, instrumentation, renderer unit tests, browser e2e spec, performance docs, project log.
- Files: list `src/renderer/diff.ts`, `src/renderer/keyed-reorder-instrumentation.ts`, `tests/unit/renderer/diff.test.ts`, `tests/e2e/browser-benchmark.spec.ts`, `docs/performance.md`, `solace-project-log/**`.
- Verification table with commands and results.
- Follow-up: monitor next browser benchmark for `shuffle` reorderMs and `insertBeforeMs` trend.
- Raw summary JSON from Step 2 in a code block.

- [ ] **Step 5: Update log index**

In `solace-project-log/index.md`, append row:

```md
| 004 | 批量移动连续 keyed children | renderer performance、browser benchmark、性能文档、项目日志 | `src/renderer/diff.ts`, `src/renderer/keyed-reorder-instrumentation.ts`, `tests/unit/renderer/diff.test.ts`, `tests/e2e/browser-benchmark.spec.ts`, `docs/performance.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-23-004-keyed-reorder-batch-move-runs.md) |
```

- [ ] **Step 6: Format and validate**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm prettier --write docs/performance.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-23-004-keyed-reorder-batch-move-runs.md
pnpm format:check
pnpm vitest run tests/unit/renderer/diff.test.ts tests/unit/scripts/browser-benchmark-history.test.ts
pnpm typecheck
pnpm lint
git diff --check
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/alone/Desktop/TEST/Solace
git add docs/performance.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-23-004-keyed-reorder-batch-move-runs.md
git commit -m "docs: record keyed reorder batch move runs optimization trend"
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

Expected: exits with code 0 and logs six summaries.

---

## Self-Review

- **Spec coverage:**
  - Batch counter: Task 1.
  - RED batch tests: Task 2.
  - DocumentFragment batching in move loop: Task 3.
  - Browser spec update: Task 4.
  - Trend refresh: Task 5.
- **Placeholder scan:** No TBD/TODO; all steps include concrete code/commands.
- **Type consistency:** `movedExistingBatches` is a `number` added to `KeyedReorderMovePathCounts`, matching the existing counter pattern.
