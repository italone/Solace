# Initial Class Mount Fast Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce first-render overhead for the common `class` prop without changing update semantics.

**Architecture:** Keep the change local to the renderer's initial element mount path. Extend the initial props mount
helper so `class` on `HTMLElement` instances uses `className`, non-HTML nodes fall back to the attribute path, and all
other props keep their current initial mount behavior. Leave `patchProps()` unchanged.

**Tech Stack:** TypeScript, Vitest, jsdom, tinybench, Playwright browser benchmark, pnpm, Prettier.

---

## File Structure

- Modify `tests/unit/renderer/diff.test.ts`: add RED regression coverage for initial `class` mount and mixed `class`
  plus ordinary attribute mounts.
- Modify `src/renderer/diff.ts`: add the initial class mount fast path and call it from the initial props helper.
- Modify `docs/performance.md`: record the new initial class mount fast path.
- Add `solace-project-log/solace-entries/2026-07-20-012-initial-class-mount-fast-path.md`: record implementation and
  validation.
- Modify `solace-project-log/index.md`: add the `2026-07-20` implementation row.

Do not modify public package exports, browser benchmark thresholds, scheduler behavior, DevTools payloads, or release
flow.

---

### Task 1: Add The Failing Initial Class Regression Tests

**Files:**

- Modify: `tests/unit/renderer/diff.test.ts`

- [ ] **Step 1: Add RED tests**

Add these tests after the initial props fast-path tests:

```ts
it("uses className for initial HTML class mounts", () => {
  const container = document.createElement("div");
  const setAttribute = vi.spyOn(Element.prototype, "setAttribute");

  render(h("div", { class: "selected" }, "Row"), container);

  const row = container.querySelector("div") as HTMLDivElement;

  expect(row.className).toBe("selected");
  expect(row.textContent).toBe("Row");
  expect(setAttribute).not.toHaveBeenCalledWith("class", expect.anything());
});

it("still mounts ordinary attributes alongside initial class mounts", () => {
  const container = document.createElement("div");
  const setAttribute = vi.spyOn(Element.prototype, "setAttribute");

  render(h("div", { class: "selected", "data-row": 1 }, "Row"), container);

  const row = container.querySelector('[data-row="1"]') as HTMLDivElement;

  expect(row.className).toBe("selected");
  expect(row.textContent).toBe("Row");
  expect(row.getAttribute("data-row")).toBe("1");
  expect(setAttribute).toHaveBeenCalledWith("data-row", "1");
});
```

- [ ] **Step 2: Run the renderer test to verify RED**

Run:

```bash
pnpm vitest run tests/unit/renderer/diff.test.ts
```

Expected: the new tests fail because initial class mounting still routes through the generic attribute path.

---

### Task 2: Add The Initial Class Mount Fast Path

**Files:**

- Modify: `src/renderer/diff.ts`

- [ ] **Step 1: Extend the initial props helper**

In the initial props helper, replace the generic `class` handling with a dedicated branch:

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

    if (key === "class") {
      mountInitialClass(el, value);
      continue;
    }

    if (mightBeEventProp(key)) {
      patchProp(el, key, null, value);
      continue;
    }

    el.setAttribute(key, String(value));
  }
}

function mountInitialClass(el: Element, value: unknown): void {
  if (el instanceof HTMLElement) {
    el.className = String(value);
    return;
  }

  el.setAttribute("class", String(value));
}
```

- [ ] **Step 2: Run the renderer and event tests to verify GREEN**

Run:

```bash
pnpm vitest run tests/unit/renderer/diff.test.ts
pnpm vitest run tests/unit/event/event.test.ts
```

Expected: both commands exit with code 0. The new renderer tests pass and existing event tests stay green.

---

### Task 3: Update Performance Docs And Project Log

**Files:**

- Modify: `docs/performance.md`
- Add: `solace-project-log/solace-entries/2026-07-20-012-initial-class-mount-fast-path.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update the performance note**

In `docs/performance.md`, add a short sentence near the current renderer follow-up summary:

```md
The initial element mount path now uses a direct HTML `className` fast path for `class` props, while keeping the
existing attribute fallback for non-HTML nodes.
```

- [ ] **Step 2: Add the implementation log entry**

Create `solace-project-log/solace-entries/2026-07-20-012-initial-class-mount-fast-path.md`:

```md
# 2026-07-20-012：优化 initial class mount fast path

## 基本信息

- 日期：2026-07-20
- 类型：renderer performance / unit test / performance docs / project log
- 状态：已完成

## 变动摘要

为 renderer element initial mount 增加 `class` fast path：HTML 元素上的 `class` 直接写入 `className`，
非 HTML 节点仍走 attribute fallback。

## 影响范围

- 影响模块：renderer element mount、renderer 单元测试、component benchmark、browser benchmark trend、性能文档、项目日志。
- 行为变化：无 public API 变化；update-time props patching 保持不变，event props 仍沿用现有路径。
- 风险等级：中低；主要风险是 non-HTML class 语义变化，已用 HTML class、mixed props、event 和 update tests 覆盖。

## 涉及文件

| 文件                                                                                | 动作 | 说明                               |
| ----------------------------------------------------------------------------------- | ---- | ---------------------------------- |
| `src/renderer/diff.ts`                                                              | 修改 | 增加 initial class mount fast path |
| `tests/unit/renderer/diff.test.ts`                                                  | 修改 | 覆盖 initial class mount 回归      |
| `docs/performance.md`                                                               | 修改 | 记录本次 renderer 性能优化         |
| `solace-project-log/solace-entries/2026-07-20-012-initial-class-mount-fast-path.md` | 新增 | 记录本次变更                       |
| `solace-project-log/index.md`                                                       | 修改 | 追加 2026-07-20 日志索引           |

## 验证记录

| 验证项                 | 命令或方式                                                                                                                             | 结果                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| TDD RED                | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                                                                     | 通过                   |
| Targeted renderer test | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                                                                     | 通过                   |
| Event test             | `pnpm vitest run tests/unit/event/event.test.ts`                                                                                       | 通过                   |
| Component benchmark    | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/render.bench.ts`                                           | 通过                   |
| List diff benchmark    | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts`                                        | 通过                   |
| Browser benchmark      | `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 pnpm benchmark:browser` | 通过                   |
| Browser history        | `pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json`                                                      | 通过                   |
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

Add this row to the `2026-07-20` table after `009`:

```md
| 010 | 设计 initial class mount fast path | performance 设计、renderer mount、项目日志 | `docs/superpowers/specs/2026-07-20-initial-class-mount-fast-path-design.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-20-010-initial-class-mount-fast-path-design.md) |
| 011 | 编写 initial class mount fast path 实现计划 | implementation plan、renderer performance、项目日志 | `docs/superpowers/plans/2026-07-20-initial-class-mount-fast-path.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-20-011-initial-class-mount-fast-path-plan.md) |
```

---

### Task 4: Final Validation And Commit

**Files:**

- All changed files

- [ ] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write src/renderer/diff.ts tests/unit/renderer/diff.test.ts docs/performance.md docs/superpowers/specs/2026-07-20-initial-class-mount-fast-path-design.md docs/superpowers/plans/2026-07-20-initial-class-mount-fast-path.md solace-project-log/solace-entries/2026-07-20-010-initial-class-mount-fast-path-design.md solace-project-log/solace-entries/2026-07-20-011-initial-class-mount-fast-path-plan.md solace-project-log/solace-entries/2026-07-20-012-initial-class-mount-fast-path.md solace-project-log/index.md
```

Expected: exits with code 0.

- [ ] **Step 2: Run focused validation**

Run:

```bash
pnpm vitest run tests/unit/renderer/diff.test.ts
pnpm vitest run tests/unit/event/event.test.ts
pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/render.bench.ts
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
git add src/renderer/diff.ts tests/unit/renderer/diff.test.ts docs/performance.md docs/superpowers/specs/2026-07-20-initial-class-mount-fast-path-design.md docs/superpowers/plans/2026-07-20-initial-class-mount-fast-path.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-20-010-initial-class-mount-fast-path-design.md solace-project-log/solace-entries/2026-07-20-011-initial-class-mount-fast-path-plan.md solace-project-log/solace-entries/2026-07-20-012-initial-class-mount-fast-path.md
git commit -m "perf: add initial class mount fast path"
```

Expected: creates the implementation commit without adding `.benchmark-history/`.
