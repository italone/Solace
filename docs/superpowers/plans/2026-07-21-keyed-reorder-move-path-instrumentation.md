# Keyed Reorder Move Path Instrumentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add disabled-by-default keyed reorder move-path counters and include them in browser `keyed-reorder` benchmark results.

**Architecture:** Add a small internal renderer instrumentation module that stores aggregate counters and exposes test/benchmark-only enable, snapshot, reset, and disable helpers. `patchKeyedChildren()` records aggregate middle-segment, LIS, mount/remove, move, skip, and anchor lookup counts only when instrumentation is enabled. The browser benchmark enables the counters only around the measured keyed reorder update window and preserves `movePathCounts` in summary/history records.

**Tech Stack:** TypeScript, Solace renderer internals, Vitest, Playwright browser benchmark, Vite example app, Markdown docs, Prettier.

---

## File Structure

- Create `src/renderer/keyed-reorder-instrumentation.ts`: internal counter types, zero-value factory, enable/disable/reset/snapshot helpers, and narrow record helpers.
- Modify `src/renderer/diff.ts`: import the internal helpers and record keyed middle move-path counters inside `patchKeyedChildren()` without changing DOM behavior.
- Modify `tests/unit/renderer/diff.test.ts`: add RED tests for disabled-default behavior, full reverse counters, and mixed insert/remove/move counters.
- Modify `examples/performance-benchmark/src/main.tsx`: add `MovePathCounts` result type, enable counters around the keyed reorder window, and attach `movePathCounts` beside `domMutationCounts`.
- Modify `tests/e2e/browser-benchmark-history.ts`: widen keyed reorder history types with `movePathCounts`.
- Modify `tests/unit/scripts/browser-benchmark-history.test.ts`: prove JSONL append preserves `movePathCounts`.
- Modify `tests/e2e/browser-benchmark.spec.ts`: assert `movePathCounts` exists only for `keyed-reorder` and has qualitative full-reverse values.
- Modify `docs/performance.md`: document the diagnostic field and the difference between DOM mutation counts and renderer move-path counts.
- Create `solace-project-log/solace-entries/2026-07-21-014-keyed-reorder-move-path-instrumentation.md`: implementation log entry.
- Modify `solace-project-log/index.md`: add the 2026-07-21 `014` implementation row after this plan's log row.

Do not modify `package.json` exports or `rollup.config.mjs`. This instrumentation is internal and must not become a package subpath.

---

### Task 1: Add Renderer Counter RED Tests

**Files:**

- Create: `src/renderer/keyed-reorder-instrumentation.ts`
- Modify: `tests/unit/renderer/diff.test.ts`

- [ ] **Step 1: Create the internal instrumentation module with a zero-value API**

Create `src/renderer/keyed-reorder-instrumentation.ts` with this exact initial content:

```ts
export type KeyedReorderMovePathCounts = {
  keyedMiddleSegments: number;
  matchedOldChildren: number;
  newChildrenMounted: number;
  removedOldChildren: number;
  lisLength: number;
  stableMoveSkips: number;
  movedExistingChildren: number;
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
    anchorLookups: 0,
  };
}

let enabled = false;
let counts = createEmptyKeyedReorderMovePathCounts();

export function enableKeyedReorderMovePathInstrumentation(): void {
  counts = createEmptyKeyedReorderMovePathCounts();
  enabled = true;
}

export function disableKeyedReorderMovePathInstrumentation(): void {
  enabled = false;
}

export function resetKeyedReorderMovePathCounts(): void {
  counts = createEmptyKeyedReorderMovePathCounts();
}

export function isKeyedReorderMovePathInstrumentationEnabled(): boolean {
  return enabled;
}

export function getKeyedReorderMovePathCounts(): KeyedReorderMovePathCounts {
  return { ...counts };
}

export function recordKeyedReorderMiddleSegment(): void {
  counts.keyedMiddleSegments += 1;
}

export function recordKeyedReorderMatchedOldChild(): void {
  counts.matchedOldChildren += 1;
}

export function recordKeyedReorderMountedChildren(amount: number): void {
  counts.newChildrenMounted += amount;
}

export function recordKeyedReorderRemovedOldChildren(amount: number): void {
  counts.removedOldChildren += amount;
}

export function recordKeyedReorderLisLength(amount: number): void {
  counts.lisLength += amount;
}

export function recordKeyedReorderStableMoveSkip(): void {
  counts.stableMoveSkips += 1;
}

export function recordKeyedReorderMovedExistingChild(): void {
  counts.movedExistingChildren += 1;
}

export function recordKeyedReorderAnchorLookup(): void {
  counts.anchorLookups += 1;
}
```

- [ ] **Step 2: Add imports to the renderer diff test**

In `tests/unit/renderer/diff.test.ts`, add this import below the devtools import:

```ts
import {
  disableKeyedReorderMovePathInstrumentation,
  enableKeyedReorderMovePathInstrumentation,
  getKeyedReorderMovePathCounts,
  resetKeyedReorderMovePathCounts,
} from "../../../src/renderer/keyed-reorder-instrumentation";
```

Update the existing `afterEach()` block to reset and disable counters:

```ts
afterEach(() => {
  clearDevtoolsListeners();
  resetKeyedReorderMovePathCounts();
  disableKeyedReorderMovePathInstrumentation();
  vi.restoreAllMocks();
});
```

- [ ] **Step 3: Add the disabled-default test**

Add this test after `spyOnGlobalSetAllocations()`:

```ts
it("keeps keyed reorder move-path counters disabled by default", () => {
  const container = document.createElement("div");

  render(
    h("ul", null, [
      h("li", { key: "a" }, "A"),
      h("li", { key: "b" }, "B"),
      h("li", { key: "c" }, "C"),
    ]),
    container,
  );

  render(
    h("ul", null, [
      h("li", { key: "c" }, "C"),
      h("li", { key: "b" }, "B"),
      h("li", { key: "a" }, "A"),
    ]),
    container,
  );

  expect(getKeyedReorderMovePathCounts()).toEqual({
    keyedMiddleSegments: 0,
    matchedOldChildren: 0,
    newChildrenMounted: 0,
    removedOldChildren: 0,
    lisLength: 0,
    stableMoveSkips: 0,
    movedExistingChildren: 0,
    anchorLookups: 0,
  });
});
```

- [ ] **Step 4: Add the full reverse move-path RED test**

Add this test near the existing keyed reorder tests:

```ts
it("records keyed full reverse move-path counters when enabled", () => {
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
    anchorLookups: 3,
  });
});
```

- [ ] **Step 5: Add the mixed insert/remove/move RED test**

Add this test after the full reverse counter test:

```ts
it("records keyed mixed mount remove and move counters when enabled", () => {
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
      h("li", { key: "b" }, "B"),
      h("li", { key: "e" }, "E"),
      h("li", { key: "a" }, "A"),
    ]),
    container,
  );

  const after = [...container.querySelectorAll("li")];

  expect(after.map((li) => li.textContent)).toEqual(["D", "B", "E", "A"]);
  expect(getKeyedReorderMovePathCounts()).toEqual({
    keyedMiddleSegments: 1,
    matchedOldChildren: 3,
    newChildrenMounted: 1,
    removedOldChildren: 1,
    lisLength: 1,
    stableMoveSkips: 1,
    movedExistingChildren: 2,
    anchorLookups: 3,
  });
});
```

- [ ] **Step 6: Run renderer RED tests**

Run:

```bash
pnpm vitest run tests/unit/renderer/diff.test.ts
```

Expected: fails because the new counter tests expect renderer increments that `patchKeyedChildren()` does not record yet. The disabled-default test may pass.

- [ ] **Step 7: Keep RED changes uncommitted until Task 2 passes**

Run:

```bash
git status --short
```

Expected: `src/renderer/keyed-reorder-instrumentation.ts` and `tests/unit/renderer/diff.test.ts` are changed locally.
Do not commit this failing RED state; commit the tests together with the passing implementation in Task 2.

---

### Task 2: Instrument `patchKeyedChildren()`

**Files:**

- Modify: `src/renderer/diff.ts`
- Test: `tests/unit/renderer/diff.test.ts`

- [ ] **Step 1: Add instrumentation imports**

In `src/renderer/diff.ts`, add this import after the DOM import:

```ts
import {
  isKeyedReorderMovePathInstrumentationEnabled,
  recordKeyedReorderAnchorLookup,
  recordKeyedReorderLisLength,
  recordKeyedReorderMatchedOldChild,
  recordKeyedReorderMiddleSegment,
  recordKeyedReorderMountedChildren,
  recordKeyedReorderMovedExistingChild,
  recordKeyedReorderRemovedOldChildren,
  recordKeyedReorderStableMoveSkip,
} from "./keyed-reorder-instrumentation";
```

- [ ] **Step 2: Add a local instrumentation flag in `patchKeyedChildren()`**

Inside `patchKeyedChildren()`, immediately before creating `oldKeyedChildren`, insert:

```ts
const shouldRecordMovePath = isKeyedReorderMovePathInstrumentationEnabled();
if (shouldRecordMovePath) {
  recordKeyedReorderMiddleSegment();
}
```

The block must be placed after these early returns:

```ts
if (oldStart > oldEnd) {
  const anchor = getAnchor(newChildren, newEnd + 1);
  mountNewChildren(newChildren, newStart, newEnd, container, anchor, parentComponent, appProvides);
  return;
}

if (newStart > newEnd) {
  unmountChildrenRange(oldChildren, oldStart, oldEnd);
  return;
}
```

- [ ] **Step 3: Record matched and removed children**

Inside the loop that patches matched keyed children, update the existing match branch to:

```ts
if (oldRecord !== null) {
  matchedOldCount += 1;
  if (shouldRecordMovePath) {
    recordKeyedReorderMatchedOldChild();
  }
  newIndexToOldIndexMap[index - newStart] = oldRecord.index + 1;
  patch(oldRecord.vnode, newChild, container, null, parentComponent, appProvides);
}
```

Before `unmountUnusedKeyedChildren(...)`, insert:

```ts
if (shouldRecordMovePath) {
  recordKeyedReorderRemovedOldChildren(oldEnd - oldStart + 1 - matchedOldCount);
}
```

The full block should read:

```ts
if (matchedOldCount < oldEnd - oldStart + 1) {
  if (shouldRecordMovePath) {
    recordKeyedReorderRemovedOldChildren(oldEnd - oldStart + 1 - matchedOldCount);
  }
  unmountUnusedKeyedChildren(oldChildren, oldStart, oldEnd, newIndexToOldIndexMap);
}
```

- [ ] **Step 4: Record LIS length**

Immediately after:

```ts
const stablePositions = getIncreasingSubsequence(newIndexToOldIndexMap);
```

insert:

```ts
if (shouldRecordMovePath) {
  recordKeyedReorderLisLength(stablePositions.length);
}
```

- [ ] **Step 5: Record mount and anchor lookup branches in the reverse loop**

In the `newIndexToOldIndexMap[index - newStart] === 0` branch, update the batched mount call from:

```ts
mountNewChildren(
  newChildren,
  runStart,
  index,
  container,
  getAnchor(newChildren, index + 1),
  parentComponent,
  appProvides,
);
```

to:

```ts
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
```

Update the single mount call from:

```ts
patch(
  null,
  newChildren[index],
  container,
  getAnchor(newChildren, index + 1),
  parentComponent,
  appProvides,
);
```

to:

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
```

- [ ] **Step 6: Record stable skips, moves, and move anchors**

Update the stable-position branch from:

```ts
if (stableIndex >= 0 && index - newStart === stablePositions[stableIndex]) {
  stableIndex -= 1;
  continue;
}

insert(childEl, container, getAnchor(newChildren, index + 1));
```

to:

```ts
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

- [ ] **Step 7: Run renderer tests**

Run:

```bash
pnpm vitest run tests/unit/renderer/diff.test.ts
```

Expected: exits with code 0. The new full reverse test should report `anchorLookups: 3`; the mixed test should report `anchorLookups: 3`.

- [ ] **Step 8: Commit renderer instrumentation and tests**

Run:

```bash
git add src/renderer/diff.ts src/renderer/keyed-reorder-instrumentation.ts tests/unit/renderer/diff.test.ts
git commit -m "perf: instrument keyed reorder move path"
```

Expected: one focused commit containing the instrumentation runtime and passing renderer tests.

---

### Task 3: Add Browser Result And History RED Tests

**Files:**

- Modify: `tests/e2e/browser-benchmark-history.ts`
- Modify: `tests/unit/scripts/browser-benchmark-history.test.ts`
- Modify: `tests/e2e/browser-benchmark.spec.ts`

- [ ] **Step 1: Add the history `MovePathCounts` type**

In `tests/e2e/browser-benchmark-history.ts`, add this type after `DomMutationCounts`:

```ts
export type MovePathCounts = {
  keyedMiddleSegments: number;
  matchedOldChildren: number;
  newChildrenMounted: number;
  removedOldChildren: number;
  lisLength: number;
  stableMoveSkips: number;
  movedExistingChildren: number;
  anchorLookups: number;
};
```

Then add the field to the keyed reorder branch:

```ts
movePathCounts: MovePathCounts;
```

- [ ] **Step 2: Update the unit fixture with move-path counts**

In `tests/unit/scripts/browser-benchmark-history.test.ts`, update `keyedReorderSummary` to include:

```ts
  movePathCounts: {
    keyedMiddleSegments: 1,
    matchedOldChildren: 10_000,
    newChildrenMounted: 0,
    removedOldChildren: 0,
    lisLength: 1,
    stableMoveSkips: 1,
    movedExistingChildren: 9999,
    anchorLookups: 9999,
  },
```

Place it immediately after `domMutationCounts`.

- [ ] **Step 3: Assert history preserves move-path counts**

In the `appends a keyed reorder browser benchmark history record` test, extend the existing `toMatchObject` with:

```ts
        movePathCounts: {
          keyedMiddleSegments: 1,
          matchedOldChildren: 10_000,
          newChildrenMounted: 0,
          removedOldChildren: 0,
          lisLength: 1,
          stableMoveSkips: 1,
          movedExistingChildren: 9999,
          anchorLookups: 9999,
        },
```

- [ ] **Step 4: Import the browser move-path type in the Playwright spec**

In `tests/e2e/browser-benchmark.spec.ts`, update the import from `./browser-benchmark-history` to include:

```ts
  type MovePathCounts,
```

- [ ] **Step 5: Add shape assertions for browser move-path counts**

In `tests/e2e/browser-benchmark.spec.ts`, add this helper after `expectDomMutationCounts()`:

```ts
function expectMovePathCounts(counts: MovePathCounts): void {
  expectNonNegativeInteger(counts.keyedMiddleSegments);
  expectNonNegativeInteger(counts.matchedOldChildren);
  expectNonNegativeInteger(counts.newChildrenMounted);
  expectNonNegativeInteger(counts.removedOldChildren);
  expectNonNegativeInteger(counts.lisLength);
  expectNonNegativeInteger(counts.stableMoveSkips);
  expectNonNegativeInteger(counts.movedExistingChildren);
  expectNonNegativeInteger(counts.anchorLookups);
}
```

Then add these assertions in the `keyed-reorder` branch of `expectBrowserBenchmarkResult()` after `expectDomMutationCounts(result.domMutationCounts);`:

```ts
expectMovePathCounts(result.movePathCounts);
expect(result.movePathCounts.keyedMiddleSegments).toBe(1);
expect(result.movePathCounts.matchedOldChildren).toBe(10_000);
expect(result.movePathCounts.newChildrenMounted).toBe(0);
expect(result.movePathCounts.removedOldChildren).toBe(0);
expect(result.movePathCounts.lisLength).toBe(1);
expect(result.movePathCounts.stableMoveSkips).toBe(1);
expect(result.movePathCounts.movedExistingChildren).toBe(9999);
expect(result.movePathCounts.anchorLookups).toBeGreaterThanOrEqual(9999);
```

- [ ] **Step 6: Run browser history RED test**

Run:

```bash
pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts
```

Expected: exits with code 0 because JSON serialization preserves the widened fixture field without runtime benchmark changes.

- [ ] **Step 7: Run browser benchmark RED test**

Run:

```bash
pnpm benchmark:browser
```

Expected: fails in the keyed reorder branch because the browser result does not include `movePathCounts` yet.

- [ ] **Step 8: Keep browser RED changes uncommitted until Task 4 passes**

Run:

```bash
git status --short
```

Expected: browser/history test files are changed locally. Do not commit this failing RED state; commit the tests together
with the passing browser wiring in Task 4.

---

### Task 4: Attach Counters To Browser Benchmark Results

**Files:**

- Modify: `examples/performance-benchmark/src/main.tsx`
- Test: `tests/e2e/browser-benchmark.spec.ts`
- Test: `tests/unit/scripts/browser-benchmark-history.test.ts`

- [ ] **Step 1: Import the internal instrumentation helpers**

In `examples/performance-benchmark/src/main.tsx`, keep the public runtime import and add this internal source import below it:

```ts
import {
  disableKeyedReorderMovePathInstrumentation,
  enableKeyedReorderMovePathInstrumentation,
  getKeyedReorderMovePathCounts,
  resetKeyedReorderMovePathCounts,
  type KeyedReorderMovePathCounts,
} from "../../../src/renderer/keyed-reorder-instrumentation";
```

The Vite benchmark config aliases `@italone/solace` to `src/index.ts`, so this internal import shares the same source module instance as the renderer import path. Do not add this helper to package root exports.

- [ ] **Step 2: Add the browser result type field**

In `examples/performance-benchmark/src/main.tsx`, add:

```ts
type MovePathCounts = KeyedReorderMovePathCounts;
```

Then add this field to the `keyed-reorder` branch of `BrowserBenchmarkResult`:

```ts
movePathCounts: MovePathCounts;
```

- [ ] **Step 3: Add a measured-window helper**

Add this function below `measureDomMutations()`:

```ts
async function measureKeyedReorderMovePath<T>(run: () => Promise<T>): Promise<{
  result: T;
  counts: MovePathCounts;
}> {
  enableKeyedReorderMovePathInstrumentation();

  try {
    const result = await run();
    return {
      result,
      counts: getKeyedReorderMovePathCounts(),
    };
  } finally {
    resetKeyedReorderMovePathCounts();
    disableKeyedReorderMovePathInstrumentation();
  }
}
```

- [ ] **Step 4: Wrap the reorder update with both instruments**

Replace the existing keyed reorder measurement:

```ts
const { result: reorderMs, counts: domMutationCounts } = await measureDomMutations(async () => {
  const reorderStart = now();
  state.rowOrder = [...state.rowOrder].reverse();
  await nextTick();
  return now() - reorderStart;
});
```

with:

```ts
const {
  result: { result: reorderMs, counts: movePathCounts },
  counts: domMutationCounts,
} = await measureDomMutations(() =>
  measureKeyedReorderMovePath(async () => {
    const reorderStart = now();
    state.rowOrder = [...state.rowOrder].reverse();
    await nextTick();
    return now() - reorderStart;
  }),
);
```

This keeps `domMutationCounts` and `movePathCounts` scoped to the same reorder update window.

- [ ] **Step 5: Attach `movePathCounts` to the keyed result**

In the keyed reorder result object, add:

```ts
    movePathCounts,
```

Place it immediately after `domMutationCounts`.

- [ ] **Step 6: Run focused checks**

Run:

```bash
pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts
```

Expected: exits with code 0.

Run:

```bash
pnpm benchmark:browser
```

Expected: exits with code 0 and logs `keyed-reorder` summaries that include both `domMutationCounts` and `movePathCounts`.

- [ ] **Step 7: Commit browser result wiring**

Run:

```bash
git add examples/performance-benchmark/src/main.tsx tests/e2e/browser-benchmark-history.ts tests/unit/scripts/browser-benchmark-history.test.ts tests/e2e/browser-benchmark.spec.ts
git commit -m "perf: report keyed reorder move path counts"
```

Expected: one commit containing browser result and history wiring.

---

### Task 5: Update Performance Docs And Project Log

**Files:**

- Modify: `docs/performance.md`
- Add: `solace-project-log/solace-entries/2026-07-21-014-keyed-reorder-move-path-instrumentation.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update performance documentation**

In `docs/performance.md`, update the browser benchmark section that describes keyed reorder diagnostics. Add this paragraph near the existing `domMutationCounts` note:

```md
`keyed-reorder` results also include `movePathCounts`, an internal renderer diagnostic captured only during the measured
reorder update window. `domMutationCounts` describes browser-visible DOM writes; `movePathCounts` describes renderer
move-path intent: keyed middle segments, matched old children, new mounts, old removals, LIS length, stable move skips,
existing-node moves, and move-loop anchor lookups. These counters are diagnostic trend context and are not release
thresholds.
```

- [ ] **Step 2: Create the implementation project log**

Create `solace-project-log/solace-entries/2026-07-21-014-keyed-reorder-move-path-instrumentation.md` with this content after validation results are known:

```md
# 2026-07-21-014：补充 keyed reorder move path instrumentation

## 基本信息

- 日期：2026-07-21
- 类型：renderer performance instrumentation / browser benchmark / project log
- 状态：已完成

## 变动摘要

新增 keyed reorder move-path 内部诊断 counters，并在 browser `keyed-reorder` summary/history 中记录
`movePathCounts`。该字段与 `domMutationCounts` 并列，用于区分 browser-visible DOM writes 与 renderer move-loop
intent。

## 变动原因

当前 keyed reorder browser baseline 已证明 reverse reorder 的 DOM 写入主要是 `insertBefore: 9999`，props/text/remove
写入为 0。full-match bookkeeping skip 后，下一步需要先量化 LIS、stable skip、move insert、mount/remove 和 anchor
lookup 的分布，再决定是否进入 move-path 优化。

## 影响范围

- 影响模块：renderer keyed diff、browser benchmark fixture、browser history types/tests、performance docs、项目日志。
- 行为变化：默认 renderer 行为不变；只有 benchmark/test 显式开启 instrumentation 时才记录 counters。
- 风险等级：中低；风险集中在 instrumentation 泄漏和 benchmark result shape 变更，已通过默认关闭测试和 browser shape 测试覆盖。

## 涉及文件

| 文件                                                                                          | 动作 | 说明                                                |
| --------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------- |
| `src/renderer/keyed-reorder-instrumentation.ts`                                               | 新增 | 内部 move-path counter helpers                      |
| `src/renderer/diff.ts`                                                                        | 修改 | 在 keyed middle move path 中记录 aggregate counters |
| `tests/unit/renderer/diff.test.ts`                                                            | 修改 | 覆盖默认关闭、full reverse 和 mixed counters        |
| `examples/performance-benchmark/src/main.tsx`                                                 | 修改 | 将 `movePathCounts` 写入 keyed benchmark result     |
| `tests/e2e/browser-benchmark-history.ts`                                                      | 修改 | 扩展 browser history 类型                           |
| `tests/unit/scripts/browser-benchmark-history.test.ts`                                        | 修改 | 覆盖 JSONL 保留 `movePathCounts`                    |
| `tests/e2e/browser-benchmark.spec.ts`                                                         | 修改 | 校验 browser `keyed-reorder` move-path shape        |
| `docs/performance.md`                                                                         | 修改 | 记录诊断字段含义                                    |
| `docs/superpowers/plans/2026-07-21-keyed-reorder-move-path-instrumentation.md`                | 新增 | 记录实施计划                                        |
| `solace-project-log/solace-entries/2026-07-21-014-keyed-reorder-move-path-instrumentation.md` | 新增 | 记录本次实现变更                                    |
| `solace-project-log/index.md`                                                                 | 修改 | 追加 2026-07-21 日志索引                            |

## 验证记录

| 验证项                | 命令                                                                   | 结果 |
| --------------------- | ---------------------------------------------------------------------- | ---- |
| Renderer unit tests   | `pnpm vitest run tests/unit/renderer/diff.test.ts`                     | 通过 |
| Browser history tests | `pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts` | 通过 |
| Browser benchmark     | `pnpm benchmark:browser`                                               | 通过 |
| Typecheck             | `pnpm typecheck`                                                       | 通过 |
| Lint                  | `pnpm lint`                                                            | 通过 |
| Build                 | `pnpm build`                                                           | 通过 |
| Format check          | `pnpm format:check`                                                    | 通过 |
| Whitespace check      | `git diff --check`                                                     | 通过 |

## 后续动作

- 刷新 browser benchmark trend window，观察 `movePathCounts` 与 `reorderMs` 的关系。
- 基于新样本决定下一轮性能切片是否瞄准 anchor lookup、move-loop branching，或扩展更多 reorder shapes。
```

- [ ] **Step 3: Add the implementation row to the log index**

In `solace-project-log/index.md`, add this row after the `013` plan row:

```md
| 014 | 补充 keyed reorder move path instrumentation | renderer performance instrumentation、browser benchmark、项目日志 | `src/renderer/keyed-reorder-instrumentation.ts`, `src/renderer/diff.ts`, `tests/unit/renderer/diff.test.ts`, `examples/performance-benchmark/src/main.tsx`, `tests/e2e/browser-benchmark-history.ts`, `tests/unit/scripts/browser-benchmark-history.test.ts`, `tests/e2e/browser-benchmark.spec.ts`, `docs/performance.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-21-014-keyed-reorder-move-path-instrumentation.md) |
```

- [ ] **Step 4: Format docs and source files**

Run:

```bash
pnpm prettier --write src/renderer/keyed-reorder-instrumentation.ts src/renderer/diff.ts tests/unit/renderer/diff.test.ts examples/performance-benchmark/src/main.tsx tests/e2e/browser-benchmark-history.ts tests/unit/scripts/browser-benchmark-history.test.ts tests/e2e/browser-benchmark.spec.ts docs/performance.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-21-014-keyed-reorder-move-path-instrumentation.md
```

Expected: exits with code 0.

- [ ] **Step 5: Run final validation**

Run:

```bash
pnpm vitest run tests/unit/renderer/diff.test.ts
```

Expected: exits with code 0.

Run:

```bash
pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts
```

Expected: exits with code 0.

Run:

```bash
pnpm benchmark:browser
```

Expected: exits with code 0 and logs `browser benchmark summary` lines for `large-list` and `keyed-reorder`. The `keyed-reorder` summary includes `movePathCounts`.

Run:

```bash
pnpm typecheck
```

Expected: exits with code 0.

Run:

```bash
pnpm lint
```

Expected: exits with code 0.

Run:

```bash
pnpm build
```

Expected: exits with code 0.

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.

Run:

```bash
git diff --check
```

Expected: exits with code 0.

- [ ] **Step 6: Commit documentation and final implementation state**

Run:

```bash
git add src/renderer/keyed-reorder-instrumentation.ts src/renderer/diff.ts tests/unit/renderer/diff.test.ts examples/performance-benchmark/src/main.tsx tests/e2e/browser-benchmark-history.ts tests/unit/scripts/browser-benchmark-history.test.ts tests/e2e/browser-benchmark.spec.ts docs/performance.md docs/superpowers/plans/2026-07-21-keyed-reorder-move-path-instrumentation.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-21-014-keyed-reorder-move-path-instrumentation.md
git commit -m "docs: record keyed reorder move path instrumentation"
```

Expected: final commit includes docs/log updates and no `.benchmark-history/**` files.

---

### Task 6: Refresh Browser Trend Window After Implementation

**Files:**

- Modify: `docs/performance.md`
- Add: `solace-project-log/solace-entries/2026-07-21-015-browser-keyed-reorder-move-path-trend-refresh.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Run a five-sample browser benchmark refresh**

Run:

```bash
SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 pnpm benchmark:browser
```

Expected: exits with code 0 and appends five `large-list` and five `keyed-reorder` records to local ignored history.

- [ ] **Step 2: Summarize the latest browser window**

Run:

```bash
pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json
```

Expected: exits with code 0 and reports fresh `large-list` and `keyed-reorder` browser groups.

- [ ] **Step 3: Update performance docs with the observed latest-window values**

In `docs/performance.md`, update the browser benchmark trend section with the observed latest five `keyed-reorder` timing values and include a short diagnostic note in this form:

```md
Latest `keyed-reorder` move-path diagnostics report full reverse reorder as one keyed middle segment, 10,000 matched old
children, zero mounts/removes, LIS length 1, one stable skip, and 9,999 existing-node moves. This confirms the current
fixture is dominated by required DOM placements rather than prop/text/remove writes.
```

If the observed `anchorLookups` value is `9999`, write `9,999 move-loop anchor lookups`. If the observed value differs, write the exact observed value and preserve the explanation that anchor lookups are measured rather than guessed.

- [ ] **Step 4: Add the trend refresh project log**

Create `solace-project-log/solace-entries/2026-07-21-015-browser-keyed-reorder-move-path-trend-refresh.md` with:

```md
# 2026-07-21-015：刷新 keyed reorder move-path 趋势样本

## 基本信息

- 日期：2026-07-21
- 类型：browser benchmark / performance trend / project log
- 状态：已完成

## 变动摘要

刷新 browser benchmark latest window，并记录 keyed reorder `movePathCounts` 诊断数据。

## 变动原因

move-path instrumentation 已接入 browser benchmark。需要用新样本确认 `movePathCounts` 能解释当前
`keyed-reorder` reorder cost，并为下一轮性能切片选择提供依据。

## 影响范围

- 影响模块：performance docs、browser benchmark local history、项目日志。
- 行为变化：无运行时代码变化；`.benchmark-history/**` 仍保持本地 ignored。
- 风险等级：低；只更新趋势记录。

## 涉及文件

| 文件                                                                                                | 动作 | 说明                       |
| --------------------------------------------------------------------------------------------------- | ---- | -------------------------- |
| `docs/performance.md`                                                                               | 修改 | 更新 browser latest window |
| `solace-project-log/solace-entries/2026-07-21-015-browser-keyed-reorder-move-path-trend-refresh.md` | 新增 | 记录趋势刷新               |
| `solace-project-log/index.md`                                                                       | 修改 | 追加 2026-07-21 日志索引   |

## 验证记录

| 验证项                 | 命令                                                                                                                                   | 结果 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Browser benchmark run  | `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 pnpm benchmark:browser` | 通过 |
| Browser history window | `pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json`                                                      | 通过 |
| Format check           | `pnpm format:check`                                                                                                                    | 通过 |
| Whitespace check       | `git diff --check`                                                                                                                     | 通过 |

## 后续动作

- 基于新 trend window 选择下一轮性能切片：anchor lookup、move-loop branching，或新增 reorder shape benchmark。
```

- [ ] **Step 5: Add the trend refresh row to the log index**

In `solace-project-log/index.md`, add:

```md
| 015 | 刷新 keyed reorder move-path 趋势样本 | browser benchmark、本地 history、性能文档、项目日志 | `docs/performance.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-21-015-browser-keyed-reorder-move-path-trend-refresh.md) |
```

- [ ] **Step 6: Format and validate docs**

Run:

```bash
pnpm prettier --write docs/performance.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-21-015-browser-keyed-reorder-move-path-trend-refresh.md
```

Expected: exits with code 0.

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.

Run:

```bash
git diff --check
```

Expected: exits with code 0.

- [ ] **Step 7: Commit trend refresh**

Run:

```bash
git add docs/performance.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-21-015-browser-keyed-reorder-move-path-trend-refresh.md
git commit -m "docs: refresh keyed reorder move path trend"
```

Expected: one commit containing trend docs/log only. `.benchmark-history/**` remains untracked or ignored and must not be committed.

---

## Final Verification

Run after all implementation and trend-refresh tasks:

```bash
git status --short
```

Expected: no tracked source/doc changes remain. Ignored `.benchmark-history/**` files may exist locally and should not appear in normal status output.

Run:

```bash
pnpm quality
```

Expected: exits with code 0.

Run:

```bash
pnpm benchmark:browser
```

Expected: exits with code 0 and confirms the browser production benchmark still works after docs and commits.
