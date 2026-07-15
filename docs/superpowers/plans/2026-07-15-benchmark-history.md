# Benchmark History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in JSONL history recording for jsdom benchmark runs.

**Architecture:** Export benchmark metadata helpers from `scripts/benchmark-metadata.mjs`, let `scripts/run-benchmark.mjs` collect metadata in-process, and append one history JSON line after all benchmark samples pass when `SOLACE_BENCHMARK_HISTORY_PATH` is set. Keep default `pnpm benchmark` behavior unchanged and avoid timing aggregation.

**Tech Stack:** Node ESM scripts, pnpm, Vitest, TypeScript tests, Markdown, Prettier.

---

## File Structure

- Modify `scripts/benchmark-metadata.mjs`: export metadata and sample-size helpers while keeping CLI behavior.
- Modify `scripts/run-benchmark.mjs`: parse optional `SOLACE_BENCHMARK_HISTORY_PATH`, print metadata in-process, and append JSONL after successful samples.
- Modify `tests/unit/scripts/benchmark-metadata.test.ts`: verify metadata CLI still works after exports.
- Modify `tests/unit/scripts/run-benchmark.test.ts`: cover dry-run history path, invalid empty history path, and JSONL append with a temporary file.
- Modify `docs/performance.md`: document opt-in jsdom benchmark history and current non-aggregation.
- Modify `readme.md`: update benchmark trend next-step wording.
- Add `solace-project-log/solace-entries/2026-07-15-009-benchmark-history.md`: record change and validation.
- Modify `solace-project-log/index.md`: add 2026-07-15 row `009`.

No runtime framework source, browser benchmark harness, benchmark thresholds, or persisted generated history file should change.

---

### Task 1: Add Failing Tests

**Files:**

- Modify: `tests/unit/scripts/run-benchmark.test.ts`

- [x] **Step 1: Add history path to dry-run test**

Add this test to `tests/unit/scripts/run-benchmark.test.ts`:

```ts
test("prints a dry-run plan with the configured history path", async () => {
  const { stdout } = await execFileAsync(
    "node",
    ["scripts/run-benchmark.mjs", "--dry-run", "--json"],
    {
      env: {
        ...process.env,
        SOLACE_BENCHMARK_HISTORY_PATH: ".benchmark-history/jsdom.jsonl",
      },
    },
  );
  const plan = JSON.parse(stdout) as BenchmarkRunPlan & { historyPath: string };

  expect(plan.historyPath).toBe(".benchmark-history/jsdom.jsonl");
});
```

- [x] **Step 2: Add invalid empty history path test**

Add:

```ts
test("rejects empty benchmark history paths", async () => {
  await expect(
    execFileAsync("node", ["scripts/run-benchmark.mjs", "--dry-run"], {
      env: {
        ...process.env,
        SOLACE_BENCHMARK_HISTORY_PATH: "   ",
      },
    }),
  ).rejects.toMatchObject({
    stderr: expect.stringContaining("SOLACE_BENCHMARK_HISTORY_PATH must not be empty"),
  });
});
```

- [x] **Step 3: Add JSONL append test**

Add imports:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
```

Then add:

```ts
test("appends a benchmark history record after successful samples", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "solace-benchmark-history-"));
  const historyPath = join(tempDir, "history", "jsdom.jsonl");

  try {
    await execFileAsync("node", ["scripts/run-benchmark.mjs"], {
      env: {
        ...process.env,
        SOLACE_BENCHMARK_HISTORY_PATH: historyPath,
      },
    });

    const [line] = (await readFile(historyPath, "utf8")).trim().split("\n");
    const record = JSON.parse(line) as {
      kind: string;
      status: string;
      metadata: { benchmarkEnvironment: string; sampleSize: number };
      sampleCount: number;
      command: string;
      args: string[];
    };

    expect(record).toMatchObject({
      kind: "jsdom-benchmark",
      status: "passed",
      sampleCount: 1,
      command: "pnpm",
      args: ["exec", "vitest", "run", "--config", "vitest.benchmark.config.ts"],
    });
    expect(record.metadata.benchmarkEnvironment).toBe("jsdom");
    expect(record.metadata.sampleSize).toBe(1);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
```

- [x] **Step 4: Verify RED**

Run:

```bash
pnpm test -- tests/unit/scripts/run-benchmark.test.ts
```

Expected: fails because `historyPath` is not in the dry-run plan and the runner does not append history yet.

---

### Task 2: Implement Opt-In History

**Files:**

- Modify: `scripts/benchmark-metadata.mjs`
- Modify: `scripts/run-benchmark.mjs`

- [x] **Step 1: Export metadata helpers**

In `scripts/benchmark-metadata.mjs`, export `parseSampleSize` and `createBenchmarkMetadata`, and wrap CLI execution so
imports do not print metadata:

```js
const isCli = process.argv[1] === fileURLToPath(import.meta.url);

if (isCli) {
  try {
    const sampleSize = parseSampleSize(process.argv, process.env);
    const metadata = await createBenchmarkMetadata(sampleSize);
    const payload = JSON.stringify(metadata);

    if (jsonOnly) {
      console.log(payload);
    } else {
      console.log(`benchmark metadata: ${payload}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
```

- [x] **Step 2: Add history parsing to runner**

In `scripts/run-benchmark.mjs`, support:

- `SOLACE_BENCHMARK_HISTORY_PATH`: optional non-empty history output path.
  Do not add command override environment variables; the runner should keep using the same benchmark command in tests and
  real runs.

- [x] **Step 3: Append history after successful samples**

Use `mkdir(dirname(historyPath), { recursive: true })` and `appendFile(historyPath, JSON.stringify(record) + "\n", "utf8")`
after all samples pass.

- [x] **Step 4: Verify GREEN**

Run:

```bash
pnpm test -- tests/unit/scripts/run-benchmark.test.ts tests/unit/scripts/benchmark-metadata.test.ts
```

Expected: exits with code 0.

---

### Task 3: Document And Log

**Files:**

- Modify: `docs/performance.md`
- Modify: `readme.md`
- Add: `solace-project-log/solace-entries/2026-07-15-009-benchmark-history.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Update performance docs**

Document:

```md
Set `SOLACE_BENCHMARK_HISTORY_PATH=.benchmark-history/jsdom.jsonl pnpm benchmark` to append one JSONL record after a
successful jsdom benchmark run. History recording is opt-in and records metadata plus run status; it does not yet parse
Tinybench timings, compute medians, or persist browser benchmark results.
```

- [x] **Step 2: Update README next-step wording**

Change the benchmark trend bullet so it says jsdom history recording exists as opt-in local JSONL, while browser history
and aggregation remain future work.

- [x] **Step 3: Add project log and index row**

Add row `009` under 2026-07-15:

```md
| 009 | 增加 jsdom benchmark history 记录 | benchmark runner、metadata helper、脚本测试、性能文档、README、项目日志 | `scripts/run-benchmark.mjs`, `scripts/benchmark-metadata.mjs`, `tests/unit/scripts/**`, `docs/performance.md`, `readme.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-15-009-benchmark-history.md) |
```

---

### Task 4: Final Validation

**Files:**

- All changed files

- [x] **Step 1: Format changed files**

Run:

```bash
pnpm exec prettier --write scripts/benchmark-metadata.mjs scripts/run-benchmark.mjs tests/unit/scripts/benchmark-metadata.test.ts tests/unit/scripts/run-benchmark.test.ts docs/performance.md readme.md docs/superpowers/specs/2026-07-15-benchmark-history-design.md docs/superpowers/plans/2026-07-15-benchmark-history.md solace-project-log/solace-entries/2026-07-15-009-benchmark-history.md solace-project-log/index.md
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

Expected: exits with code 0 and does not require `SOLACE_BENCHMARK_HISTORY_PATH`.

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
git add scripts/benchmark-metadata.mjs scripts/run-benchmark.mjs tests/unit/scripts/benchmark-metadata.test.ts tests/unit/scripts/run-benchmark.test.ts docs/performance.md readme.md docs/superpowers/specs/2026-07-15-benchmark-history-design.md docs/superpowers/plans/2026-07-15-benchmark-history.md solace-project-log/solace-entries/2026-07-15-009-benchmark-history.md solace-project-log/index.md
git commit -m "feat: record benchmark history"
```

Expected: creates a commit after validation passes.
