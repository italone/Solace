# Browser Production Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Chromium browser benchmark path that runs against a production-built Vite Solace example and records large-list render, update, and unmount timings.

**Architecture:** Create a dedicated `examples/performance-benchmark` Vite app that exposes `window.__SOLACE_BENCHMARK__.run()`. Add an isolated Playwright config that builds the example, serves it with `vite preview`, calls the browser benchmark API, validates result shape, and logs a JSON timing summary. Keep normal e2e config unchanged and avoid absolute performance thresholds.

**Tech Stack:** TypeScript, Solace JSX runtime, Vite production build/preview, Playwright Chromium, package scripts, Prettier, ESLint.

---

## File Structure

- Create `examples/performance-benchmark/index.html`: benchmark app HTML shell.
- Create `examples/performance-benchmark/src/main.tsx`: Solace benchmark app and `window.__SOLACE_BENCHMARK__` API.
- Create `examples/performance-benchmark/vite.config.ts`: Vite aliases matching existing examples.
- Create `playwright.benchmark.config.ts`: dedicated browser benchmark Playwright config with production build + preview webServer.
- Create `tests/e2e/browser-benchmark.spec.ts`: Playwright benchmark spec.
- Modify `package.json`: add `build:benchmark:browser` and `benchmark:browser` scripts.
- Modify `.gitignore`: ignore generated Vite dist output under examples.
- Modify `eslint.config.js`: exclude generated example dist output from lint.
- Modify `docs/performance.md`: document browser benchmark command, scenarios, and caveats.
- Modify `readme.md`: update future benchmark recommendation now that a browser harness exists.
- Add `solace-project-log/solace-entries/2026-07-13-016-browser-production-benchmark.md`: project log entry.
- Modify `solace-project-log/index.md`: add 016 index row.

No `src/**` runtime files should change.

---

### Task 1: Add Browser Benchmark Example

**Files:**

- Create: `examples/performance-benchmark/index.html`
- Create: `examples/performance-benchmark/src/main.tsx`
- Create: `examples/performance-benchmark/vite.config.ts`

- [x] **Step 1: Create benchmark HTML shell**

Create `examples/performance-benchmark/index.html` with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Solace Browser Benchmark</title>
  </head>
  <body>
    <main id="app"></main>
    <pre id="benchmark-output" aria-live="polite"></pre>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [x] **Step 2: Create benchmark app runtime**

Create `examples/performance-benchmark/src/main.tsx` with:

```tsx
import { h, nextTick, reactive, render } from "solace";

type BrowserBenchmarkResult = {
  scenario: "large-list";
  rows: number;
  initialRenderMs: number;
  updateMs: number;
  unmountMs: number;
  selectedText: string;
  remainingNodesAfterUnmount: number;
};

type BrowserBenchmarkApi = {
  run(): Promise<BrowserBenchmarkResult>;
};

declare global {
  interface Window {
    __SOLACE_BENCHMARK__?: BrowserBenchmarkApi;
  }
}

const rows = Array.from({ length: 10_000 }, (_, index) => index + 1);
const state = reactive({
  selected: 1,
});

const output = document.querySelector("#benchmark-output");
const app = document.querySelector("#app");

const LargeList = () => () =>
  h("section", { id: "benchmark-root" }, [
    <h1>Solace Browser Benchmark</h1>,
    <p id="selected-row">selected: {state.selected}</p>,
    <div id="rows">
      {rows.map((row) => (
        <div key={row} data-row={row} class={state.selected === row ? "selected" : ""}>
          Row {row}
          {state.selected === row ? " selected" : ""}
        </div>
      ))}
    </div>,
  ]);

function ensureApp(): Element {
  if (app === null) {
    throw new Error("Missing #app benchmark mount point");
  }

  return app;
}

function now(): number {
  return performance.now();
}

function writeResult(result: BrowserBenchmarkResult): void {
  if (output !== null) {
    output.textContent = JSON.stringify(result, null, 2);
  }
}

async function runBenchmark(): Promise<BrowserBenchmarkResult> {
  const container = ensureApp();
  state.selected = 1;

  const initialStart = now();
  render(h(LargeList), container);
  const firstSelected = container.querySelector('[data-row="1"]');
  const initialRenderMs = now() - initialStart;

  if (firstSelected?.textContent?.includes("selected") !== true) {
    throw new Error("Initial selected row was not rendered");
  }

  const updateStart = now();
  state.selected = 5000;
  await nextTick();
  const selected = container.querySelector('[data-row="5000"]');
  const selectedText = selected?.textContent ?? "";
  const updateMs = now() - updateStart;

  if (!selectedText.includes("selected")) {
    throw new Error("Updated selected row was not rendered");
  }

  const unmountStart = now();
  render(<section id="benchmark-complete">complete</section>, container);
  const unmountMs = now() - unmountStart;
  const remainingNodesAfterUnmount = container.querySelectorAll("#rows > div").length;

  const result: BrowserBenchmarkResult = {
    scenario: "large-list",
    rows: rows.length,
    initialRenderMs,
    updateMs,
    unmountMs,
    selectedText,
    remainingNodesAfterUnmount,
  };

  writeResult(result);
  return result;
}

window.__SOLACE_BENCHMARK__ = {
  run: runBenchmark,
};

if (app !== null) {
  render(<p>Browser benchmark ready</p>, app);
}
```

- [x] **Step 3: Create benchmark Vite config**

Create `examples/performance-benchmark/vite.config.ts` with:

```ts
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "solace/jsx-runtime",
        replacement: fileURLToPath(new URL("../../src/jsx-runtime.ts", import.meta.url)),
      },
      {
        find: "solace/jsx-dev-runtime",
        replacement: fileURLToPath(new URL("../../src/jsx-dev-runtime.ts", import.meta.url)),
      },
      {
        find: /^solace$/,
        replacement: fileURLToPath(new URL("../../src/index.ts", import.meta.url)),
      },
    ],
  },
});
```

- [x] **Step 4: Build benchmark example directly**

Run:

```bash
pnpm exec vite build examples/performance-benchmark
```

Expected:

- Vite exits with code 0.
- Output includes `examples/performance-benchmark/dist`.

---

### Task 2: Add Playwright Browser Benchmark Harness

**Files:**

- Create: `playwright.benchmark.config.ts`
- Create: `tests/e2e/browser-benchmark.spec.ts`

- [x] **Step 1: Create dedicated Playwright benchmark config**

Create `playwright.benchmark.config.ts` with:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "browser-benchmark.spec.ts",
  webServer: {
    command:
      "pnpm exec vite build examples/performance-benchmark && pnpm exec vite preview examples/performance-benchmark --host 127.0.0.1 --port 5177",
    url: "http://127.0.0.1:5177",
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://127.0.0.1:5177",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
```

- [x] **Step 2: Create browser benchmark spec**

Create `tests/e2e/browser-benchmark.spec.ts` with:

```ts
import { expect, test } from "@playwright/test";

type BrowserBenchmarkResult = {
  scenario: "large-list";
  rows: number;
  initialRenderMs: number;
  updateMs: number;
  unmountMs: number;
  selectedText: string;
  remainingNodesAfterUnmount: number;
};

test("measures large-list render, update, and unmount in a production browser build", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#app")).toContainText("Browser benchmark ready");

  const result = await page.evaluate(async () => {
    const api = window.__SOLACE_BENCHMARK__;
    if (api === undefined) {
      throw new Error("Missing browser benchmark API");
    }

    return api.run();
  });

  expectBrowserBenchmarkResult(result);
  console.log(`browser benchmark summary: ${JSON.stringify(result)}`);
});

function expectBrowserBenchmarkResult(result: BrowserBenchmarkResult): void {
  expect(result.scenario).toBe("large-list");
  expect(result.rows).toBe(10_000);
  expectFinitePositive(result.initialRenderMs);
  expectFinitePositive(result.updateMs);
  expectFinitePositive(result.unmountMs);
  expect(result.selectedText).toContain("Row 5000 selected");
  expect(result.remainingNodesAfterUnmount).toBe(0);
}

function expectFinitePositive(value: number): void {
  expect(Number.isFinite(value)).toBe(true);
  expect(value).toBeGreaterThan(0);
}

declare global {
  interface Window {
    __SOLACE_BENCHMARK__?: {
      run(): Promise<BrowserBenchmarkResult>;
    };
  }
}
```

- [x] **Step 3: Run Playwright config directly**

Run:

```bash
pnpm exec playwright test --config playwright.benchmark.config.ts
```

Expected:

- Playwright starts the production preview server on `127.0.0.1:5177`.
- Playwright reports `1 passed`.
- Console output includes `browser benchmark summary:`.

---

### Task 3: Add Package Scripts

**Files:**

- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `eslint.config.js`

- [x] **Step 1: Add benchmark browser scripts**

In `package.json`, add these scripts near the existing `benchmark` script:

```json
"build:benchmark:browser": "vite build examples/performance-benchmark",
"benchmark:browser": "playwright test --config playwright.benchmark.config.ts",
```

The surrounding script block should include:

```json
"benchmark": "vitest run --config vitest.benchmark.config.ts",
"build:benchmark:browser": "vite build examples/performance-benchmark",
"benchmark:browser": "playwright test --config playwright.benchmark.config.ts",
"package:smoke": "node scripts/package-consumer-smoke.mjs",
```

- [x] **Step 2: Run package script**

Run:

```bash
pnpm benchmark:browser
```

Expected:

- The script exits with code 0.
- Playwright reports `1 passed`.
- Output includes `browser benchmark summary:`.

- [x] **Step 3: Ignore generated benchmark build output**

In `.gitignore`, add this line under the existing `dist/` entry:

```gitignore
examples/**/dist/
```

In `eslint.config.js`, add this ignore entry after `"dist/**"`:

```js
"examples/**/dist/**",
```

---

### Task 4: Update Documentation And Project Log

**Files:**

- Modify: `docs/performance.md`
- Modify: `readme.md`
- Add: `solace-project-log/solace-entries/2026-07-13-016-browser-production-benchmark.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Update performance validation section**

In `docs/performance.md`, add this bullet after the Tinybench bullet in "Current Validation":

```md
- Chromium browser production benchmark for large-list initial render, reactive update, and unmount through `pnpm benchmark:browser`.
```

- [x] **Step 2: Add browser benchmark section**

In `docs/performance.md`, add this section after "Latest Local Benchmark Run" and before "Benchmark Principles":

````md
## Browser Production Benchmark

Command:

```bash
pnpm benchmark:browser
```
````

This command builds `examples/performance-benchmark`, serves the production output through Vite
preview, and runs `tests/e2e/browser-benchmark.spec.ts` in Chromium.

Measured scenarios:

| Scenario                    | Scale       | Assertion                              |
| --------------------------- | ----------- | -------------------------------------- |
| Initial large-list render   | 10,000 rows | selected row 1 is rendered             |
| Reactive selected-row patch | 10,000 rows | selected row 5000 reflects final state |
| Large-list unmount          | 10,000 rows | row nodes are removed                  |

The command logs a `browser benchmark summary` JSON line. It intentionally does not enforce absolute
timing thresholds because browser, CPU, power mode, and background process variance can dominate
individual runs.

````

- [x] **Step 3: Update README future recommendations**

In `readme.md`, under `## 14. 后续建议`, replace these two bullets:

```md
- 继续跟踪 keyed diff、Fragment 和组件批量更新场景的性能趋势，并补充真实浏览器生产构建 benchmark 数据。
- 在真实浏览器生产构建中补充渲染、更新和卸载 benchmark 数据。
````

with:

```md
- 持续记录 jsdom 与 Chromium 生产构建 benchmark 趋势，并补充机器、浏览器和样本量元数据。
```

- [x] **Step 4: Add project log entry**

Create `solace-project-log/solace-entries/2026-07-13-016-browser-production-benchmark.md`
with:

```md
# 2026-07-13-016：新增浏览器生产构建性能基准

## 基本信息

- 日期：2026-07-13
- 类型：测试 / 示例 / 文档 / 工具
- 状态：验证中
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增 `examples/performance-benchmark` 生产构建 benchmark 示例和独立 Playwright benchmark 配置。`pnpm benchmark:browser` 会构建示例、通过 Vite preview 启动生产输出，并在 Chromium 中测量 10,000 行列表的初始渲染、响应式更新和卸载耗时。

## 变动原因

现有 `pnpm benchmark` 基于 jsdom 和 tinybench，不能代表真实浏览器生产构建表现。性能文档和 README 都将浏览器生产构建 benchmark 数据列为后续方向，本次建立可重复运行的 harness，但不设置绝对性能阈值。

## 影响范围

- 影响模块：Vite 示例、Playwright benchmark、package scripts、性能文档、README、项目日志。
- 行为变化：新增 `pnpm benchmark:browser` 命令，不影响现有 `pnpm test:e2e`。
- 风险等级：中；新增生产 build/preview 测试路径，但不修改 runtime 源码。

## 涉及文件

| 文件                                                                               | 动作 | 说明                               |
| ---------------------------------------------------------------------------------- | ---- | ---------------------------------- |
| `examples/performance-benchmark/index.html`                                        | 新增 | 浏览器 benchmark HTML shell        |
| `examples/performance-benchmark/src/main.tsx`                                      | 新增 | 浏览器 benchmark app 和 window API |
| `examples/performance-benchmark/vite.config.ts`                                    | 新增 | benchmark 示例 Vite alias 配置     |
| `playwright.benchmark.config.ts`                                                   | 新增 | 独立 Playwright benchmark 配置     |
| `tests/e2e/browser-benchmark.spec.ts`                                              | 新增 | Chromium benchmark spec            |
| `package.json`                                                                     | 修改 | 新增 benchmark browser scripts     |
| `docs/performance.md`                                                              | 修改 | 记录浏览器生产构建 benchmark       |
| `readme.md`                                                                        | 修改 | 更新后续性能建议                   |
| `docs/superpowers/specs/2026-07-13-browser-production-benchmark-design.md`         | 新增 | 记录设计                           |
| `docs/superpowers/plans/2026-07-13-browser-production-benchmark.md`                | 新增 | 记录实施计划                       |
| `solace-project-log/index.md`                                                      | 修改 | 追加本次日志索引                   |
| `solace-project-log/solace-entries/2026-07-13-016-browser-production-benchmark.md` | 新增 | 记录本次变更                       |

## 验证记录

| 验证项            | 命令或方式               | 结果   |
| ----------------- | ------------------------ | ------ |
| Browser benchmark | `pnpm benchmark:browser` | 待执行 |
| Typecheck         | `pnpm typecheck`         | 待执行 |
| Lint              | `pnpm lint`              | 待执行 |
| 格式检查          | `pnpm format:check`      | 待执行 |

## 后续动作

- 后续可记录更多机器和浏览器元数据，或在稳定后评估是否纳入 release gate。
```

- [x] **Step 5: Add project log index row**

In `solace-project-log/index.md`, add this row after the 015 row in the 2026-07-13 section:

```md
| 016 | 新增浏览器生产构建性能基准 | Vite benchmark 示例、Playwright benchmark、package scripts、性能文档、README | `examples/performance-benchmark/**`, `playwright.benchmark.config.ts`, `tests/e2e/browser-benchmark.spec.ts`, `package.json`, `docs/performance.md`, `readme.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-13-016-browser-production-benchmark.md) |
```

---

### Task 5: Format And Validate

**Files:**

- Modify after validation: `solace-project-log/solace-entries/2026-07-13-016-browser-production-benchmark.md`
- Modify if formatting changes are needed: all files touched in Tasks 1-4

- [x] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write examples/performance-benchmark/index.html examples/performance-benchmark/src/main.tsx examples/performance-benchmark/vite.config.ts playwright.benchmark.config.ts tests/e2e/browser-benchmark.spec.ts package.json eslint.config.js docs/performance.md readme.md docs/superpowers/specs/2026-07-13-browser-production-benchmark-design.md docs/superpowers/plans/2026-07-13-browser-production-benchmark.md solace-project-log/solace-entries/2026-07-13-016-browser-production-benchmark.md solace-project-log/index.md
```

Expected: Prettier exits with code 0.

- [x] **Step 2: Run browser benchmark package script**

Run:

```bash
pnpm benchmark:browser
```

Expected:

- Playwright reports `1 passed`.
- Output includes `browser benchmark summary:`.

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

In `solace-project-log/solace-entries/2026-07-13-016-browser-production-benchmark.md`,
replace:

```md
- 状态：验证中
```

with:

```md
- 状态：已完成
```

Replace the verification rows:

```md
| Browser benchmark | `pnpm benchmark:browser` | 待执行 |
| Typecheck | `pnpm typecheck` | 待执行 |
| Lint | `pnpm lint` | 待执行 |
| 格式检查 | `pnpm format:check` | 待执行 |
```

with:

```md
| Browser benchmark | `pnpm benchmark:browser` | 通过，Chromium benchmark 1 个测试通过并输出 browser benchmark summary |
| Typecheck | `pnpm typecheck` | 通过，无类型错误 |
| Lint | `pnpm lint` | 通过，无 ESLint 错误 |
| 格式检查 | `pnpm format:check` | 通过，所有匹配文件符合 Prettier 风格 |
```

- [x] **Step 7: Run final format check**

Run:

```bash
pnpm format:check
```

Expected: `All matched files use Prettier code style!`

- [x] **Step 8: Confirm runtime source files were not changed**

Run:

```bash
find src -type f -newer docs/superpowers/specs/2026-07-13-browser-production-benchmark-design.md -print
```

Expected: no `src/**` file is printed.
