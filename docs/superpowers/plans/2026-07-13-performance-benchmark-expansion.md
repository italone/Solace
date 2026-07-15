# Performance Benchmark Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Solace's existing tinybench coverage for keyed diff operations, Fragment rendering, and batched component updates.

**Architecture:** Keep benchmark coverage in `tests/performance/**/*.bench.ts` using the existing Vitest + tinybench setup. Add benchmark tasks that assert concrete DOM results, report latency/throughput, and avoid absolute speed thresholds. Update performance documentation and project logs without changing runtime source behavior.

**Tech Stack:** TypeScript, Vitest benchmark config, tinybench, jsdom, Solace `h` / `render` / `Fragment` / `reactive` / `nextTick`.

---

## File Structure

- Modify `tests/performance/list-diff.bench.ts`: add focused keyed insert, remove, and move benchmark cases to the existing list diff suite.
- Create `tests/performance/fragment.bench.ts`: benchmark Fragment initial render and Fragment patching with keyed children.
- Create `tests/performance/component-update.bench.ts`: benchmark many reactive component consumers updated in one scheduler tick.
- Modify `vitest.benchmark.config.ts`: allow longer benchmark cases to finish under Vitest's test timeout.
- Modify `docs/performance.md`: update current validation and latest local benchmark tables with the expanded coverage.
- Modify `readme.md`: update the future benchmark recommendation to show this coverage is now part of the benchmark suite.
- Add `solace-project-log/solace-entries/2026-07-13-015-performance-benchmark-expansion.md`: record the change and verification.
- Modify `solace-project-log/index.md`: add the 015 log entry.

No production source files should change.

---

### Task 1: Extend Keyed Diff Benchmarks

**Files:**

- Modify: `tests/performance/list-diff.bench.ts`

- [x] **Step 1: Add keyed operation fixtures**

In `tests/performance/list-diff.bench.ts`, add these constants after the existing `rows` constant:

```ts
const insertedRows = [
  ...rows.slice(0, 5000),
  ...Array.from({ length: 100 }, (_, index) => 10_001 + index),
  ...rows.slice(5000),
];
const removedRows = [...rows.slice(0, 4500), ...rows.slice(4600)];
const movedRows = [rows[rows.length - 1], ...rows.slice(0, rows.length - 1)];
```

- [x] **Step 2: Add local keyed insert benchmark**

In the existing `it("measures 10000 row create, update, delete, and reorder", async () => { ... })`
block, add this task after `"10000 row delete"` and before `"10000 row keyed reorder"`:

```ts
bench.add("10000 row keyed middle insert", () => {
  const container = document.createElement("div");
  render(list(1), container);
  render(list(1, insertedRows), container);
  expect(container.querySelectorAll("p")).toHaveLength(10100);
  expect(container.querySelector('[data-row="10001"]')?.textContent).toBe("Row 10001");
});
```

- [x] **Step 3: Add local keyed remove benchmark**

In the same benchmark block, add this task after `"10000 row keyed middle insert"`:

```ts
bench.add("10000 row keyed middle remove", () => {
  const container = document.createElement("div");
  render(list(1), container);
  render(list(1, removedRows), container);
  expect(container.querySelectorAll("p")).toHaveLength(9900);
  expect(container.querySelector('[data-row="4501"]')).toBeNull();
  expect(container.querySelector('[data-row="4601"]')?.textContent).toBe("Row 4601");
});
```

- [x] **Step 4: Add keyed tail-to-head move benchmark**

In the same benchmark block, add this task after `"10000 row keyed middle remove"`:

```ts
bench.add("10000 row keyed tail to head move", () => {
  const container = document.createElement("div");
  render(list(1), container);
  const moved = container.querySelector('[data-row="10000"]');
  render(list(1, movedRows), container);
  expect(container.querySelector("p")?.textContent).toBe("Row 10000");
  expect(container.querySelector("p")).toBe(moved);
});
```

- [x] **Step 5: Run keyed diff benchmark file**

Run:

```bash
pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts
```

Expected:

- Vitest reports `Test Files 1 passed (1)`.
- The benchmark logs include these task names:
  - `10000 row keyed middle insert`
  - `10000 row keyed middle remove`
  - `10000 row keyed tail to head move`

---

### Task 2: Add Fragment Benchmarks

**Files:**

- Create: `tests/performance/fragment.bench.ts`

- [x] **Step 1: Create Fragment benchmark file**

Create `tests/performance/fragment.bench.ts` with this content:

```ts
import { Bench } from "tinybench";
import { describe, expect, it } from "vitest";

import { Fragment, h, render } from "../../src/index";

const rows = Array.from({ length: 5000 }, (_, index) => index + 1);
const insertedRows = [
  ...rows.slice(0, 2500),
  ...Array.from({ length: 50 }, (_, index) => 5001 + index),
  ...rows.slice(2500),
];

function fragment(items = rows, selected = 1) {
  return h(
    Fragment,
    null,
    items.map((row) =>
      h(
        "span",
        { key: row, "data-row": row },
        selected === row ? `Fragment row ${row} selected` : `Fragment row ${row}`,
      ),
    ),
  );
}

function report(bench: Bench): void {
  for (const task of bench.tasks) {
    const result = task.result;
    if (result.state !== "completed") {
      console.log(`${task.name}: ${result.state}`);
      continue;
    }

    const { latency, throughput } = result;
    console.log(
      `${task.name}: latency mean ${latency.mean.toFixed(3)}ms, p99 ${latency.p99.toFixed(3)}ms, throughput ${throughput.mean.toFixed(2)} ops/sec`,
    );
  }
}

describe("fragment benchmark", () => {
  it("measures Fragment initial render and patch", async () => {
    const bench = new Bench({ iterations: 1, time: 20, warmup: false });

    bench.add("5000 Fragment child initial render", () => {
      const container = document.createElement("div");
      render(fragment(), container);
      expect(container.querySelectorAll("span")).toHaveLength(5000);
      expect(container.querySelector('[data-row="1"]')?.textContent).toBe(
        "Fragment row 1 selected",
      );
    });

    bench.add("5000 Fragment child local text patch", () => {
      const container = document.createElement("div");
      render(fragment(), container);
      const patched = container.querySelector('[data-row="2500"]');
      render(fragment(rows, 2500), container);
      expect(container.querySelector('[data-row="2500"]')).toBe(patched);
      expect(container.querySelector('[data-row="2500"]')?.textContent).toBe(
        "Fragment row 2500 selected",
      );
    });

    bench.add("5000 Fragment child middle insert", () => {
      const container = document.createElement("div");
      render(fragment(), container);
      render(fragment(insertedRows), container);
      expect(container.querySelectorAll("span")).toHaveLength(5050);
      expect(container.querySelector('[data-row="5001"]')?.textContent).toBe("Fragment row 5001");
    });

    await bench.run();
    report(bench);

    for (const task of bench.tasks) {
      const result = task.result;
      expect(result.state).toBe("completed");
      if (result.state === "completed") {
        expect(result.latency.mean).toBeGreaterThan(0);
      }
    }
  });
});
```

- [x] **Step 2: Run Fragment benchmark file**

Run:

```bash
pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/fragment.bench.ts
```

Expected:

- Vitest reports `Test Files 1 passed (1)`.
- The benchmark logs include:
  - `5000 Fragment child initial render`
  - `5000 Fragment child local text patch`
  - `5000 Fragment child middle insert`

---

### Task 3: Add Batched Component Update Benchmark

**Files:**

- Create: `tests/performance/component-update.bench.ts`

- [x] **Step 1: Create component update benchmark file**

Create `tests/performance/component-update.bench.ts` with this content:

```ts
import { Bench } from "tinybench";
import { describe, expect, it } from "vitest";

import { h, nextTick, reactive, render } from "../../src/index";

const itemCount = 1000;

function report(bench: Bench): void {
  for (const task of bench.tasks) {
    const result = task.result;
    if (result.state !== "completed") {
      console.log(`${task.name}: ${result.state}`);
      continue;
    }

    const { latency, throughput } = result;
    console.log(
      `${task.name}: latency mean ${latency.mean.toFixed(3)}ms, p99 ${latency.p99.toFixed(3)}ms, throughput ${throughput.mean.toFixed(2)} ops/sec`,
    );
  }
}

describe("component update benchmark", () => {
  it("measures batched reactive updates across many components", async () => {
    const bench = new Bench({ iterations: 1, time: 20, warmup: false });

    bench.add("1000 component batched reactive update", async () => {
      const state = reactive({ count: 0 });
      const container = document.createElement("div");
      const Counter = (props: { index: number }) => () =>
        h("span", { "data-index": props.index }, `item ${props.index}: ${state.count}`);
      const App = () =>
        h(
          "div",
          null,
          Array.from({ length: itemCount }, (_, index) => h(Counter, { key: index, index })),
        );

      render(h(App), container);
      expect(container.querySelectorAll("span")).toHaveLength(itemCount);

      state.count = 1;
      state.count = 2;
      state.count = 3;

      await nextTick();

      expect(container.querySelector('[data-index="0"]')?.textContent).toBe("item 0: 3");
      expect(container.querySelector(`[data-index="${itemCount - 1}"]`)?.textContent).toBe(
        `item ${itemCount - 1}: 3`,
      );
    });

    await bench.run();
    report(bench);

    const result = bench.tasks[0].result;
    expect(result.state).toBe("completed");
    if (result.state === "completed") {
      expect(result.latency.mean).toBeGreaterThan(0);
    }
  });
});
```

- [x] **Step 2: Run component update benchmark file**

Run:

```bash
pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/component-update.bench.ts
```

Expected:

- Vitest reports `Test Files 1 passed (1)`.
- The benchmark logs include `1000 component batched reactive update`.

---

### Task 4: Update Documentation And Project Log

**Files:**

- Modify: `docs/performance.md`
- Modify: `readme.md`
- Add: `solace-project-log/solace-entries/2026-07-13-015-performance-benchmark-expansion.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Update performance current validation text**

In `docs/performance.md`, replace this bullet:

```md
- Tinybench smoke benchmarks for initial render, list diff, keyed reorder, and mount/unmount loops.
```

with:

```md
- Tinybench smoke benchmarks for initial render, list diff, keyed insert/remove/move/reorder, Fragment rendering, batched component updates, and mount/unmount loops.
```

- [x] **Step 2: Update performance result summary table**

In `docs/performance.md`, replace the existing three-row result summary table body with:

```md
| Scenario                                         | File                                          | Status | Notes                                                                  |
| ------------------------------------------------ | --------------------------------------------- | ------ | ---------------------------------------------------------------------- |
| 1,000 component initial render                   | `tests/performance/render.bench.ts`           | Passed | Uses jsdom and Tinybench, intended for trend tracking                  |
| 10,000 row create/update/delete/reorder          | `tests/performance/list-diff.bench.ts`        | Passed | Covers list creation, local text update, delete, and keyed reorder     |
| 10,000 row keyed local insert/remove/move        | `tests/performance/list-diff.bench.ts`        | Passed | Covers focused middle insert, middle remove, and tail-to-head move     |
| 5,000 Fragment child initial render/patch/insert | `tests/performance/fragment.bench.ts`         | Passed | Covers Fragment child mount, keyed text patch, and keyed middle insert |
| 1,000 component batched reactive update          | `tests/performance/component-update.bench.ts` | Passed | Covers scheduler batching across many component consumers              |
| Component mount/unmount loop                     | `tests/performance/memory.bench.ts`           | Passed | Observes repeated cleanup path and records heap delta during the run   |
```

- [x] **Step 3: Update README later-roadmap benchmark bullet**

In `readme.md`, under `## 14. 后续建议`, replace:

```md
- 继续扩展 keyed diff、Fragment 和组件批量更新场景的性能基准。
```

with:

```md
- 继续跟踪 keyed diff、Fragment 和组件批量更新场景的性能趋势，并补充真实浏览器生产构建 benchmark 数据。
```

- [x] **Step 4: Add project log entry**

Create `solace-project-log/solace-entries/2026-07-13-015-performance-benchmark-expansion.md`
with this content:

```md
# 2026-07-13-015：扩展性能基准覆盖

## 基本信息

- 日期：2026-07-13
- 类型：测试 / 文档
- 状态：验证中
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

扩展 `pnpm benchmark` 覆盖范围，新增 keyed diff 局部插入、局部删除、尾部移动到头部、Fragment 初始渲染与 patch、以及 1000 个组件消费者的批量响应式更新 benchmark。所有 benchmark 继续使用 Vitest + tinybench，并保留 DOM 断言。

## 变动原因

README 后续建议中明确提出继续扩展 keyed diff、Fragment 和组件批量更新场景的性能基准。本次先补齐 jsdom smoke benchmark 覆盖，不引入新的 benchmark 工具，也不改 runtime 行为。

## 影响范围

- 影响模块：performance benchmark、性能文档、README、项目日志。
- 行为变化：`pnpm benchmark` 将运行更多 tinybench 场景。
- 风险等级：低；只增加 benchmark 和文档，不修改生产源码。

## 涉及文件

| 文件                                                                                  | 动作 | 说明                                    |
| ------------------------------------------------------------------------------------- | ---- | --------------------------------------- |
| `tests/performance/list-diff.bench.ts`                                                | 修改 | 增加 keyed insert/remove/move benchmark |
| `tests/performance/fragment.bench.ts`                                                 | 新增 | 增加 Fragment render/patch benchmark    |
| `tests/performance/component-update.bench.ts`                                         | 新增 | 增加组件批量响应式更新 benchmark        |
| `docs/performance.md`                                                                 | 修改 | 更新 benchmark 覆盖说明                 |
| `readme.md`                                                                           | 修改 | 更新后续性能建议                        |
| `solace-project-log/index.md`                                                         | 修改 | 追加本次日志索引                        |
| `solace-project-log/solace-entries/2026-07-13-015-performance-benchmark-expansion.md` | 新增 | 记录本次变更                            |

## 验证记录

| 验证项    | 命令或方式          | 结果   |
| --------- | ------------------- | ------ |
| Benchmark | `pnpm benchmark`    | 待执行 |
| Typecheck | `pnpm typecheck`    | 待执行 |
| Lint      | `pnpm lint`         | 待执行 |
| 格式检查  | `pnpm format:check` | 待执行 |

## 后续动作

- 后续可补充真实浏览器生产构建 benchmark harness，并记录浏览器、机器和样本量。
```

- [x] **Step 5: Add project log index row**

In `solace-project-log/index.md`, add this row after the 014 row in the 2026-07-13 section:

```md
| 015 | 扩展性能基准覆盖 | tinybench 性能测试、性能文档、README、项目日志 | `tests/performance/**`, `docs/performance.md`, `readme.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-13-015-performance-benchmark-expansion.md) |
```

---

### Task 5: Format And Validate

**Files:**

- Modify after validation: `solace-project-log/solace-entries/2026-07-13-015-performance-benchmark-expansion.md`
- Modify if formatting changes are needed: all files touched in Tasks 1-4
- Modify if benchmark timeout is required: `vitest.benchmark.config.ts`

- [x] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write tests/performance/list-diff.bench.ts tests/performance/fragment.bench.ts tests/performance/component-update.bench.ts vitest.benchmark.config.ts docs/performance.md readme.md docs/superpowers/specs/2026-07-13-performance-benchmark-expansion-design.md docs/superpowers/plans/2026-07-13-performance-benchmark-expansion.md solace-project-log/solace-entries/2026-07-13-015-performance-benchmark-expansion.md solace-project-log/index.md
```

Expected: Prettier prints each touched file and exits with code 0.

- [x] **Step 2: Run full benchmark suite**

Run:

```bash
pnpm benchmark
```

Expected:

- Vitest reports all benchmark files passed.
- Output includes benchmark task names from list diff, Fragment, component update, render, and memory files.

- [x] **Step 3: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: `tsc --noEmit` exits with code 0.

- [x] **Step 4: Run lint**

Run:

```bash
pnpm lint
```

Expected: `eslint .` exits with code 0.

- [x] **Step 5: Run format check**

Run:

```bash
pnpm format:check
```

Expected: `All matched files use Prettier code style!`

- [x] **Step 6: Update project log validation table**

In `solace-project-log/solace-entries/2026-07-13-015-performance-benchmark-expansion.md`,
replace:

```md
- 状态：验证中
```

with:

```md
- 状态：已完成
```

Replace the verification table rows:

```md
| Benchmark | `pnpm benchmark` | 待执行 |
| Typecheck | `pnpm typecheck` | 待执行 |
| Lint | `pnpm lint` | 待执行 |
| 格式检查 | `pnpm format:check` | 待执行 |
```

with these rows after the commands pass:

```md
| Benchmark | `pnpm benchmark` | 通过，5 个 benchmark 文件、5 个测试通过，并输出 list diff、Fragment、component update、render、memory benchmark 任务 |
| Typecheck | `pnpm typecheck` | 通过，无类型错误 |
| Lint | `pnpm lint` | 通过，无 ESLint 错误 |
| 格式检查 | `pnpm format:check` | 通过，所有匹配文件符合 Prettier 风格 |
```

- [x] **Step 7: Run final format check after log update**

Run:

```bash
pnpm format:check
```

Expected: `All matched files use Prettier code style!`

- [x] **Step 8: Confirm no source runtime files changed**

Run:

```bash
find src -type f -newer docs/superpowers/specs/2026-07-13-performance-benchmark-expansion-design.md -print
```

Expected: no `src/**` file is printed by this command.

If the command prints a source file, inspect it and explain why a runtime source file changed before
claiming completion.
