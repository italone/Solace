# Keyed Reorder Full-Match Bookkeeping Skip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avoid unused-old `Set` bookkeeping and unmount scanning for fully matched keyed middle segments.

**Architecture:** Keep keyed lookup, patching, LIS, anchors, and move loop behavior intact. Replace unconditional
`usedOldChildren` tracking in `src/renderer/diff.ts` with `matchedOldCount`; skip unused-old unmounting when all old
middle children are matched, and derive used old indexes from `newIndexToOldIndexMap` only for removal cases.

**Tech Stack:** TypeScript, Solace renderer internals, Vitest, Tinybench, Playwright browser benchmark, Markdown,
Prettier.

---

## File Structure

- Modify `tests/unit/renderer/diff.test.ts`: add a RED regression test proving full matched keyed reorder does not need
  `Set` unused tracking, plus a removal safety assertion if existing coverage needs tightening.
- Modify `src/renderer/diff.ts`: remove unconditional `usedOldChildren` allocation, track matched old count, skip
  unused-old unmounting on full match, and replace Set-based unused unmounting with index-map-derived used flags for
  removal cases.
- Modify `docs/performance.md`: document the full-match keyed bookkeeping skip after implementation.
- Add `solace-project-log/solace-entries/2026-07-21-010-keyed-reorder-full-match-bookkeeping-skip.md`: record the
  implementation change.
- Modify `solace-project-log/index.md`: append the implementation row after this plan row.

No changes should be made to public APIs, VNode shape, keyed LIS move semantics, DOM anchor selection, browser benchmark
fixture shape, package metadata, release flow, or `.benchmark-history/**`.

---

### Task 1: Add Failing Renderer Coverage

**Files:**

- Modify: `tests/unit/renderer/diff.test.ts`

- [ ] **Step 1: Add a Set constructor spy helper**

Near the keyed children tests in `tests/unit/renderer/diff.test.ts`, add this helper:

```ts
function spyOnGlobalSet(): { setConstructor: ReturnType<typeof vi.fn>; restore: () => void } {
  const OriginalSet = globalThis.Set;
  const setConstructor = vi.fn(function SetWithSpy(values?: Iterable<unknown> | null) {
    return new OriginalSet(values ?? undefined);
  });

  vi.stubGlobal("Set", setConstructor as unknown as SetConstructor);

  return {
    setConstructor,
    restore() {
      vi.stubGlobal("Set", OriginalSet);
    },
  };
}
```

- [ ] **Step 2: Add the full-match reorder RED test**

Add this test near the existing keyed reorder tests:

```ts
it("skips unused-child Set bookkeeping for fully matched keyed reorders", () => {
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

  const before = new Map([...container.querySelectorAll("li")].map((li) => [li.textContent, li]));
  const { setConstructor, restore } = spyOnGlobalSet();

  try {
    render(
      h("ul", null, [
        h("li", { key: "d" }, "D"),
        h("li", { key: "c" }, "C"),
        h("li", { key: "b" }, "B"),
        h("li", { key: "a" }, "A"),
      ]),
      container,
    );
  } finally {
    restore();
  }

  const after = [...container.querySelectorAll("li")];

  expect(after.map((li) => li.textContent)).toEqual(["D", "C", "B", "A"]);
  expect(after[0]).toBe(before.get("D"));
  expect(after[1]).toBe(before.get("C"));
  expect(after[2]).toBe(before.get("B"));
  expect(after[3]).toBe(before.get("A"));
  expect(setConstructor).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Verify RED**

Run:

```bash
pnpm vitest run tests/unit/renderer/diff.test.ts
```

Expected: FAIL. The new test should fail because current `patchKeyedChildren()` constructs `new Set<VNode>()` during a
fully matched keyed reorder.

---

### Task 2: Implement Full-Match Bookkeeping Skip

**Files:**

- Modify: `src/renderer/diff.ts`
- Modify: `tests/unit/renderer/diff.test.ts`

- [ ] **Step 1: Replace unconditional Set tracking in `patchKeyedChildren()`**

In `src/renderer/diff.ts`, replace:

```ts
const oldKeyedChildren = new Map<string | number, KeyedChildRecord>();
const newIndexToOldIndexMap = new Array<number>(newEnd - newStart + 1).fill(0);
const usedOldChildren = new Set<VNode>();
```

with:

```ts
const oldKeyedChildren = new Map<string | number, KeyedChildRecord>();
const newIndexToOldIndexMap = new Array<number>(newEnd - newStart + 1).fill(0);
let matchedOldCount = 0;
```

- [ ] **Step 2: Count matched old children instead of adding to Set**

In the keyed new-child loop, replace:

```ts
usedOldChildren.add(oldRecord.vnode);
newIndexToOldIndexMap[index - newStart] = oldRecord.index + 1;
patch(oldRecord.vnode, newChild, container, null, parentComponent, appProvides);
```

with:

```ts
matchedOldCount += 1;
newIndexToOldIndexMap[index - newStart] = oldRecord.index + 1;
patch(oldRecord.vnode, newChild, container, null, parentComponent, appProvides);
```

- [ ] **Step 3: Skip unused-old unmounting when every old child matched**

Replace:

```ts
unmountUnusedKeyedChildren(oldChildren, oldStart, oldEnd, usedOldChildren);
```

with:

```ts
if (matchedOldCount < oldEnd - oldStart + 1) {
  unmountUnusedKeyedChildren(oldChildren, oldStart, oldEnd, newIndexToOldIndexMap);
}
```

- [ ] **Step 4: Replace `unmountUnusedKeyedChildren()` implementation**

Change the helper signature and body from Set-based tracking to index-map-derived flags:

```ts
function unmountUnusedKeyedChildren(
  children: VNode[],
  start: number,
  end: number,
  newIndexToOldIndexMap: number[],
): void {
  const usedOldIndexes = new Array<boolean>(end - start + 1).fill(false);

  for (const mappedOldIndex of newIndexToOldIndexMap) {
    if (mappedOldIndex > 0) {
      usedOldIndexes[mappedOldIndex - 1 - start] = true;
    }
  }

  let index = start;

  while (index <= end) {
    if (usedOldIndexes[index - start]) {
      index += 1;
      continue;
    }

    const runStart = index;
    while (index <= end && !usedOldIndexes[index - start]) {
      index += 1;
    }
    unmountChildrenRange(children, runStart, index - 1);
  }
}
```

- [ ] **Step 5: Verify GREEN for renderer tests**

Run:

```bash
pnpm vitest run tests/unit/renderer/diff.test.ts
```

Expected: PASS. The new full-match Set spy test passes, and existing keyed remove/reorder tests still pass.

- [ ] **Step 6: Commit renderer implementation**

Run:

```bash
git add src/renderer/diff.ts tests/unit/renderer/diff.test.ts
git commit -m "perf: skip full-match keyed reorder bookkeeping"
```

---

### Task 3: Document, Benchmark, And Log

**Files:**

- Modify: `docs/performance.md`
- Add: `solace-project-log/solace-entries/2026-07-21-010-keyed-reorder-full-match-bookkeeping-skip.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update performance docs**

In `docs/performance.md`, add this note to the renderer optimization conclusion paragraph:

```md
Fully matched keyed middle segments also skip unused-old `Set` tracking and unmount scanning, so stable keyed reorders
avoid bookkeeping that cannot produce removals while preserving the existing LIS move path.
```

- [ ] **Step 2: Add implementation log**

Create `solace-project-log/solace-entries/2026-07-21-010-keyed-reorder-full-match-bookkeeping-skip.md`:

```md
# 2026-07-21-010：优化 keyed reorder full-match bookkeeping

## 基本信息

- 日期：2026-07-21
- 类型：renderer performance / keyed diff / project log
- 状态：已完成

## 变动摘要

优化 `patchKeyedChildren()` 的 fully matched keyed middle segment：使用 `matchedOldCount` 判断是否存在旧节点需要卸载，
在全匹配场景跳过 unused-old `Set` tracking 和 unmount scan；在 remove/mixed 场景通过 `newIndexToOldIndexMap`
派生 used old indexes，继续正确卸载消失的 keyed children。

## 变动原因

最新 browser keyed reorder mutation counters 显示 stable reverse reorder 没有重复 props/text/remove DOM mutation，
但当前 keyed diff 仍在全匹配场景执行 unused-old bookkeeping。该优化减少 full reorder 的内部 bookkeeping 成本，同时不改变
LIS move path 或 DOM ordering。

## 影响范围

- 影响模块：renderer keyed children diff、renderer unit tests、performance docs、项目日志。
- 行为变化：full matched keyed reorder 少做内部 bookkeeping；DOM 输出、节点复用、move ordering 与 public API 不变。
- 风险等级：中；remove/mixed keyed 场景依赖新的 index-map-derived unused detection，必须通过现有 keyed diff 测试。

## 涉及文件

| 文件                                                                                            | 动作 | 说明                                 |
| ----------------------------------------------------------------------------------------------- | ---- | ------------------------------------ |
| `src/renderer/diff.ts`                                                                          | 修改 | 优化 fully matched keyed bookkeeping |
| `tests/unit/renderer/diff.test.ts`                                                              | 修改 | 增加 full-match Set skip 回归测试    |
| `docs/performance.md`                                                                           | 修改 | 记录 renderer 性能优化               |
| `solace-project-log/solace-entries/2026-07-21-010-keyed-reorder-full-match-bookkeeping-skip.md` | 新增 | 记录本次实现变更                     |
| `solace-project-log/index.md`                                                                   | 修改 | 追加 2026-07-21 日志索引             |

## 验证记录

| 验证项                | 命令或方式                                                                                      | 结果 |
| --------------------- | ----------------------------------------------------------------------------------------------- | ---- |
| Renderer diff unit    | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 通过 |
| List diff benchmark   | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts` | 通过 |
| Browser benchmark     | `pnpm benchmark:browser`                                                                        | 通过 |
| Browser latest window | `pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json`               | 通过 |
| Typecheck             | `pnpm typecheck`                                                                                | 通过 |
| Lint                  | `pnpm lint`                                                                                     | 通过 |
| Build                 | `pnpm build`                                                                                    | 通过 |
| Format check          | `pnpm format:check`                                                                             | 通过 |
| Diff whitespace       | `git diff --check`                                                                              | 通过 |

## 后续动作

- 刷新 browser benchmark 趋势样本，观察 keyed reorder `reorderMs` 是否有稳定变化；若 DOM move count 仍是主导成本，
  下一轮再单独设计 move path 或 anchor lookup 优化。
```

- [ ] **Step 3: Update the log index**

Append this row in the `2026-07-21` table in `solace-project-log/index.md`:

```md
| 010 | 优化 keyed reorder full-match bookkeeping | renderer performance、keyed diff、项目日志 | `src/renderer/diff.ts`, `tests/unit/renderer/diff.test.ts`, `docs/performance.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-21-010-keyed-reorder-full-match-bookkeeping-skip.md) |
```

- [ ] **Step 4: Run verification**

Run:

```bash
pnpm vitest run tests/unit/renderer/diff.test.ts
pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts
pnpm benchmark:browser
pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
git diff --check
```

Expected: all commands pass. `pnpm benchmark:browser` may require local preview server permission to bind
`127.0.0.1:5177`.

- [ ] **Step 5: Commit docs and log**

Run:

```bash
git add docs/performance.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-21-010-keyed-reorder-full-match-bookkeeping-skip.md
git commit -m "docs: record keyed reorder bookkeeping skip"
```

---

## Self-Review

- Spec coverage: Plan covers RED test, renderer implementation, remove/mixed safety through existing tests, docs, log,
  benchmark validation, and quality gates.
- Scope: No public API, benchmark fixture shape, package metadata, or release flow changes.
- TDD: Task 1 must fail before Task 2 modifies `src/renderer/diff.ts`.
- Risk control: Removal safety stays covered by the existing keyed remove/reorder tests plus the new index-map helper
  behavior.
