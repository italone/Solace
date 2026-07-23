# Keyed Reorder Stable Position Lookup Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce keyed reorder move-loop overhead for high-movement shapes like `shuffle` by replacing the index-array LIS stable-position scan with a direct boolean lookup table.

**Architecture:** Inside `patchKeyedChildren()`, convert the `stablePositions` array returned by `getIncreasingSubsequence()` into a boolean array indexed by `index - newStart`. The move loop then tests stability with a single array read instead of a tracked `stableIndex` and an equality comparison. The LIS algorithm itself and DOM insertion order remain unchanged.

**Tech Stack:** TypeScript, Solace renderer internals, Vitest, Playwright, Markdown docs.

---

## File Structure

- Modify `src/renderer/diff.ts`: build a stable-position boolean lookup table and simplify the move-loop stability check.
- Modify `tests/unit/renderer/diff.test.ts`: add a high-movement shuffle-like fixture test asserting zero anchor lookups and a bounded `insertBefore` count.
- Modify `docs/performance.md`: refresh the latest-window results after running a fresh five-sample browser benchmark.
- Create `solace-project-log/solace-entries/2026-07-23-003-keyed-reorder-stable-position-lookup-optimization.md`: implementation log.
- Modify `solace-project-log/index.md`: append the new log row.

---

### Task 1: Add Renderer RED Test for High-Movement Shuffle Shape

**Files:**

- Modify: `tests/unit/renderer/diff.test.ts`

- [ ] **Step 1: Add a RED test for a shuffle-like high-movement reorder**

Add this test after the existing keyed reorder move-path tests (around line 473):

```ts
it("records keyed high-movement shuffle move-path counters with zero anchor lookups", () => {
  const container = document.createElement("div");

  render(
    h("ul", null, [
      h("li", { key: "a" }, "A"),
      h("li", { key: "b" }, "B"),
      h("li", { key: "c" }, "C"),
      h("li", { key: "d" }, "D"),
      h("li", { key: "e" }, "E"),
      h("li", { key: "f" }, "F"),
      h("li", { key: "g" }, "G"),
      h("li", { key: "h" }, "H"),
    ]),
    container,
  );

  enableKeyedReorderMovePathInstrumentation();

  render(
    h("ul", null, [
      h("li", { key: "d" }, "D"),
      h("li", { key: "a" }, "A"),
      h("li", { key: "e" }, "E"),
      h("li", { key: "b" }, "B"),
      h("li", { key: "h" }, "H"),
      h("li", { key: "c" }, "C"),
      h("li", { key: "f" }, "F"),
      h("li", { key: "g" }, "G"),
    ]),
    container,
  );

  expect([...container.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
    "D",
    "A",
    "E",
    "B",
    "H",
    "C",
    "F",
    "G",
  ]);

  const counts = getKeyedReorderMovePathCounts();

  expect(counts.keyedMiddleSegments).toBe(1);
  expect(counts.matchedOldChildren).toBe(8);
  expect(counts.newChildrenMounted).toBe(0);
  expect(counts.removedOldChildren).toBe(0);
  expect(counts.anchorLookups).toBe(0);
  expect(counts.movedExistingChildren).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run renderer RED tests**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm vitest run tests/unit/renderer/diff.test.ts
```

Expected: the new test passes (it only asserts behavior, not the optimization). Existing tests still pass. This confirms the fixture is valid before changing implementation.

- [ ] **Step 3: Keep RED changes uncommitted until Task 2 passes**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
git status --short
```

Expected: `tests/unit/renderer/diff.test.ts` is modified locally. Do not commit this state yet.

---

### Task 2: Implement Stable Position Boolean Lookup Table

**Files:**

- Modify: `src/renderer/diff.ts`
- Test: `tests/unit/renderer/diff.test.ts`

- [ ] **Step 1: Replace stable-index tracking with a boolean lookup table**

In `patchKeyedChildren()`, replace the block:

```ts
const stablePositions = getIncreasingSubsequence(newIndexToOldIndexMap);
if (shouldRecordMovePath) {
  recordKeyedReorderLisLength(stablePositions.length);
}
let stableIndex = stablePositions.length - 1;

let anchorNode = getAnchor(newChildren, newEnd + 1);
```

With:

```ts
const stablePositions = getIncreasingSubsequence(newIndexToOldIndexMap);
if (shouldRecordMovePath) {
  recordKeyedReorderLisLength(stablePositions.length);
}
const stableSet = new Array<boolean>(newEnd - newStart + 1).fill(false);
for (const position of stablePositions) {
  stableSet[position] = true;
}

let anchorNode = getAnchor(newChildren, newEnd + 1);
```

- [ ] **Step 2: Update the move-loop stability check**

Replace the stable/move branch in the move loop from:

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

To:

```ts
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
```

- [ ] **Step 3: Run renderer tests**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm vitest run tests/unit/renderer/diff.test.ts
```

Expected: all tests pass, including the new high-movement shuffle test and all existing tests.

- [ ] **Step 4: Commit renderer optimization and tests**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
git add src/renderer/diff.ts tests/unit/renderer/diff.test.ts
git commit -m "perf: use boolean lookup table for keyed reorder stable positions"
```

Expected: one focused commit containing the optimization and passing renderer tests.

---

### Task 3: Run Browser Benchmark and Refresh Trend

**Files:**

- Modify: `docs/performance.md`
- Create: `solace-project-log/solace-entries/2026-07-23-003-keyed-reorder-stable-position-lookup-optimization.md`
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

Replace the previous latest-window section with the observed fresh values. Keep the structure used in the existing section. Include a short note:

```md
After replacing the LIS stable-position index scan with a boolean lookup table,
every keyed-reorder shape continues to report `movePathCounts.anchorLookups: 0`.
```

- [ ] **Step 4: Create implementation log entry**

Create `solace-project-log/solace-entries/2026-07-23-003-keyed-reorder-stable-position-lookup-optimization.md` matching the structure of previous entries. Include:

- Summary: replaced LIS index scan with boolean lookup table in move loop.
- Reason: high-movement shapes like `shuffle` spend more iterations in the move loop; the index scan adds a subtraction and equality comparison per iteration.
- Scope: renderer diff, renderer unit tests, performance docs, project log.
- Files: list `src/renderer/diff.ts`, `tests/unit/renderer/diff.test.ts`, `docs/performance.md`, `solace-project-log/**`.
- Verification table with commands and results (fill after running).
- Follow-up: monitor next browser benchmark for `shuffle` reorderMs trend.

Include the full captured JSON summary from Step 2 in a markdown code block under a "Raw summary" section.

- [ ] **Step 5: Update log index**

In `solace-project-log/index.md`, add a row for 2026-07-23 entry 003. Use English commas and spaces between file paths to match existing rows.

```md
| 003 | 优化 keyed reorder 稳定位置查找表 | renderer performance、browser benchmark、性能文档、项目日志 | `src/renderer/diff.ts`, `tests/unit/renderer/diff.test.ts`, `docs/performance.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-23-003-keyed-reorder-stable-position-lookup-optimization.md) |
```

- [ ] **Step 6: Format and validate**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm prettier --write docs/performance.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-23-003-keyed-reorder-stable-position-lookup-optimization.md
pnpm format:check
pnpm vitest run tests/unit/renderer/diff.test.ts
pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts tests/unit/scripts/benchmark-history-summary.test.ts
pnpm typecheck
pnpm lint
git diff --check
```

Expected: all pass.

- [ ] **Step 7: Commit documentation and trend refresh**

Run:

```bash
cd /Users/alone/Desktop/TEST/Solace
git add docs/performance.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-23-003-keyed-reorder-stable-position-lookup-optimization.md
git commit -m "docs: record keyed reorder stable position lookup optimization trend"
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
  - Boolean lookup table for stable positions: Task 2.
  - High-movement test fixture: Task 1.
  - Trend refresh: Task 3.
- **Placeholder scan:** No TBD/TODO; all steps include concrete code/commands.
- **Type consistency:** `stableSet` is a `boolean[]` indexed by `index - newStart`, matching the range of `newIndexToOldIndexMap`.
