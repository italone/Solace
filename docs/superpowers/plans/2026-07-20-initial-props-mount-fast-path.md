# Initial Props Mount Fast Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce first-render prop mounting overhead for ordinary element attributes without changing update semantics.

**Architecture:** Keep the change local to the renderer's initial element mount path. Add a helper that iterates own props
without `Object.entries()`, skips empty values on fresh elements, delegates event props to `patchProp()`, and directly
sets ordinary attributes. Leave `patchProps()` and all update behavior unchanged.

**Tech Stack:** TypeScript, Vitest, jsdom, tinybench, Playwright browser benchmark, pnpm, Prettier.

---

## File Structure

- Modify `tests/unit/renderer/diff.test.ts`: add RED regression coverage for plain initial prop scans and redundant
  empty-prop removals.
- Modify `src/renderer/diff.ts`: add the initial props mount fast path and call it from `mountElement()`.
- Modify `docs/performance.md`: record the new initial props mount fast path.
- Add `solace-project-log/solace-entries/2026-07-20-009-initial-props-mount-fast-path.md`: record implementation and
  validation.
- Modify `solace-project-log/index.md`: add the `2026-07-20` implementation row.

Do not modify public package exports, JSX runtime output, benchmark thresholds, scheduler behavior, DevTools payloads,
or release flow.

---

### Task 1: Add The Failing Initial Props Regression Tests

**Files:**

- Modify: `tests/unit/renderer/diff.test.ts`

- [ ] **Step 1: Add RED tests**

Add these tests after `it("batches initial element child insertion into the element container", () => { ... })`:

```ts
it("avoids Object.entries props scans for plain initial element mounts", () => {
  const container = document.createElement("div");
  const objectEntries = vi.spyOn(Object, "entries");

  render(h("div", { id: "row", "data-row": 1, class: "selected" }, "Row 1"), container);

  const row = container.querySelector('[data-row="1"]') as HTMLDivElement;

  expect(row.id).toBe("row");
  expect(row.className).toBe("selected");
  expect(row.textContent).toBe("Row 1");
  expect(objectEntries).not.toHaveBeenCalled();
});

it("skips redundant removals for empty initial element props", () => {
  const container = document.createElement("div");
  const removeAttribute = vi.spyOn(Element.prototype, "removeAttribute");

  render(
    h(
      "button",
      {
        key: "save",
        disabled: false,
        "data-empty": undefined,
        title: null,
      },
      "Save",
    ),
    container,
  );

  const button = container.querySelector("button") as HTMLButtonElement;

  expect(button.hasAttribute("disabled")).toBe(false);
  expect(button.hasAttribute("data-empty")).toBe(false);
  expect(button.hasAttribute("title")).toBe(false);
  expect(button.textContent).toBe("Save");
  expect(removeAttribute).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the renderer test to verify RED**

Run:

```bash
pnpm vitest run tests/unit/renderer/diff.test.ts
```

Expected: the new tests fail because initial mount still calls `Object.entries()` and calls `removeAttribute()` for empty
props on a fresh element.

---

### Task 2: Add The Initial Props Mount Fast Path

**Files:**

- Modify: `src/renderer/diff.ts`

- [ ] **Step 1: Replace the initial props loop**

In `mountElement()`, replace the current `Object.entries()` loop:

```ts
if (vnode.props) {
  for (const [key, value] of Object.entries(vnode.props)) {
    if (key !== "key") {
      patchProp(el, key, null, value);
    }
  }
}
```

with:

```ts
if (vnode.props) {
  mountInitialProps(el, vnode.props);
}
```

- [ ] **Step 2: Add the helper functions**

Add these helpers near `patchProps()` so prop-mount behavior stays close to prop-patch behavior:

```ts
function mountInitialProps(el: Element, props: VNodeProps): void {
  for (const key in props) {
    if (!hasOwnProp(props, key) || key === "key") {
      continue;
    }

    const value = props[key];
    if (value === null || value === undefined || value === false) {
      continue;
    }

    if (mightBeEventProp(key)) {
      patchProp(el, key, null, value);
      continue;
    }

    el.setAttribute(key, String(value));
  }
}

function mightBeEventProp(key: string): boolean {
  return key.length > 2 && key[0] === "o" && key[1] === "n" && isEventProp(key);
}
```

- [ ] **Step 3: Run the renderer and event tests to verify GREEN**

Run:

```bash
pnpm vitest run tests/unit/renderer/diff.test.ts
pnpm vitest run tests/unit/event/event.test.ts
```

Expected: both commands exit with code 0. The new renderer tests pass, and existing event tests confirm initial event
binding still works.

---

### Task 3: Update Performance Docs And Project Log

**Files:**

- Modify: `docs/performance.md`
- Add: `solace-project-log/solace-entries/2026-07-20-009-initial-props-mount-fast-path.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update the performance note**

In `docs/performance.md`, add a short sentence near the current renderer follow-up summary:

```md
The initial element mount path now uses a conservative props fast path for ordinary attributes, avoiding `Object.entries()`
scans and redundant attribute removals on fresh elements.
```

- [ ] **Step 2: Add the implementation log entry**

Create `solace-project-log/solace-entries/2026-07-20-009-initial-props-mount-fast-path.md`:

```md
# 2026-07-20-009：优化 initial props mount fast path

## 基本信息

- 日期：2026-07-20
- 类型：renderer performance / unit test / performance docs / project log
- 状态：已完成

## 变动摘要

为 renderer element initial mount 增加 props fast path：普通初始属性不再走 `Object.entries()` 和通用 prop patch
路径，fresh element 上的空值 props 不再触发冗余 `removeAttribute()`。

## 影响范围

- 影响模块：renderer element mount、renderer 单元测试、list diff benchmark、browser benchmark trend、性能文档、项目日志。
- 行为变化：无 public API 变化；event props 仍委托现有 `patchProp()`，update-time props patching 保持不变。
- 风险等级：中低；主要风险是 initial mount prop 语义变化，已用普通属性、空值属性、event、update props 测试覆盖。

## 涉及文件

| 文件                                                                                | 动作 | 说明                                   |
| ----------------------------------------------------------------------------------- | ---- | -------------------------------------- |
| `src/renderer/diff.ts`                                                              | 修改 | 增加 initial props mount fast path     |
| `tests/unit/renderer/diff.test.ts`                                                  | 修改 | 覆盖初始 props scan 与空值 remove 回归 |
| `docs/performance.md`                                                               | 修改 | 记录本次 renderer 性能优化             |
| `solace-project-log/solace-entries/2026-07-20-009-initial-props-mount-fast-path.md` | 新增 | 记录本次变更                           |
| `solace-project-log/index.md`                                                       | 修改 | 追加 2026-07-20 日志索引               |

## 验证记录

| 验证项                 | 命令或方式                                                                                                                             | 结果                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| TDD RED                | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                                                                     | 通过                   |
| Targeted renderer test | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                                                                     | 通过                   |
| Event test             | `pnpm vitest run tests/unit/event/event.test.ts`                                                                                       | 通过                   |
| List diff benchmark    | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts`                                        | 通过                   |
| Browser benchmark      | `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 pnpm benchmark:browser` | 通过                   |
| Full tests             | `pnpm test`                                                                                                                            | 通过                   |
| Typecheck              | `pnpm typecheck`                                                                                                                       | 通过                   |
| Lint                   | `pnpm lint`                                                                                                                            | 通过                   |
| Build                  | `pnpm build`                                                                                                                           | 通过                   |
| Format check           | `pnpm format:check`                                                                                                                    | 通过                   |
| Diff whitespace        | `git diff --check`                                                                                                                     | 通过                   |
| Private boundary       | `package.json`                                                                                                                         | 保持 `"private": true` |

## 后续动作

- 根据本次 browser trend refresh 再判断下一轮性能切片；发布线仍受 `"private": true` 门禁约束。
```

- [ ] **Step 3: Add the log index row**

Add this row to the `2026-07-20` table after `008`:

```md
| 009 | 优化 initial props mount fast path | renderer performance、unit test、性能文档、项目日志 | `src/renderer/diff.ts`, `tests/unit/renderer/diff.test.ts`, `docs/performance.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-20-009-initial-props-mount-fast-path.md) |
```

---

### Task 4: Final Validation And Commit

**Files:**

- All changed files

- [ ] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write src/renderer/diff.ts tests/unit/renderer/diff.test.ts docs/performance.md docs/superpowers/specs/2026-07-20-initial-props-mount-fast-path-design.md docs/superpowers/plans/2026-07-20-initial-props-mount-fast-path.md solace-project-log/solace-entries/2026-07-20-007-initial-props-mount-fast-path-design.md solace-project-log/solace-entries/2026-07-20-008-initial-props-mount-fast-path-plan.md solace-project-log/solace-entries/2026-07-20-009-initial-props-mount-fast-path.md solace-project-log/index.md
```

Expected: exits with code 0.

- [ ] **Step 2: Run focused validation**

Run:

```bash
pnpm vitest run tests/unit/renderer/diff.test.ts
pnpm vitest run tests/unit/event/event.test.ts
pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts
```

Expected: all commands exit with code 0.

- [ ] **Step 3: Refresh browser benchmark trend**

Run:

```bash
SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 pnpm benchmark:browser
pnpm benchmark:history -- --min-browser-count 20 --json
pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json
```

Expected: benchmark exits with code 0, appends ignored browser history, and both history summaries exit with code 0.

- [ ] **Step 4: Run the full validation set**

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

- [ ] **Step 5: Confirm generated history stays ignored**

Run:

```bash
git status --short --ignored=matching
```

Expected: `.benchmark-history/` appears as ignored (`!!`), not as tracked or untracked (`??`).

- [ ] **Step 6: Commit**

Run:

```bash
git add src/renderer/diff.ts tests/unit/renderer/diff.test.ts docs/performance.md docs/superpowers/specs/2026-07-20-initial-props-mount-fast-path-design.md docs/superpowers/plans/2026-07-20-initial-props-mount-fast-path.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-20-009-initial-props-mount-fast-path.md
git commit -m "perf: add initial props mount fast path"
```

Expected: creates the implementation commit without adding `.benchmark-history/`.
