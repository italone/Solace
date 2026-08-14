# Performance History Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate deterministic checked-in performance-history evidence from ignored JSONL files and make the 1.0 readiness gate validate distinct benchmark runs.

**Architecture:** Add one Node ESM generator with pure aggregation helpers and a small CLI. Keep the readiness evaluator pure by loading the referenced summary in the existing CLI and injecting it into evaluation; retain raw history outside Git.

**Tech Stack:** Node.js ESM, TypeScript declaration shims, pnpm, Vitest, JSONL, SHA-256.

---

### Task 1: Add RED generator contracts

**Files:**

- Create: `tests/unit/scripts/performance-history-evidence.test.ts`
- Create: `scripts/performance-history-evidence-config.d.mts`

- [ ] Add tests that build browser and jsdom JSONL fixtures in a temporary directory, call
      `createPerformanceHistoryEvidence()`, and expect stable browser scenario and jsdom task maps with
      `recordCount`, `distinctRunCount`, `distinctDateCount`, `firstRunAt`, and `lastRunAt`.
- [ ] Add a duplicate-`runAt` fixture and assert that `recordCount` grows while
      `distinctRunCount` does not.
- [ ] Add invalid timestamp, missing file, and malformed JSONL cases with path-specific errors.
- [ ] Run `pnpm test -- tests/unit/scripts/performance-history-evidence.test.ts` and confirm RED
      because the module does not exist.

### Task 2: Implement deterministic evidence generation

**Files:**

- Create: `scripts/performance-history-evidence-config.mjs`
- Create: `scripts/performance-history-evidence.mjs`
- Modify: `scripts/performance-history-evidence-config.d.mts`
- Modify: `package.json`

- [ ] Implement
      `createPerformanceHistoryEvidence({ browserPath, jsdomPath }): Promise<PerformanceHistoryEvidence>`
      using `node:fs/promises`, `node:path`, and `node:crypto`. Count only `status: "passed"` records
      with valid `runAt` values; sort object keys before serialization.
- [ ] Implement CLI arguments
      `--browser <path> --jsdom <path> [--output <repository-relative-path>]`. Default paths are the two
      ignored history files; stdout is JSON when `--output` is absent. Resolve output inside the
      repository and reject empty, absolute, or parent-traversal paths.
- [ ] Add `benchmark:history:evidence` to `package.json` and preserve non-zero exit codes plus
      concise stderr errors.
- [ ] Re-run the focused test and verify GREEN. Run the CLI twice against temporary fixtures and
      assert byte-identical output.

### Task 3: Add RED readiness summary contracts

**Files:**

- Modify: `tests/unit/scripts/one-zero-readiness.test.ts`

- [ ] Replace fixture count maps with `minimumDistinctRuns`, a safe evidence path, and injected
      summary data. Assert that every browser scenario and jsdom task needs five distinct runs.
- [ ] Add cases rejecting the legacy count-map shape, an unsafe evidence path, unsupported summary
      schema, empty maps, invalid audit fields, and duplicate-run counts below the minimum.
- [ ] Run `pnpm test -- tests/unit/scripts/one-zero-readiness.test.ts` and confirm RED against the
      old count-map evaluator.

### Task 4: Bind readiness to checked-in evidence

**Files:**

- Modify: `scripts/one-zero-readiness-config.mjs`
- Modify: `scripts/one-zero-readiness-config.d.mts`
- Modify: `scripts/one-zero-readiness.mjs`
- Modify: `release/one-zero-readiness.json`

- [ ] Implement pure summary validation in `evaluateOneZeroReadiness()`. Use
      `distinctRunCount`, retain stable criterion ID `performance.recent-history`, and include each
      insufficient scenario in the failure message.
- [ ] Load the safe evidence path from the repository in `one-zero-readiness.mjs`; inject the
      parsed summary without mutating the checked-in readiness JSON. Missing or malformed evidence must
      exit non-zero with the referenced path.
- [ ] Replace manual count maps in `release/one-zero-readiness.json` with
      `minimumDistinctRuns: 5` and `evidence: "release/performance-history.json"`.
- [ ] Run focused readiness tests and verify GREEN, including `pnpm release:one-zero:check --
--report` against the current incomplete evidence state.

### Task 5: Produce truthful current evidence

**Files:**

- Create: `release/performance-history.json`

- [ ] Run one real append with
      `SOLACE_BENCHMARK_HISTORY_PATH=.benchmark-history/jsdom.jsonl pnpm benchmark`; verify every
      task reaches three distinct jsdom `runAt` values. Do not batch two more immediate runs to make the
      continuous-history gate appear complete.
- [ ] Run
      `pnpm benchmark:history:evidence -- --output release/performance-history.json` twice and confirm
      the second run does not change the file.
- [ ] Run `pnpm release:one-zero:check -- --report`; expect performance FAIL at 3/5 and adoption
      FAIL at 0/2 while the other three criteria pass.

### Task 6: Synchronize documentation and validate

**Files:**

- Modify: `docs/performance.md`
- Modify: `docs/project-status.md`
- Modify: `docs/project-status.zh-CN.md`
- Modify: `docs/release.md`
- Modify: `tests/unit/docs/public-contract-docs.test.ts`

- [ ] Document the generator command, distinct-run semantics, audit-only date fields, ignored raw
      history, checked-in evidence path, and current readiness result in English and Chinese status.
- [ ] Update documentation contract assertions before changing docs, run them RED, then synchronize
      docs and run them GREEN.
- [ ] Run `node --check` for both new scripts, focused script/doc tests, `pnpm typecheck`, and the
      validation recommendations for changed files.
- [ ] Run `pnpm release:check`, `git diff --check`, and inspect ignored/generated files. Do not
      commit, push, publish, tag, or change npm dist-tags without separate maintainer authorization.
