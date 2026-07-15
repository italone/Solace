# jsdom Benchmark Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Print reproducibility metadata for `pnpm benchmark` before running the jsdom Tinybench smoke suite.

**Architecture:** Add a small ESM Node CLI under `scripts/` that reads local package metadata and OS/runtime facts, then prints a stable JSON payload. Wire `package.json` so `pnpm benchmark` prints metadata before invoking the existing Vitest benchmark config.

**Tech Stack:** Node.js ESM, `node:fs/promises`, `node:os`, `node:path`, `node:url`, Vitest, pnpm package scripts, Markdown docs, Prettier.

---

## File Structure

- Create `scripts/benchmark-metadata.mjs`: CLI and metadata builder for jsdom benchmark runs.
- Add `tests/unit/scripts/benchmark-metadata.test.ts`: TDD coverage for the CLI JSON output.
- Modify `package.json`: prepend metadata output to the `benchmark` script.
- Modify `docs/performance.md`: document jsdom benchmark metadata fields.
- Modify `readme.md`: update benchmark next-step wording.
- Add `solace-project-log/solace-entries/2026-07-14-003-jsdom-benchmark-metadata.md`: project log entry.
- Modify `solace-project-log/index.md`: add the 2026-07-14 `003` row.

No runtime source, package exports, benchmark scenario files, or browser benchmark files should change.

---

### Task 1: Add Failing CLI Test

**Files:**

- Add: `tests/unit/scripts/benchmark-metadata.test.ts`

- [ ] **Step 1: Create the test**

Create `tests/unit/scripts/benchmark-metadata.test.ts` with:

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);

type BenchmarkMetadata = {
  packageName: string;
  packageVersion: string;
  node: string;
  platform: string;
  release: string;
  arch: string;
  runtime: string;
  cpuModel: string;
  logicalCpuCount: number;
  totalMemoryBytes: number;
  benchmarkRunner: string;
  benchmarkEnvironment: string;
  sampleSize: number;
  runAt: string;
};

describe("benchmark metadata CLI", () => {
  test("prints machine and runtime metadata as JSON", async () => {
    const { stdout } = await execFileAsync("node", ["scripts/benchmark-metadata.mjs", "--json"]);
    const metadata = JSON.parse(stdout) as BenchmarkMetadata;

    expect(metadata.packageName).toBe("solace");
    expect(metadata.packageVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(metadata.node).toBe(process.version);
    expect(metadata.platform.length).toBeGreaterThan(0);
    expect(metadata.release.length).toBeGreaterThan(0);
    expect(metadata.arch.length).toBeGreaterThan(0);
    expect(metadata.runtime).toContain(metadata.platform);
    expect(metadata.cpuModel.length).toBeGreaterThan(0);
    expect(metadata.logicalCpuCount).toBeGreaterThan(0);
    expect(metadata.totalMemoryBytes).toBeGreaterThan(0);
    expect(metadata.benchmarkRunner).toBe("vitest");
    expect(metadata.benchmarkEnvironment).toBe("jsdom");
    expect(metadata.sampleSize).toBe(1);
    expect(Date.parse(metadata.runAt)).not.toBeNaN();
  });
});
```

- [ ] **Step 2: Verify the test fails before implementation**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/benchmark-metadata.test.ts
```

Expected:

- Exits with non-zero code.
- Failure is caused by missing `scripts/benchmark-metadata.mjs`.

---

### Task 2: Implement Benchmark Metadata CLI

**Files:**

- Add: `scripts/benchmark-metadata.mjs`

- [ ] **Step 1: Create the script**

Create `scripts/benchmark-metadata.mjs` with:

```js
import { readFile } from "node:fs/promises";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const jsonOnly = process.argv.includes("--json");

const metadata = await createBenchmarkMetadata();
const payload = JSON.stringify(metadata);

if (jsonOnly) {
  console.log(payload);
} else {
  console.log(`benchmark metadata: ${payload}`);
}

async function createBenchmarkMetadata() {
  const packageJson = await readPackageJson();
  const cpuList = cpus();
  const [primaryCpu] = cpuList;
  const currentPlatform = platform();
  const currentArch = arch();

  return {
    packageName: packageJson.name,
    packageVersion: packageJson.version,
    node: process.version,
    platform: currentPlatform,
    release: release(),
    arch: currentArch,
    runtime: `${currentPlatform} ${currentArch}`,
    cpuModel: primaryCpu?.model ?? "unknown",
    logicalCpuCount: cpuList.length,
    totalMemoryBytes: totalmem(),
    benchmarkRunner: "vitest",
    benchmarkEnvironment: "jsdom",
    sampleSize: 1,
    runAt: new Date().toISOString(),
  };
}

async function readPackageJson() {
  const raw = await readFile(resolve(root, "package.json"), "utf8");
  const packageJson = JSON.parse(raw);

  if (typeof packageJson.name !== "string" || typeof packageJson.version !== "string") {
    throw new Error("package.json must include string name and version for benchmark metadata");
  }

  return {
    name: packageJson.name,
    version: packageJson.version,
  };
}
```

- [ ] **Step 2: Run targeted test**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/benchmark-metadata.test.ts
```

Expected: exits with code 0.

- [ ] **Step 3: Run CLI directly**

Run:

```bash
node scripts/benchmark-metadata.mjs
```

Expected:

- Exits with code 0.
- Output starts with `benchmark metadata:`.

---

### Task 3: Wire Package Script

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Update the benchmark script**

In `package.json`, replace:

```json
"benchmark": "vitest run --config vitest.benchmark.config.ts",
```

with:

```json
"benchmark": "node scripts/benchmark-metadata.mjs && vitest run --config vitest.benchmark.config.ts",
```

- [ ] **Step 2: Run benchmark command**

Run:

```bash
pnpm benchmark
```

Expected:

- Exits with code 0.
- Output includes `benchmark metadata:`.
- Vitest benchmark suite passes.

---

### Task 4: Update Documentation And Log

**Files:**

- Modify: `docs/performance.md`
- Modify: `readme.md`
- Add: `solace-project-log/solace-entries/2026-07-14-003-jsdom-benchmark-metadata.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update performance docs**

In `docs/performance.md`, after the `pnpm benchmark` command block in "Latest Local Benchmark Run", add:

```md
The command logs a `benchmark metadata` JSON line before running the jsdom benchmark suite. The metadata includes package name/version, Node version, OS platform/release/architecture, CPU model, logical CPU count, total memory, benchmark runner, benchmark environment, sample size, and an ISO timestamp.

`sampleSize` is currently `1` because the jsdom benchmark command remains a smoke benchmark run. Individual Tinybench tasks may perform internal iterations, but this command does not yet aggregate repeated independent runs.
```

Then replace the Environment table `CPU / memory` row:

```md
| CPU / memory | Not recorded |
```

with:

```md
| CPU / memory | Recorded by `benchmark metadata` output |
```

- [ ] **Step 2: Update README next-step wording**

In `readme.md`, under `## 14. 后续建议`, replace:

```md
- 持续记录 jsdom 与 Chromium 生产构建 benchmark 趋势；Chromium browser benchmark 已输出机器、浏览器和样本量元数据，后续可扩展为历史趋势记录。
```

with:

```md
- 持续记录 jsdom 与 Chromium 生产构建 benchmark 趋势；两个 benchmark 命令已输出机器、运行时和样本量元数据，后续可扩展为历史趋势记录。
```

- [ ] **Step 3: Add project log entry**

Create `solace-project-log/solace-entries/2026-07-14-003-jsdom-benchmark-metadata.md` with a log entry documenting the script, package script, docs, tests, and validation status as `验证中`.

- [ ] **Step 4: Add log index row**

In `solace-project-log/index.md`, add a `003` row under `2026-07-14` for jsdom benchmark metadata.

---

### Task 5: Format And Validate

**Files:**

- All touched files.

- [ ] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write scripts/benchmark-metadata.mjs tests/unit/scripts/benchmark-metadata.test.ts package.json docs/performance.md readme.md docs/superpowers/specs/2026-07-14-jsdom-benchmark-metadata-design.md docs/superpowers/plans/2026-07-14-jsdom-benchmark-metadata.md solace-project-log/solace-entries/2026-07-14-003-jsdom-benchmark-metadata.md solace-project-log/index.md
```

Expected: exits with code 0.

- [ ] **Step 2: Run targeted test**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/benchmark-metadata.test.ts
```

Expected: exits with code 0.

- [ ] **Step 3: Run benchmark**

Run:

```bash
pnpm benchmark
```

Expected: exits with code 0 and prints `benchmark metadata:`.

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: exits with code 0.

- [ ] **Step 5: Run lint**

Run:

```bash
pnpm lint
```

Expected: exits with code 0.

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm test
```

Expected: exits with code 0.

- [ ] **Step 7: Run format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.

- [ ] **Step 8: Update project log validation table**

Change the log entry status to `已完成` and replace pending validation rows with observed results.

- [ ] **Step 9: Run final format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.
