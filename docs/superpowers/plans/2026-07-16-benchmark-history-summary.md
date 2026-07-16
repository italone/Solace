# Benchmark History Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only CLI that summarizes local benchmark history JSONL files.

**Architecture:** Create `scripts/summarize-benchmark-history.mjs` with exported parser/statistics helpers and a CLI entry point. Add a `benchmark:history` package script, unit-test the helper and CLI JSON mode, and document how to use the summary command.

**Tech Stack:** Node ESM scripts, pnpm, Vitest, TypeScript tests, Markdown, Prettier.

---

## File Structure

- Create `scripts/summarize-benchmark-history.mjs`: read JSONL history, group records, calculate median/p95/variance, and print text or JSON output.
- Create `tests/unit/scripts/benchmark-history-summary.test.ts`: cover parser/statistics/CLI behavior.
- Modify `package.json`: add `benchmark:history`.
- Modify `docs/performance.md`: document local summary command and statistical boundaries.
- Modify `readme.md`: update benchmark trend wording to say local summary exists.
- Add `solace-project-log/solace-entries/2026-07-16-001-benchmark-history-summary.md`: record change and validation.
- Modify `solace-project-log/index.md`: add a `2026-07-16` section with row `001`.

No runtime framework source, benchmark run behavior, browser benchmark harness, or generated history file should change.

---

### Task 1: Add Failing Summary Tests

**Files:**

- Create: `tests/unit/scripts/benchmark-history-summary.test.ts`

- [x] **Step 1: Add summary behavior tests**

Create tests that:

- write temporary browser and jsdom JSONL records,
- call `node scripts/summarize-benchmark-history.mjs --json <path>`,
- assert `recordCount`, browser `median`, `p95`, `variance`, and jsdom record counts,
- assert missing files produce an empty summary,
- assert malformed JSONL reports file and line.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm test -- tests/unit/scripts/benchmark-history-summary.test.ts
```

Expected: fails because `scripts/summarize-benchmark-history.mjs` does not exist.

---

### Task 2: Implement Summary CLI

**Files:**

- Create: `scripts/summarize-benchmark-history.mjs`
- Modify: `package.json`

- [x] **Step 1: Implement read-only JSONL parser**

Read explicit paths from CLI args or default to `.benchmark-history/jsdom.jsonl` and `.benchmark-history/browser.jsonl`.
Ignore missing files and blank lines. Throw `Invalid benchmark history JSON at <path>:<line>` for malformed JSON.

- [x] **Step 2: Implement grouping and statistics**

Group browser records by `browser-benchmark:<scenario>` and jsdom records by `jsdom-benchmark:<environment>`. Calculate
median, nearest-rank p95, and population variance for browser timing metrics.

- [x] **Step 3: Implement CLI output**

Support `--json`. Without `--json`, print concise human-readable lines with record counts and metric summaries.

- [x] **Step 4: Add package script**

Add:

```json
"benchmark:history": "node scripts/summarize-benchmark-history.mjs"
```

- [x] **Step 5: Verify GREEN**

Run:

```bash
pnpm test -- tests/unit/scripts/benchmark-history-summary.test.ts
```

Expected: exits with code 0.

---

### Task 3: Document And Log

**Files:**

- Modify: `docs/performance.md`
- Modify: `readme.md`
- Add: `solace-project-log/solace-entries/2026-07-16-001-benchmark-history-summary.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Update performance docs**

Document:

```md
Run `pnpm benchmark:history` to summarize local JSONL history from `.benchmark-history/jsdom.jsonl` and
`.benchmark-history/browser.jsonl`. Use `pnpm benchmark:history -- --json <path>` for machine-readable output. The
summary reports record counts plus median, p95, and variance for numeric browser timing metrics; it does not enforce
thresholds.
```

- [x] **Step 2: Update README benchmark trend bullet**

Update the benchmark trend bullet so it says local JSONL history and summary are available, while thresholds and release
performance claims remain future work.

- [x] **Step 3: Add project log and index row**

Add `## 2026-07-16` with row `001` in `solace-project-log/index.md`.

---

### Task 4: Final Validation

**Files:**

- All changed files

- [x] **Step 1: Format changed files**

Run:

```bash
pnpm exec prettier --write scripts/summarize-benchmark-history.mjs tests/unit/scripts/benchmark-history-summary.test.ts package.json docs/performance.md readme.md docs/superpowers/specs/2026-07-16-benchmark-history-summary-design.md docs/superpowers/plans/2026-07-16-benchmark-history-summary.md solace-project-log/solace-entries/2026-07-16-001-benchmark-history-summary.md solace-project-log/index.md
```

Expected: exits with code 0.

- [x] **Step 2: Run targeted tests**

Run:

```bash
pnpm test -- tests/unit/scripts/benchmark-history-summary.test.ts
```

Expected: exits with code 0.

- [x] **Step 3: Run summary CLI**

Run:

```bash
pnpm benchmark:history -- --json
```

Expected: exits with code 0 even when default history files are missing.

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
git add scripts/summarize-benchmark-history.mjs tests/unit/scripts/benchmark-history-summary.test.ts package.json docs/performance.md readme.md docs/superpowers/specs/2026-07-16-benchmark-history-summary-design.md docs/superpowers/plans/2026-07-16-benchmark-history-summary.md solace-project-log/solace-entries/2026-07-16-001-benchmark-history-summary.md solace-project-log/index.md
git commit -m "feat: summarize benchmark history"
```

Expected: creates a commit after validation passes.
