# Browser Benchmark History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in JSONL history recording for the Chromium production browser benchmark.

**Architecture:** Add a focused Playwright-side history helper, unit-test its path parsing and append behavior, then call it from `tests/e2e/browser-benchmark.spec.ts` after the existing summary assertions pass. Keep default benchmark behavior unchanged and avoid timing aggregation.

**Tech Stack:** TypeScript, Playwright, Node filesystem APIs, Vitest, pnpm, Markdown, Prettier.

---

## File Structure

- Create `tests/e2e/browser-benchmark-history.ts`: parse `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH` and append browser benchmark JSONL records.
- Create `tests/unit/scripts/browser-benchmark-history.test.ts`: unit-test helper path parsing and append behavior.
- Modify `tests/e2e/browser-benchmark.spec.ts`: append history after a successful browser benchmark summary when the env var is set.
- Modify `docs/performance.md`: document opt-in browser benchmark history.
- Modify `readme.md`: update benchmark trend wording now both benchmark paths support opt-in local history.
- Add `solace-project-log/solace-entries/2026-07-15-010-browser-benchmark-history.md`: record change and validation.
- Modify `solace-project-log/index.md`: add 2026-07-15 row `010`.

No runtime framework source, benchmark scenarios, Playwright server config, browser sample-size config, or performance thresholds should change.

---

### Task 1: Add Failing Helper Tests

**Files:**

- Create: `tests/unit/scripts/browser-benchmark-history.test.ts`

- [x] **Step 1: Add helper tests**

Create `tests/unit/scripts/browser-benchmark-history.test.ts`:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  appendBrowserBenchmarkHistory,
  parseBrowserBenchmarkHistoryPath,
  type BrowserBenchmarkHistorySummary,
} from "../../e2e/browser-benchmark-history";

const summary: BrowserBenchmarkHistorySummary = {
  scenario: "large-list",
  rows: 10_000,
  initialRenderMs: 1,
  updateMs: 1,
  unmountMs: 1,
  selectedText: "Row 5000 selected",
  remainingNodesAfterUnmount: 0,
  metadata: {
    packageName: "solace",
    packageVersion: "0.0.0",
    node: process.version,
    platform: "darwin",
    release: "test",
    arch: "arm64",
    cpuModel: "test",
    logicalCpuCount: 1,
    totalMemoryBytes: 1,
    browserName: "chromium",
    browserVersion: "test",
    projectName: "chromium",
    sampleSize: 1,
    runAt: "2026-07-15T00:00:00.000Z",
  },
};

describe("browser benchmark history", () => {
  test("parses an optional history path", () => {
    expect(parseBrowserBenchmarkHistoryPath({})).toBeUndefined();
    expect(
      parseBrowserBenchmarkHistoryPath({
        SOLACE_BROWSER_BENCHMARK_HISTORY_PATH: ".benchmark-history/browser.jsonl",
      }),
    ).toBe(".benchmark-history/browser.jsonl");
  });

  test("rejects empty history paths", () => {
    expect(() =>
      parseBrowserBenchmarkHistoryPath({
        SOLACE_BROWSER_BENCHMARK_HISTORY_PATH: "   ",
      }),
    ).toThrow("SOLACE_BROWSER_BENCHMARK_HISTORY_PATH must not be empty");
  });

  test("appends a browser benchmark history record", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "solace-browser-benchmark-history-"));
    const historyPath = join(tempDir, "nested", "browser.jsonl");

    try {
      await appendBrowserBenchmarkHistory(historyPath, summary);

      const [line] = (await readFile(historyPath, "utf8")).trim().split("\n");
      const record = JSON.parse(line) as {
        kind: string;
        status: string;
        sampleCount: number;
        summary: BrowserBenchmarkHistorySummary;
      };

      expect(record.kind).toBe("browser-benchmark");
      expect(record.status).toBe("passed");
      expect(record.sampleCount).toBe(1);
      expect(record.summary.metadata.browserName).toBe("chromium");
      expect(record.summary.metadata.sampleSize).toBe(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
```

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm test -- tests/unit/scripts/browser-benchmark-history.test.ts
```

Expected: fails because `tests/e2e/browser-benchmark-history.ts` does not exist yet.

---

### Task 2: Implement Browser History Helper And Wire Spec

**Files:**

- Create: `tests/e2e/browser-benchmark-history.ts`
- Modify: `tests/e2e/browser-benchmark.spec.ts`

- [x] **Step 1: Add helper module**

Create `tests/e2e/browser-benchmark-history.ts` with exported summary types, `parseBrowserBenchmarkHistoryPath()`, and
`appendBrowserBenchmarkHistory()`.

- [x] **Step 2: Wire browser benchmark spec**

In `tests/e2e/browser-benchmark.spec.ts`, import the helper, reuse `BrowserBenchmarkSummary` from the helper, parse the
history path at test start, and append after the existing summary assertion and console log.

- [x] **Step 3: Verify GREEN**

Run:

```bash
pnpm test -- tests/unit/scripts/browser-benchmark-history.test.ts
```

Expected: exits with code 0.

---

### Task 3: Document And Log

**Files:**

- Modify: `docs/performance.md`
- Modify: `readme.md`
- Add: `solace-project-log/solace-entries/2026-07-15-010-browser-benchmark-history.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Update performance docs**

Document:

```md
Set `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl pnpm benchmark:browser` to append one JSONL
record after a successful Chromium production benchmark run. Browser history records persist the existing summary object;
they do not add repeated samples, timing thresholds, or statistical aggregation.
```

- [x] **Step 2: Update README trend wording**

Update the benchmark trend bullet so it says both jsdom and browser benchmark commands support opt-in local JSONL
history, while medians and variance remain future work.

- [x] **Step 3: Add project log and index row**

Add row `010` under 2026-07-15:

```md
| 010 | 增加 browser benchmark history 记录 | browser benchmark、Playwright helper、脚本测试、性能文档、README、项目日志 | `tests/e2e/browser-benchmark.spec.ts`, `tests/e2e/browser-benchmark-history.ts`, `tests/unit/scripts/browser-benchmark-history.test.ts`, `docs/performance.md`, `readme.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-15-010-browser-benchmark-history.md) |
```

---

### Task 4: Final Validation

**Files:**

- All changed files

- [x] **Step 1: Format changed files**

Run:

```bash
pnpm exec prettier --write tests/e2e/browser-benchmark.spec.ts tests/e2e/browser-benchmark-history.ts tests/unit/scripts/browser-benchmark-history.test.ts docs/performance.md readme.md docs/superpowers/specs/2026-07-15-browser-benchmark-history-design.md docs/superpowers/plans/2026-07-15-browser-benchmark-history.md solace-project-log/solace-entries/2026-07-15-010-browser-benchmark-history.md solace-project-log/index.md
```

Expected: exits with code 0.

- [x] **Step 2: Run targeted helper test**

Run:

```bash
pnpm test -- tests/unit/scripts/browser-benchmark-history.test.ts
```

Expected: exits with code 0.

- [x] **Step 3: Run browser benchmark with history**

Run:

```bash
SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=/tmp/solace-browser-benchmark-history.jsonl pnpm benchmark:browser
```

Expected: exits with code 0 and writes one JSONL record.

- [x] **Step 4: Run e2e smoke**

Run:

```bash
pnpm test:e2e
```

Expected: exits with code 0.

- [x] **Step 5: Run full tests**

Run:

```bash
pnpm test
```

Expected: exits with code 0.

- [x] **Step 6: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: exits with code 0.

- [x] **Step 7: Run lint**

Run:

```bash
pnpm lint
```

Expected: exits with code 0.

- [x] **Step 8: Run build**

Run:

```bash
pnpm build
```

Expected: exits with code 0.

- [x] **Step 9: Run format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.

- [x] **Step 10: Commit**

Run:

```bash
git add tests/e2e/browser-benchmark.spec.ts tests/e2e/browser-benchmark-history.ts tests/unit/scripts/browser-benchmark-history.test.ts docs/performance.md readme.md docs/superpowers/specs/2026-07-15-browser-benchmark-history-design.md docs/superpowers/plans/2026-07-15-browser-benchmark-history.md solace-project-log/solace-entries/2026-07-15-010-browser-benchmark-history.md solace-project-log/index.md
git commit -m "feat: record browser benchmark history"
```

Expected: creates a commit after validation passes.
