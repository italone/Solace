# Jsdom Benchmark Metrics History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist task-level jsdom Tinybench metrics in local benchmark history and summarize those metrics with `pnpm benchmark:history`.

**Architecture:** Add a shared benchmark metrics helper under `tests/performance/` that replaces duplicated `report(bench)` functions. The helper prints the existing human-readable report and, when an internal runner-provided environment variable is set, appends structured per-task metrics to a temporary JSONL artifact. `scripts/run-benchmark.mjs` owns that artifact path when history recording is enabled, reads it after all benchmark samples pass, and stores the collected tasks on the jsdom history record; `scripts/summarize-benchmark-history.mjs` summarizes jsdom task metrics without changing browser summary behavior.

**Tech Stack:** Node.js ESM scripts, TypeScript benchmark tests, Vitest, Tinybench, jsdom, pnpm, Prettier.

---

## File Structure

- Create `tests/performance/benchmark-report.ts`: shared helper for printing Tinybench task reports and optionally recording structured task metrics to a runner-controlled artifact.
- Modify `tests/performance/*.bench.ts`: replace local duplicated `report(bench)` helpers with `reportBenchmark(bench, import.meta.url)`.
- Modify `scripts/run-benchmark.mjs`: create/read/remove a temporary metrics artifact when `SOLACE_BENCHMARK_HISTORY_PATH` is configured and include `summary.tasks` in jsdom history records.
- Modify `scripts/summarize-benchmark-history.mjs`: group jsdom metric summaries by task and metric while preserving old jsdom metadata-only records.
- Modify `tests/unit/scripts/run-benchmark.test.ts`: cover history records with `summary.tasks` and invalid metrics artifact behavior.
- Modify `tests/unit/scripts/benchmark-history-summary.test.ts`: cover jsdom task metric summaries plus old-record compatibility.
- Modify `docs/performance.md`: document that jsdom history now persists task-level metrics.
- Add `solace-project-log/solace-entries/2026-07-17-020-jsdom-benchmark-metrics-history.md`: implementation log.
- Modify `solace-project-log/index.md`: add rows for plan `019` and implementation `020`.

Do not modify runtime source, public package exports, Rollup config, DevTools public APIs, or `package.json` unless a validation failure proves it is necessary.

---

### Task 1: Add RED Tests For Jsdom Task Metric Summaries

**Files:**

- Modify: `tests/unit/scripts/benchmark-history-summary.test.ts`

- [ ] **Step 1: Add a richer jsdom history summary type**

In `tests/unit/scripts/benchmark-history-summary.test.ts`, replace the `BenchmarkHistorySummary` type with:

```ts
type BenchmarkHistorySummary = {
  recordCount: number;
  groups: Array<{
    kind: string;
    scenario?: string;
    environment?: string;
    task?: string;
    recordCount: number;
    metrics: Record<string, { count: number; median: number; p95: number; variance: number }>;
  }>;
};
```

- [ ] **Step 2: Add a jsdom metric summary test**

Add this test after `summarizes browser timing metrics and jsdom record counts`:

```ts
test("summarizes jsdom task timing metrics", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "solace-history-summary-jsdom-metrics-"));
  const historyPath = join(tempDir, "history.jsonl");
  await writeFile(
    historyPath,
    [
      JSON.stringify(
        createJsdomRecord({
          tasks: [
            {
              name: "10000 row local text update",
              file: "tests/performance/list-diff.bench.ts",
              metrics: {
                latencyMeanMs: 4,
                latencyP99Ms: 6,
                throughputMeanOpsPerSec: 250,
              },
            },
          ],
        }),
      ),
      JSON.stringify(
        createJsdomRecord({
          tasks: [
            {
              name: "10000 row local text update",
              file: "tests/performance/list-diff.bench.ts",
              metrics: {
                latencyMeanMs: 8,
                latencyP99Ms: 10,
                throughputMeanOpsPerSec: 125,
              },
            },
          ],
        }),
      ),
      "",
    ].join("\n"),
    "utf8",
  );

  const { stdout } = await execFileAsync("node", [
    "scripts/summarize-benchmark-history.mjs",
    "--json",
    historyPath,
  ]);
  const summary = JSON.parse(stdout) as BenchmarkHistorySummary;
  const jsdomTaskGroup = summary.groups.find(
    (group) => group.kind === "jsdom-benchmark" && group.task === "10000 row local text update",
  );

  expect(summary.recordCount).toBe(2);
  expect(jsdomTaskGroup).toMatchObject({
    environment: "jsdom",
    task: "10000 row local text update",
    recordCount: 2,
  });
  expect(jsdomTaskGroup?.metrics.latencyMeanMs).toEqual({
    count: 2,
    median: 6,
    p95: 8,
    variance: 4,
  });
  expect(jsdomTaskGroup?.metrics.latencyP99Ms).toMatchObject({
    count: 2,
    median: 8,
    p95: 10,
  });
  expect(jsdomTaskGroup?.metrics.throughputMeanOpsPerSec).toMatchObject({
    count: 2,
    median: 187.5,
    p95: 250,
  });
});
```

- [ ] **Step 3: Update `createJsdomRecord()` to support tasks**

Replace the current `createJsdomRecord()` helper with:

```ts
function createJsdomRecord(options?: {
  tasks?: Array<{
    name: string;
    file: string;
    metrics: Record<string, number>;
  }>;
}) {
  return {
    kind: "jsdom-benchmark",
    status: "passed",
    sampleCount: 1,
    metadata: {
      benchmarkEnvironment: "jsdom",
      sampleSize: 1,
    },
    command: "pnpm",
    args: ["exec", "vitest", "run", "--config", "vitest.benchmark.config.ts"],
    ...(options?.tasks === undefined ? {} : { summary: { tasks: options.tasks } }),
  };
}
```

- [ ] **Step 4: Run the summary test to verify RED**

Run:

```bash
pnpm vitest run tests/unit/scripts/benchmark-history-summary.test.ts
```

Expected: fails because jsdom task metrics are not summarized yet. Acceptable failure shape is `expected undefined to match object` for `jsdomTaskGroup`.

---

### Task 2: Add RED Tests For Runner History Records With Metrics

**Files:**

- Modify: `tests/unit/scripts/run-benchmark.test.ts`

- [ ] **Step 1: Extend the benchmark runner record type**

In `tests/unit/scripts/run-benchmark.test.ts`, replace the local parsed `record` type in `appends a benchmark history record after successful samples` with:

```ts
const record = JSON.parse(line) as {
  kind: string;
  status: string;
  metadata: { benchmarkEnvironment: string; sampleSize: number };
  sampleCount: number;
  command: string;
  args: string[];
  summary?: {
    tasks?: Array<{
      name: string;
      file: string;
      metrics: Record<string, number>;
    }>;
  };
};
```

- [ ] **Step 2: Assert the record includes task metrics**

After `expect(record.metadata.sampleSize).toBe(1);`, add:

```ts
expect(record.summary?.tasks?.length).toBeGreaterThan(0);
expect(record.summary?.tasks?.[0]).toMatchObject({
  name: expect.any(String),
  file: expect.stringMatching(/^tests\/performance\/.+\.bench\.ts$/),
  metrics: {
    latencyMeanMs: expect.any(Number),
    latencyP99Ms: expect.any(Number),
    throughputMeanOpsPerSec: expect.any(Number),
  },
});
```

- [ ] **Step 3: Run the runner test to verify RED**

Run:

```bash
pnpm vitest run tests/unit/scripts/run-benchmark.test.ts
```

Expected: fails because current history records do not include `summary.tasks`.

---

### Task 3: Implement Shared Benchmark Reporting And Metrics Artifact

**Files:**

- Create: `tests/performance/benchmark-report.ts`
- Modify: all files under `tests/performance/*.bench.ts`

- [ ] **Step 1: Create the shared report helper**

Create `tests/performance/benchmark-report.ts`:

```ts
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

import type { Bench } from "tinybench";

type BenchmarkTaskMetricRecord = {
  name: string;
  file: string;
  metrics: Record<string, number>;
};

const metricsPath = process.env.SOLACE_BENCHMARK_METRICS_PATH;
const root = process.cwd();

export function reportBenchmark(bench: Bench, fileUrl: string): void {
  const file = normalizeFilePath(fileUrl);

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

    appendMetricRecord({
      name: task.name,
      file,
      metrics: {
        latencyMeanMs: latency.mean,
        latencyP99Ms: latency.p99,
        throughputMeanOpsPerSec: throughput.mean,
      },
    });
  }
}

function appendMetricRecord(record: BenchmarkTaskMetricRecord): void {
  if (metricsPath === undefined) {
    return;
  }

  mkdirSync(dirname(metricsPath), { recursive: true });
  appendFileSync(metricsPath, `${JSON.stringify(record)}\n`, "utf8");
}

function normalizeFilePath(fileUrl: string): string {
  return relative(root, fileURLToPath(fileUrl)).replaceAll("\\", "/");
}
```

- [ ] **Step 2: Replace duplicated report helpers**

In each file below, remove the local `function report(bench: Bench): void { ... }`, keep the `Bench` import for construction, and add:

```ts
import { reportBenchmark } from "./benchmark-report";
```

Then replace:

```ts
report(bench);
```

with:

```ts
reportBenchmark(bench, import.meta.url);
```

Files:

- `tests/performance/render.bench.ts`
- `tests/performance/list-diff.bench.ts`
- `tests/performance/fragment.bench.ts`
- `tests/performance/component-update.bench.ts`
- `tests/performance/memory.bench.ts`

- [ ] **Step 3: Run benchmark tests to verify helper compiles**

Run:

```bash
pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/render.bench.ts
```

Expected: exits with code 0.

---

### Task 4: Include Metrics Artifact In Jsdom History Records

**Files:**

- Modify: `scripts/run-benchmark.mjs`

- [ ] **Step 1: Import temporary filesystem helpers**

In `scripts/run-benchmark.mjs`, replace:

```js
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
```

with:

```js
import { appendFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
```

- [ ] **Step 2: Create metrics artifact only when history is enabled**

In `main()`, after `const metadata = await createBenchmarkMetadata(plan.sampleSize);`, add:

```js
const metricsPath = plan.historyPath === undefined ? undefined : await createBenchmarkMetricsPath();
```

- [ ] **Step 3: Pass metrics path to child process**

Replace:

```js
await runCommand(plan.command, plan.args);
```

with:

```js
await runCommand(plan.command, plan.args, { metricsPath });
```

- [ ] **Step 4: Read metrics before appending history**

Replace the current `appendBenchmarkHistory()` call in `main()`:

```js
await appendBenchmarkHistory(plan.historyPath, {
  kind: "jsdom-benchmark",
  status: "passed",
  metadata,
  sampleCount: plan.sampleSize,
  command: plan.command,
  args: plan.args,
});
```

with:

```js
const tasks = metricsPath === undefined ? [] : await readBenchmarkMetrics(metricsPath);
await appendBenchmarkHistory(plan.historyPath, {
  kind: "jsdom-benchmark",
  status: "passed",
  metadata,
  sampleCount: plan.sampleSize,
  command: plan.command,
  args: plan.args,
  ...(tasks.length === 0 ? {} : { summary: { tasks } }),
});
```

- [ ] **Step 5: Clean up metrics artifact**

After the `if (plan.historyPath !== undefined) { ... }` block in `main()`, add:

```js
if (metricsPath !== undefined) {
  await rm(dirname(metricsPath), { recursive: true, force: true });
}
```

- [ ] **Step 6: Add metrics helper functions**

Add these functions before `appendBenchmarkHistory()`:

```js
async function createBenchmarkMetricsPath() {
  const directory = await mkdtemp(join(tmpdir(), "solace-benchmark-metrics-"));
  return join(directory, "metrics.jsonl");
}

async function readBenchmarkMetrics(metricsPath) {
  const content = await readFile(metricsPath, "utf8");
  const records = [];

  content.split(/\r?\n/).forEach((line, index) => {
    if (line.trim() === "") {
      return;
    }

    try {
      records.push(JSON.parse(line));
    } catch {
      throw new Error(`Invalid benchmark metrics JSON at ${metricsPath}:${index + 1}`);
    }
  });

  return records;
}
```

- [ ] **Step 7: Update `runCommand()` to inject env**

Replace:

```js
function runCommand(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
    });
```

with:

```js
function runCommand(command, args, { metricsPath } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        ...(metricsPath === undefined ? {} : { SOLACE_BENCHMARK_METRICS_PATH: metricsPath }),
      },
    });
```

- [ ] **Step 8: Run runner test to verify GREEN**

Run:

```bash
pnpm vitest run tests/unit/scripts/run-benchmark.test.ts
```

Expected: exits with code 0.

---

### Task 5: Summarize Jsdom Task Metrics

**Files:**

- Modify: `scripts/summarize-benchmark-history.mjs`

- [ ] **Step 1: Route jsdom task metrics into groups**

Replace `collectMetricValues(group.metricValues, record);` inside `createSummaryGroups()` with:

```js
collectMetricValues(group.metricValues, record, groupKey);
```

- [ ] **Step 2: Expand group keys for jsdom tasks**

Replace the jsdom branch in `getGroupKey(record)` with:

```js
if (
  record?.kind === "jsdom-benchmark" &&
  typeof record.metadata?.benchmarkEnvironment === "string"
) {
  return {
    key: `jsdom-benchmark:${record.metadata.benchmarkEnvironment}`,
    kind: "jsdom-benchmark",
    environment: record.metadata.benchmarkEnvironment,
  };
}
```

Then add this helper after `getGroupKey(record)`:

```js
function getJsdomTaskGroupKeys(record) {
  if (
    record?.kind !== "jsdom-benchmark" ||
    typeof record.metadata?.benchmarkEnvironment !== "string" ||
    !Array.isArray(record.summary?.tasks)
  ) {
    return [];
  }

  return record.summary.tasks
    .filter((task) => typeof task?.name === "string")
    .map((task) => ({
      key: `jsdom-benchmark:${record.metadata.benchmarkEnvironment}:${task.name}`,
      kind: "jsdom-benchmark",
      environment: record.metadata.benchmarkEnvironment,
      task: task.name,
      taskRecord: task,
    }));
}
```

- [ ] **Step 3: Include task groups while keeping old environment group**

In `createSummaryGroups(records)`, after the existing per-record group creation block, add:

```js
for (const taskGroupKey of getJsdomTaskGroupKeys(record)) {
  const taskGroup = groups.get(taskGroupKey.key) ?? {
    kind: taskGroupKey.kind,
    environment: taskGroupKey.environment,
    task: taskGroupKey.task,
    recordCount: 0,
    metrics: {},
    metricValues: new Map(),
  };

  taskGroup.recordCount += 1;
  collectJsdomTaskMetricValues(taskGroup.metricValues, taskGroupKey.taskRecord);
  groups.set(taskGroupKey.key, taskGroup);
}
```

- [ ] **Step 4: Preserve task in summary output**

In the return object from `createSummaryGroups()`, add:

```js
      ...(group.task === undefined ? {} : { task: group.task }),
```

next to the existing `scenario` and `environment` spreads.

- [ ] **Step 5: Update `collectMetricValues()` signature and add jsdom collector**

Replace:

```js
function collectMetricValues(metricValues, record) {
  if (record?.kind !== "browser-benchmark") {
    return;
  }
```

with:

```js
function collectMetricValues(metricValues, record, groupKey) {
  if (groupKey?.kind !== "browser-benchmark" || record?.kind !== "browser-benchmark") {
    return;
  }
```

Then add:

```js
function collectJsdomTaskMetricValues(metricValues, task) {
  if (task === undefined || typeof task !== "object" || task.metrics === undefined) {
    return;
  }

  for (const [metric, value] of Object.entries(task.metrics)) {
    if (!Number.isFinite(value)) {
      continue;
    }

    const values = metricValues.get(metric) ?? [];
    values.push(value);
    metricValues.set(metric, values);
  }
}
```

- [ ] **Step 6: Run history summary test to verify GREEN**

Run:

```bash
pnpm vitest run tests/unit/scripts/benchmark-history-summary.test.ts
```

Expected: exits with code 0.

---

### Task 6: Update Docs And Implementation Log

**Files:**

- Modify: `docs/performance.md`
- Add: `solace-project-log/solace-entries/2026-07-17-020-jsdom-benchmark-metrics-history.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update performance docs**

In `docs/performance.md`, replace:

```md
The local ignored jsdom history currently contains two records. The latest record was created with
`SOLACE_BENCHMARK_SAMPLE_SIZE=3`; all five jsdom benchmark files passed in each sample. The history
summary reports jsdom record counts only because Tinybench timing aggregation is not yet persisted.
```

with:

```md
The local ignored jsdom history currently contains records with task-level Tinybench metrics when created by the current
benchmark runner. `pnpm benchmark:history -- --json` summarizes those jsdom task metrics with count, median, p95, and
variance while still accepting older metadata-only records.
```

- [ ] **Step 2: Add implementation log**

Create `solace-project-log/solace-entries/2026-07-17-020-jsdom-benchmark-metrics-history.md`:

```md
# 2026-07-17-020：持久化 jsdom benchmark task metrics

## 基本信息

- 日期：2026-07-17
- 类型：benchmark tooling / script tests / performance docs / project log
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

为 jsdom benchmark history 增加 task-level Tinybench metrics 持久化，并让 `pnpm benchmark:history` 可以按 jsdom task 汇总 median、p95 和 variance。

## 变动原因

browser history 已能汇总 timing metrics，但 jsdom history 之前只记录 metadata/status。补齐 jsdom task metrics 后，后续 renderer、Fragment 和 component 性能优化能获得更细的场景级趋势证据。

## 影响范围

- 影响模块：benchmark runner、benchmark history summarizer、performance benchmark tests、脚本单元测试、性能文档、项目日志。
- 行为变化：无 runtime public API 变化；`pnpm benchmark` 默认仍可运行，配置 history path 时会附带 `summary.tasks`。
- 风险等级：中；涉及 Node tooling、子进程 env、临时文件和 history JSONL 兼容性。

## 涉及文件

| 文件                                                                                  | 动作 | 说明                                   |
| ------------------------------------------------------------------------------------- | ---- | -------------------------------------- |
| `tests/performance/benchmark-report.ts`                                               | 新增 | 统一 Tinybench report 和 metrics 写出  |
| `tests/performance/*.bench.ts`                                                        | 修改 | 复用共享 benchmark report helper       |
| `scripts/run-benchmark.mjs`                                                           | 修改 | history 记录附带 jsdom task metrics    |
| `scripts/summarize-benchmark-history.mjs`                                             | 修改 | 汇总 jsdom task metrics                |
| `tests/unit/scripts/run-benchmark.test.ts`                                            | 修改 | 覆盖 history record 中的 summary.tasks |
| `tests/unit/scripts/benchmark-history-summary.test.ts`                                | 修改 | 覆盖 jsdom task metric summary         |
| `docs/performance.md`                                                                 | 修改 | 更新 jsdom history metrics 说明        |
| `solace-project-log/solace-entries/2026-07-17-020-jsdom-benchmark-metrics-history.md` | 新增 | 记录本次变更                           |
| `solace-project-log/index.md`                                                         | 修改 | 追加 2026-07-17 日志索引               |

## 验证记录

| 验证项              | 命令或方式                                                                                                      | 结果       |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | ---------- |
| History summary RED | `pnpm vitest run tests/unit/scripts/benchmark-history-summary.test.ts`                                          | 待最终验证 |
| Runner RED          | `pnpm vitest run tests/unit/scripts/run-benchmark.test.ts`                                                      | 待最终验证 |
| Script tests        | `pnpm vitest run tests/unit/scripts/run-benchmark.test.ts tests/unit/scripts/benchmark-history-summary.test.ts` | 待最终验证 |
| Benchmark smoke     | `pnpm benchmark`                                                                                                | 待最终验证 |
| Benchmark history   | `pnpm benchmark:history -- --json`                                                                              | 待最终验证 |
| Tests               | `pnpm test`                                                                                                     | 待最终验证 |
| Typecheck           | `pnpm typecheck`                                                                                                | 待最终验证 |
| Lint                | `pnpm lint`                                                                                                     | 待最终验证 |
| Build               | `pnpm build`                                                                                                    | 待最终验证 |
| 格式检查            | `pnpm format:check`                                                                                             | 待最终验证 |
| Diff whitespace     | `git diff --check`                                                                                              | 待最终验证 |
| Private boundary    | `package.json`                                                                                                  | 待最终验证 |

## 后续动作

- 后续可基于 jsdom task metrics 选择下一轮 renderer/Fragment/component 性能切片；仍不要加入绝对 timing threshold。
```

- [ ] **Step 3: Add project log rows**

Add implementation row `020` under `2026-07-17` in `solace-project-log/index.md`:

```md
| 020 | 持久化 jsdom benchmark task metrics | benchmark tooling、script tests、performance docs、项目日志 | `scripts/**`, `tests/performance/**`, `tests/unit/scripts/**`, `docs/performance.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-17-020-jsdom-benchmark-metrics-history.md) |
```

---

### Task 7: Validate And Commit

**Files:**

- All changed files

- [ ] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write scripts/run-benchmark.mjs scripts/summarize-benchmark-history.mjs tests/performance/*.bench.ts tests/performance/benchmark-report.ts tests/unit/scripts/run-benchmark.test.ts tests/unit/scripts/benchmark-history-summary.test.ts docs/performance.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-17-020-jsdom-benchmark-metrics-history.md
```

Expected: exits with code 0.

- [ ] **Step 2: Run focused script tests**

Run:

```bash
pnpm vitest run tests/unit/scripts/run-benchmark.test.ts tests/unit/scripts/benchmark-history-summary.test.ts
```

Expected: exits with code 0.

- [ ] **Step 3: Run benchmark smoke and history summary**

Run:

```bash
pnpm benchmark
pnpm benchmark:history -- --json
```

Expected: both commands exit with code 0. `pnpm benchmark:history -- --json` should include jsdom task groups when local ignored history contains a new metrics record.

- [ ] **Step 4: Run full quality checks**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
git diff --check
```

Expected: every command exits with code 0.

- [ ] **Step 5: Skip package checks unless package boundaries changed**

If `package.json`, `rollup.config.mjs`, package exports tests, `src/devtools/index.ts`, or public entry points changed, run:

```bash
pnpm test:package
pnpm package:smoke
```

Expected: both commands exit with code 0.

If none of those files changed, skip this step and record that package checks were not required because public package boundaries were unchanged.

- [ ] **Step 6: Update implementation log validation table**

Replace each `待最终验证` in `solace-project-log/solace-entries/2026-07-17-020-jsdom-benchmark-metrics-history.md` with observed results.

- [ ] **Step 7: Commit**

Run:

```bash
git status --short --branch
git add scripts/run-benchmark.mjs scripts/summarize-benchmark-history.mjs tests/performance/benchmark-report.ts tests/performance/*.bench.ts tests/unit/scripts/run-benchmark.test.ts tests/unit/scripts/benchmark-history-summary.test.ts docs/performance.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-17-020-jsdom-benchmark-metrics-history.md docs/superpowers/specs/2026-07-17-jsdom-benchmark-metrics-history-design.md
git commit -m "feat: persist jsdom benchmark metrics"
```

Expected: commit succeeds. Do not push.
