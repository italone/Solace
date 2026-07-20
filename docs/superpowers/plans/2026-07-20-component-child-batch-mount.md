# Component Child Batch Mount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Batch initial mount of array children through a `DocumentFragment` even when the children include components, so large component trees only insert once into the real parent container.

**Architecture:** Keep the change local to the renderer child-mount path. Broaden the initial mount batching predicate in `src/renderer/diff.ts` so array children can mount into a fragment before one parent insert, while leaving update diffing, unmount batching, scheduler behavior, and public APIs unchanged. Reuse the existing component model and mounted-hook semantics.

**Tech Stack:** TypeScript, Vitest, jsdom, tinybench, Solace renderer/runtime, pnpm, Prettier.

---

## File Structure

- Modify `tests/unit/component/component.test.ts`: add a regression test that proves many initial child component mounts batch into one parent insertion.
- Modify `src/renderer/diff.ts`: broaden the initial child-mount batching predicate for array children and reuse it in the fragment mount path.
- Modify `docs/performance.md`: note that component initial mounts now batch child inserts through a `DocumentFragment`.
- Add `solace-project-log/solace-entries/2026-07-20-005-component-child-batch-mount.md`: record implementation and validation.
- Modify `solace-project-log/index.md`: add the `2026-07-20` log row for the implementation.

Do not modify public package exports, scheduler ordering semantics, DevTools payloads, benchmark thresholds, or browser benchmark harnesses.

---

### Task 1: Add The Failing Initial-Mount Regression Test

**Files:**

- Modify: `tests/unit/component/component.test.ts`

- [ ] **Step 1: Add the RED test**

Add this test after `it("calls direct VNode function components once during initial mount", () => { ... })`:

```ts
it("batches initial mount of component children into one parent insert", () => {
  const container = document.createElement("div");
  const insertBefore = vi.spyOn(Element.prototype, "insertBefore");
  const childCount = 20;
  const Child = (props: { index: number }) => () =>
    h("span", { "data-index": props.index }, `item ${props.index}`);
  const Parent = () => () =>
    h(
      "div",
      null,
      Array.from({ length: childCount }, (_, index) => h(Child, { key: index, index })),
    );

  render(h(Parent), container);

  expect(insertBefore).toHaveBeenCalledTimes(2);
  expect(container.querySelectorAll("span")).toHaveLength(childCount);
  expect(container.querySelector('[data-index="0"]')?.textContent).toBe("item 0");
  expect(container.querySelector(`[data-index="${childCount - 1}"]`)?.textContent).toBe(
    `item ${childCount - 1}`,
  );
});
```

- [ ] **Step 2: Run the component test to verify RED**

Run:

```bash
pnpm vitest run tests/unit/component/component.test.ts
```

Expected: the new test fails because initial component children still insert one by one into the parent element.

---

### Task 2: Broaden Initial Child Mount Batching

**Files:**

- Modify: `src/renderer/diff.ts`

- [ ] **Step 1: Broaden the batching predicate and reuse it in both mount paths**

In `src/renderer/diff.ts`, replace the current element-only guard with a general initial-mount guard:

```ts
function mountChildren(
  children: VNode[],
  container: Node,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): void {
  if (canBatchMountChildren(children, 0, children.length - 1)) {
    const fragment = document.createDocumentFragment();
    for (const child of children) {
      patch(null, child, fragment, null, parentComponent, appProvides);
    }
    insert(fragment, container, null);
    return;
  }

  for (const child of children) {
    patch(null, child, container, null, parentComponent, appProvides);
  }
}

function canBatchMountChildren(children: VNode[], start: number, end: number): boolean {
  return start <= end;
}
```

Update `mountFragment()` to use the same batching predicate for its initial child mount path.

- [ ] **Step 2: Run the component test to verify GREEN**

Run:

```bash
pnpm vitest run tests/unit/component/component.test.ts
```

Expected: exits with code 0, and the new test passes with the existing component suite.

---

### Task 3: Update Performance Docs And Project Log

**Files:**

- Modify: `docs/performance.md`
- Add: `solace-project-log/solace-entries/2026-07-20-005-component-child-batch-mount.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update the performance note**

In `docs/performance.md`, add a short sentence near the current renderer follow-up summary that says component initial mounts now batch child inserts through a `DocumentFragment`.

Use wording like:

```md
The component initial mount path also batches child inserts through a `DocumentFragment`.
```

Keep the existing browser-trend and renderer summary text intact.

- [ ] **Step 2: Add the implementation log entry**

Create `solace-project-log/solace-entries/2026-07-20-005-component-child-batch-mount.md` with the same structure as the other 2026-07-20 log entries:

```md
# 2026-07-20-005：实现 component child batch mount

## 基本信息

- 日期：2026-07-20
- 类型：performance implementation / component renderer / project log
- 状态：已完成

## 变动摘要

批量挂载 component child initial mount，减少同一层级初始插入时的 parent insert pressure。

## 影响范围

- 影响模块：component initial render、renderer child mount path、component benchmark、性能文档、项目日志。

## 涉及文件

| 文件                                                                              | 动作 | 说明                                        |
| --------------------------------------------------------------------------------- | ---- | ------------------------------------------- |
| `src/renderer/diff.ts`                                                            | 修改 | 放宽 initial child mount batching           |
| `tests/unit/component/component.test.ts`                                          | 修改 | 覆盖 component child initial mount batching |
| `docs/performance.md`                                                             | 修改 | 记录 component initial mount batching       |
| `solace-project-log/solace-entries/2026-07-20-005-component-child-batch-mount.md` | 新增 | 记录本次变更                                |
| `solace-project-log/index.md`                                                     | 修改 | 追加 2026-07-20 日志索引                    |

## 验证记录

| 验证项                   | 命令或方式                                                                                                   | 结果 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | ---- |
| Targeted component tests | `pnpm vitest run tests/unit/component/component.test.ts`                                                     | 通过 |
| Component benchmark      | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/render.bench.ts`                 | 通过 |
| jsdom benchmark run      | `SOLACE_BENCHMARK_HISTORY_PATH=.benchmark-history/jsdom.jsonl SOLACE_BENCHMARK_SAMPLE_SIZE=3 pnpm benchmark` | 通过 |
| Format check             | `pnpm format:check`                                                                                          | 通过 |
| Diff whitespace          | `git diff --check`                                                                                           | 通过 |
```

- [ ] **Step 3: Add the log index row**

Add a `2026-07-20` row to `solace-project-log/index.md`:

```md
| 005 | 实现 component child batch mount | performance 实现、component renderer、项目日志 | `src/renderer/diff.ts`, `tests/unit/component/component.test.ts`, `docs/performance.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-20-005-component-child-batch-mount.md) |
```

---

### Task 4: Final Validation And Commit

**Files:**

- All changed files

- [ ] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write src/renderer/diff.ts tests/unit/component/component.test.ts docs/performance.md docs/superpowers/specs/2026-07-20-component-child-batch-mount-design.md docs/superpowers/plans/2026-07-20-component-child-batch-mount.md solace-project-log/solace-entries/2026-07-20-005-component-child-batch-mount.md solace-project-log/index.md
```

Expected: exits with code 0.

- [ ] **Step 2: Run the focused component test**

Run:

```bash
pnpm vitest run tests/unit/component/component.test.ts
```

Expected: exits with code 0.

- [ ] **Step 3: Run the component benchmark**

Run:

```bash
pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/render.bench.ts
```

Expected: exits with code 0 and reports the `1000 component initial render` task.

- [ ] **Step 4: Refresh the local jsdom benchmark smoke**

Run:

```bash
SOLACE_BENCHMARK_HISTORY_PATH=.benchmark-history/jsdom.jsonl SOLACE_BENCHMARK_SAMPLE_SIZE=3 pnpm benchmark
```

Expected: exits with code 0 and reports the existing jsdom benchmark tasks, including `1000 component initial render`.

- [ ] **Step 5: Run the full validation set**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
git diff --check
```

Expected: all commands exit with code 0.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/renderer/diff.ts tests/unit/component/component.test.ts docs/performance.md docs/superpowers/specs/2026-07-20-component-child-batch-mount-design.md docs/superpowers/plans/2026-07-20-component-child-batch-mount.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-20-005-component-child-batch-mount.md
git commit -m "perf: batch component child mounts"
```

Expected: one focused commit with the runtime change, benchmark validation, and documentation/log updates.
