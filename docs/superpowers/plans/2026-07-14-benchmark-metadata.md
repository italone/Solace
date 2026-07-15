# Browser Benchmark Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reproducibility metadata to the browser production benchmark summary without changing runtime APIs or adding timing thresholds.

**Architecture:** Keep `window.__SOLACE_BENCHMARK__.run()` focused on measured browser-side data. Build the metadata in the Playwright test from Node, OS, package, and Playwright browser information, then log one combined `browser benchmark summary` JSON payload.

**Tech Stack:** TypeScript, Playwright, Node standard library (`node:fs`, `node:os`), Markdown docs, Prettier, pnpm validation scripts.

---

## File Structure

- Modify `tests/e2e/browser-benchmark.spec.ts`: add metadata types, metadata builder, and assertions.
- Modify `playwright.config.ts`: exclude the benchmark-only spec from default e2e runs.
- Modify `docs/performance.md`: document the metadata payload and current sample size.
- Modify `readme.md`: update benchmark next-step wording.
- Add `solace-project-log/solace-entries/2026-07-14-002-benchmark-metadata.md`: record the change.
- Modify `solace-project-log/index.md`: add the 2026-07-14 `002` row.

No runtime source, package exports, package scripts, or benchmark fixture app files should change.

---

### Task 1: Add Browser Benchmark Metadata Assertions

**Files:**

- Modify: `tests/e2e/browser-benchmark.spec.ts`

- [ ] **Step 1: Add Node and OS imports**

At the top of `tests/e2e/browser-benchmark.spec.ts`, replace:

```ts
import { expect, test } from "@playwright/test";
```

with:

```ts
import { readFileSync } from "node:fs";
import { arch, cpus, platform, release, totalmem } from "node:os";

import { expect, test } from "@playwright/test";
```

- [ ] **Step 2: Add metadata types**

After `BrowserBenchmarkResult`, add:

```ts
type BrowserBenchmarkMetadata = {
  packageName: string;
  packageVersion: string;
  node: string;
  platform: string;
  release: string;
  arch: string;
  cpuModel: string;
  logicalCpuCount: number;
  totalMemoryBytes: number;
  browserName: string;
  browserVersion: string;
  projectName: string;
  sampleSize: number;
  runAt: string;
};

type BrowserBenchmarkSummary = BrowserBenchmarkResult & {
  metadata: BrowserBenchmarkMetadata;
};

type PackageMetadata = {
  name: string;
  version: string;
};
```

- [ ] **Step 3: Change the test fixture signature**

Replace:

```ts
test("measures large-list render, update, and unmount in a production browser build", async ({
  page,
}) => {
```

with:

```ts
test("measures large-list render, update, and unmount in a production browser build", async ({
  browser,
  browserName,
  page,
}, testInfo) => {
```

- [ ] **Step 4: Build and assert the combined summary**

Replace:

```ts
expectBrowserBenchmarkResult(result);
console.log(`browser benchmark summary: ${JSON.stringify(result)}`);
```

with:

```ts
const summary = createBrowserBenchmarkSummary(result, {
  browserName,
  browserVersion: browser.version(),
  projectName: testInfo.project.name,
});

expectBrowserBenchmarkSummary(summary);
console.log(`browser benchmark summary: ${JSON.stringify(summary)}`);
```

- [ ] **Step 5: Add metadata helpers and assertions**

After `expectBrowserBenchmarkResult`, add:

```ts
function createBrowserBenchmarkSummary(
  result: BrowserBenchmarkResult,
  options: Pick<BrowserBenchmarkMetadata, "browserName" | "browserVersion" | "projectName">,
): BrowserBenchmarkSummary {
  const packageMetadata = readPackageMetadata();
  const [primaryCpu] = cpus();

  return {
    ...result,
    metadata: {
      packageName: packageMetadata.name,
      packageVersion: packageMetadata.version,
      node: process.version,
      platform: platform(),
      release: release(),
      arch: arch(),
      cpuModel: primaryCpu?.model ?? "unknown",
      logicalCpuCount: cpus().length,
      totalMemoryBytes: totalmem(),
      browserName: options.browserName,
      browserVersion: options.browserVersion,
      projectName: options.projectName,
      sampleSize: 1,
      runAt: new Date().toISOString(),
    },
  };
}

function expectBrowserBenchmarkSummary(summary: BrowserBenchmarkSummary): void {
  expectBrowserBenchmarkResult(summary);
  expect(summary.metadata.packageName).toBe("solace");
  expect(summary.metadata.packageVersion).toMatch(/^\d+\.\d+\.\d+/);
  expect(summary.metadata.node).toBe(process.version);
  expect(summary.metadata.platform).toBe(platform());
  expect(summary.metadata.release.length).toBeGreaterThan(0);
  expect(summary.metadata.arch.length).toBeGreaterThan(0);
  expect(summary.metadata.cpuModel.length).toBeGreaterThan(0);
  expect(summary.metadata.logicalCpuCount).toBeGreaterThan(0);
  expect(summary.metadata.totalMemoryBytes).toBeGreaterThan(0);
  expect(summary.metadata.browserName).toBe("chromium");
  expect(summary.metadata.browserVersion.length).toBeGreaterThan(0);
  expect(summary.metadata.projectName).toBe("chromium");
  expect(summary.metadata.sampleSize).toBe(1);
  expect(Date.parse(summary.metadata.runAt)).not.toBeNaN();
}

function readPackageMetadata(): PackageMetadata {
  const packageJson = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as Partial<PackageMetadata>;

  if (typeof packageJson.name !== "string" || typeof packageJson.version !== "string") {
    throw new Error("package.json must include string name and version for benchmark metadata");
  }

  return {
    name: packageJson.name,
    version: packageJson.version,
  };
}
```

- [ ] **Step 6: Run the browser benchmark**

Run:

```bash
pnpm benchmark:browser
```

Expected:

- Exits with code 0.
- Output includes `browser benchmark summary:`.
- Summary JSON includes a `metadata` object.

---

### Task 2: Update Documentation

### Task 2: Keep Benchmark Spec Out Of Default E2E

**Files:**

- Modify: `playwright.config.ts`

- [ ] **Step 1: Exclude the benchmark-only spec**

In `playwright.config.ts`, add `testIgnore` next to `testDir`:

```ts
export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: "browser-benchmark.spec.ts",
  webServer: [
```

- [ ] **Step 2: Run default e2e**

Run:

```bash
pnpm test:e2e
```

Expected:

- Exits with code 0.
- Runs the ordinary example specs.
- Does not run `tests/e2e/browser-benchmark.spec.ts`.

---

### Task 3: Update Documentation

**Files:**

- Modify: `docs/performance.md`
- Modify: `readme.md`

- [ ] **Step 1: Update browser benchmark docs**

In `docs/performance.md`, after:

```md
The command logs a `browser benchmark summary` JSON line. It intentionally does not enforce absolute
timing thresholds because browser, CPU, power mode, and background process variance can dominate
individual runs.
```

add:

```md
The summary also includes reproducibility metadata:

| Field                                                                        | Source                                   |
| ---------------------------------------------------------------------------- | ---------------------------------------- |
| `metadata.packageName` / `metadata.packageVersion`                           | `package.json`                           |
| `metadata.node`                                                              | `process.version`                        |
| `metadata.platform`, `metadata.release`, `metadata.arch`                     | Node `os` module                         |
| `metadata.cpuModel`, `metadata.logicalCpuCount`, `metadata.totalMemoryBytes` | Node `os` module                         |
| `metadata.browserName`, `metadata.browserVersion`, `metadata.projectName`    | Playwright                               |
| `metadata.sampleSize`                                                        | Current benchmark harness; currently `1` |
| `metadata.runAt`                                                             | ISO timestamp for the local run          |

`metadata.sampleSize` is currently `1` because the browser benchmark is still a smoke benchmark. Use it
for trend context, not statistical claims.
```

- [ ] **Step 2: Update README next-step wording**

In `readme.md`, under `## 14. 后续建议`, replace:

```md
- 持续记录 jsdom 与 Chromium 生产构建 benchmark 趋势，并补充机器、浏览器和样本量元数据。
```

with:

```md
- 持续记录 jsdom 与 Chromium 生产构建 benchmark 趋势；Chromium browser benchmark 已输出机器、浏览器和样本量元数据，后续可扩展为历史趋势记录。
```

---

### Task 4: Add Project Log

**Files:**

- Add: `solace-project-log/solace-entries/2026-07-14-002-benchmark-metadata.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Add project log entry**

Create `solace-project-log/solace-entries/2026-07-14-002-benchmark-metadata.md` with:

```md
# 2026-07-14-002：补充 browser benchmark 元数据

## 基本信息

- 日期：2026-07-14
- 类型：测试 / 文档
- 状态：验证中
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

为 Chromium production browser benchmark 的 summary JSON 增加 package、Node、OS、CPU、memory、browser、project、sample size 和 run timestamp 元数据。该改动不增加性能阈值，不改变 runtime API，也不保存历史结果。

## 变动原因

性能文档和 README 已将 benchmark 趋势元数据列为后续重点。补充元数据后，本地 benchmark 输出更适合追踪趋势和复现实验环境，同时仍避免做未经验证的性能宣称。

## 影响范围

- 影响模块：Playwright browser benchmark、性能文档、README、项目日志。
- 行为变化：`pnpm benchmark:browser` 输出的 `browser benchmark summary` JSON 增加 `metadata` 字段。
- 风险等级：低；仅影响测试输出和文档，不修改 runtime。

## 涉及文件

| 文件                                                                     | 动作 | 说明                                  |
| ------------------------------------------------------------------------ | ---- | ------------------------------------- |
| `tests/e2e/browser-benchmark.spec.ts`                                    | 修改 | 增加 browser benchmark metadata 输出  |
| `playwright.config.ts`                                                   | 修改 | 默认 e2e 排除 benchmark 专用 spec     |
| `docs/performance.md`                                                    | 修改 | 记录 metadata 字段与 sample size 语义 |
| `readme.md`                                                              | 修改 | 更新后续 benchmark 建议               |
| `docs/superpowers/specs/2026-07-14-benchmark-metadata-design.md`         | 新增 | 记录设计                              |
| `docs/superpowers/plans/2026-07-14-benchmark-metadata.md`                | 新增 | 记录实施计划                          |
| `solace-project-log/index.md`                                            | 修改 | 追加本次日志索引                      |
| `solace-project-log/solace-entries/2026-07-14-002-benchmark-metadata.md` | 新增 | 记录本次变更                          |

## 验证记录

| 验证项            | 命令或方式               | 结果   |
| ----------------- | ------------------------ | ------ |
| Browser benchmark | `pnpm benchmark:browser` | 待执行 |
| Tests             | `pnpm test`              | 待执行 |
| E2E               | `pnpm test:e2e`          | 待执行 |
| Typecheck         | `pnpm typecheck`         | 待执行 |
| Lint              | `pnpm lint`              | 待执行 |
| 格式检查          | `pnpm format:check`      | 待执行 |

## 后续动作

- 后续可评估 jsdom Tinybench 自定义 reporter 或历史结果文件，但本次不引入。
```

- [ ] **Step 2: Add project log index row**

In `solace-project-log/index.md`, add this row under the existing `2026-07-14` table:

```md
| 002 | 补充 benchmark 元数据 | browser benchmark、e2e 配置、性能文档、README | `tests/e2e/browser-benchmark.spec.ts`, `playwright.config.ts`, `docs/performance.md`, `readme.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-14-002-benchmark-metadata.md) |
```

---

### Task 5: Format And Validate

**Files:**

- Modify after validation: `solace-project-log/solace-entries/2026-07-14-002-benchmark-metadata.md`
- Modify if formatting changes are needed: all touched files

- [ ] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write tests/e2e/browser-benchmark.spec.ts playwright.config.ts docs/performance.md readme.md docs/superpowers/specs/2026-07-14-benchmark-metadata-design.md docs/superpowers/plans/2026-07-14-benchmark-metadata.md solace-project-log/solace-entries/2026-07-14-002-benchmark-metadata.md solace-project-log/index.md
```

Expected: Prettier exits with code 0.

- [ ] **Step 2: Run browser benchmark**

Run:

```bash
pnpm benchmark:browser
```

Expected: exits with code 0 and logs `browser benchmark summary:` containing `metadata`.

- [ ] **Step 3: Run typecheck**

- [ ] **Step 3: Run tests**

Run:

```bash
pnpm test
```

Expected: exits with code 0.

- [ ] **Step 4: Run e2e**

Run:

```bash
pnpm test:e2e
```

Expected: exits with code 0 and runs the ordinary example specs only.

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: exits with code 0.

- [ ] **Step 6: Run lint**

Run:

```bash
pnpm lint
```

Expected: exits with code 0.

- [ ] **Step 7: Run format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0 and reports all matched files use Prettier code style.

- [ ] **Step 8: Update project log validation table**

In `solace-project-log/solace-entries/2026-07-14-002-benchmark-metadata.md`, replace `状态：验证中` with `状态：已完成`, and replace each `待执行` result with the observed validation result.

- [ ] **Step 9: Run final format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0 and reports all matched files use Prettier code style.
