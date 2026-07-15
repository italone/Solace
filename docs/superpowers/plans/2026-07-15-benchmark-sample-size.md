# Benchmark Sample Size Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make jsdom benchmark sample size configurable while keeping the default benchmark command fast.

**Architecture:** Add a Node benchmark runner that prints metadata once and runs the Vitest benchmark config once per configured sample. Keep the default `sampleSize` at `1`, read `SOLACE_BENCHMARK_SAMPLE_SIZE` for opt-in repeated runs, and test the runner through a dry-run JSON mode.

**Tech Stack:** Node ESM scripts, pnpm, Vitest, TypeScript tests, Markdown, Prettier.

---

## File Structure

- Modify `scripts/benchmark-metadata.mjs`: parse `--sample-size <n>` and `SOLACE_BENCHMARK_SAMPLE_SIZE`.
- Create `scripts/run-benchmark.mjs`: benchmark runner wrapper with dry-run support.
- Modify `tests/unit/scripts/benchmark-metadata.test.ts`: cover explicit metadata sample size.
- Create `tests/unit/scripts/run-benchmark.test.ts`: cover runner dry-run and invalid env handling.
- Modify `package.json`: change `benchmark` script to `node scripts/run-benchmark.mjs`.
- Modify `docs/performance.md`: document configurable sample size.
- Add `solace-project-log/solace-entries/2026-07-15-007-benchmark-sample-size.md`: record change and validation.
- Modify `solace-project-log/index.md`: add the 2026-07-15 `007` row.

No runtime framework source, package exports, browser benchmark harness, or benchmark threshold should change.

---

### Task 1: Add Failing Tests

**Files:**

- Modify: `tests/unit/scripts/benchmark-metadata.test.ts`
- Create: `tests/unit/scripts/run-benchmark.test.ts`

- [x] **Step 1: Add explicit metadata sample-size test**

In `tests/unit/scripts/benchmark-metadata.test.ts`, add:

```ts
test("prints an explicit benchmark sample size", async () => {
  const { stdout } = await execFileAsync("node", [
    "scripts/benchmark-metadata.mjs",
    "--json",
    "--sample-size",
    "3",
  ]);
  const metadata = JSON.parse(stdout) as BenchmarkMetadata;

  expect(metadata.sampleSize).toBe(3);
});
```

- [x] **Step 2: Add runner dry-run tests**

Create `tests/unit/scripts/run-benchmark.test.ts`:

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);

type BenchmarkRunPlan = {
  command: string;
  args: string[];
  sampleSize: number;
};

describe("benchmark runner CLI", () => {
  test("prints a dry-run plan with the default sample size", async () => {
    const { stdout } = await execFileAsync("node", [
      "scripts/run-benchmark.mjs",
      "--dry-run",
      "--json",
    ]);
    const plan = JSON.parse(stdout) as BenchmarkRunPlan;

    expect(plan).toEqual({
      command: "pnpm",
      args: ["exec", "vitest", "run", "--config", "vitest.benchmark.config.ts"],
      sampleSize: 1,
    });
  });

  test("prints a dry-run plan with the configured sample size", async () => {
    const { stdout } = await execFileAsync(
      "node",
      ["scripts/run-benchmark.mjs", "--dry-run", "--json"],
      {
        env: {
          ...process.env,
          SOLACE_BENCHMARK_SAMPLE_SIZE: "3",
        },
      },
    );
    const plan = JSON.parse(stdout) as BenchmarkRunPlan;

    expect(plan.sampleSize).toBe(3);
  });

  test("rejects invalid sample sizes", async () => {
    await expect(
      execFileAsync("node", ["scripts/run-benchmark.mjs", "--dry-run"], {
        env: {
          ...process.env,
          SOLACE_BENCHMARK_SAMPLE_SIZE: "0",
        },
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("SOLACE_BENCHMARK_SAMPLE_SIZE must be a positive integer"),
    });
  });
});
```

- [x] **Step 3: Verify RED**

Run:

```bash
pnpm test -- tests/unit/scripts/benchmark-metadata.test.ts tests/unit/scripts/run-benchmark.test.ts
```

Expected: fails because `--sample-size` is not parsed and `scripts/run-benchmark.mjs` does not exist.

---

### Task 2: Implement Benchmark Sample Size

**Files:**

- Modify: `scripts/benchmark-metadata.mjs`
- Create: `scripts/run-benchmark.mjs`
- Modify: `package.json`

- [x] **Step 1: Parse metadata sample size**

In `scripts/benchmark-metadata.mjs`, add sample-size parsing for `--sample-size <n>` and
`SOLACE_BENCHMARK_SAMPLE_SIZE`, defaulting to `1`. On invalid values, throw
`SOLACE_BENCHMARK_SAMPLE_SIZE must be a positive integer`.

- [x] **Step 2: Add runner script**

Create `scripts/run-benchmark.mjs` with a `parseSampleSize()`, `createRunPlan()`, `runCommand()`, and `main()` flow.
Use `spawn(command, args, { cwd: root, stdio: "inherit" })` for child benchmark runs.

- [x] **Step 3: Update package script**

Change `package.json`:

```json
"benchmark": "node scripts/run-benchmark.mjs"
```

- [x] **Step 4: Verify GREEN**

Run:

```bash
pnpm test -- tests/unit/scripts/benchmark-metadata.test.ts tests/unit/scripts/run-benchmark.test.ts
```

Expected: exits with code 0.

---

### Task 3: Document And Log

**Files:**

- Modify: `docs/performance.md`
- Add: `solace-project-log/solace-entries/2026-07-15-007-benchmark-sample-size.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Update performance docs**

Replace the jsdom sample-size paragraph with:

```md
`sampleSize` defaults to `1` so `pnpm benchmark` remains a smoke benchmark run. Set
`SOLACE_BENCHMARK_SAMPLE_SIZE=3 pnpm benchmark` to run three independent Vitest benchmark samples. The command reports
the configured sample size in metadata, but it does not yet aggregate medians or persist historical results.
```

- [x] **Step 2: Add project log entry**

Create `solace-project-log/solace-entries/2026-07-15-007-benchmark-sample-size.md` with observed validation results.

- [x] **Step 3: Update log index**

Add this row after `006` under `2026-07-15`:

```md
| 007 | 增加 benchmark sample size 配置 | benchmark runner、metadata、脚本测试、性能文档、项目日志 | `scripts/run-benchmark.mjs`, `scripts/benchmark-metadata.mjs`, `tests/unit/scripts/**`, `package.json`, `docs/performance.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-15-007-benchmark-sample-size.md) |
```

---

### Task 4: Final Validation

**Files:**

- All changed files

- [x] **Step 1: Format changed files**

Run:

```bash
pnpm exec prettier --write scripts/benchmark-metadata.mjs scripts/run-benchmark.mjs tests/unit/scripts/benchmark-metadata.test.ts tests/unit/scripts/run-benchmark.test.ts package.json docs/performance.md docs/superpowers/specs/2026-07-15-benchmark-sample-size-design.md docs/superpowers/plans/2026-07-15-benchmark-sample-size.md solace-project-log/solace-entries/2026-07-15-007-benchmark-sample-size.md solace-project-log/index.md
```

Expected: exits with code 0.

- [x] **Step 2: Run targeted script tests**

Run:

```bash
pnpm test -- tests/unit/scripts/benchmark-metadata.test.ts tests/unit/scripts/run-benchmark.test.ts
```

Expected: exits with code 0.

- [x] **Step 3: Run benchmark once**

Run:

```bash
pnpm benchmark
```

Expected: exits with code 0 and prints `benchmark metadata` with `"sampleSize":1`.

- [x] **Step 4: Run full tests**

Run:

```bash
pnpm test
```

Expected: exits with code 0.

- [x] **Step 5: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: exits with code 0.

- [x] **Step 6: Run lint**

Run:

```bash
pnpm lint
```

Expected: exits with code 0.

- [x] **Step 7: Run build**

Run:

```bash
pnpm build
```

Expected: exits with code 0.

- [x] **Step 8: Run format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.

- [x] **Step 9: Commit**

Run:

```bash
git add scripts/benchmark-metadata.mjs scripts/run-benchmark.mjs tests/unit/scripts/benchmark-metadata.test.ts tests/unit/scripts/run-benchmark.test.ts package.json docs/performance.md docs/superpowers/specs/2026-07-15-benchmark-sample-size-design.md docs/superpowers/plans/2026-07-15-benchmark-sample-size.md solace-project-log/solace-entries/2026-07-15-007-benchmark-sample-size.md solace-project-log/index.md
git commit -m "test: add benchmark sample size runner"
```

Expected: creates a commit after validation passes.
