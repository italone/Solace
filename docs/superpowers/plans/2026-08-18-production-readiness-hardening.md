# Solace Production Readiness Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 1.0 admission honest and enforceable, add performance regression budgets, reduce core
module complexity, and prepare a verified local beta.6 candidate.

**Architecture:** Keep beta publishing independent from stable admission. Store public contract,
adoption, and performance evidence in checked-in structured files, validate them with small Node
modules, and preserve runtime behavior while extracting Router and keyed-diff responsibilities.

**Tech Stack:** TypeScript, Node.js ESM, Vitest, Playwright, Rollup, Vite, pnpm, Changesets.

---

## Task 1: Make The 1.0 Evidence Checklist Honest

**Files:**

- Modify: `scripts/one-zero-readiness-config.mjs`
- Modify: `scripts/one-zero-readiness-config.d.mts`
- Modify: `scripts/one-zero-readiness-evidence.mjs`
- Modify: `scripts/one-zero-readiness.mjs`
- Modify: `release/one-zero-readiness.json`
- Test: `tests/unit/scripts/one-zero-readiness.test.ts`
- Test: `tests/unit/scripts/one-zero-readiness-evidence.test.ts`

- [ ] Add RED fixtures proving React compatibility installs, missing production workflows, fewer
      than five distinct dates, and boolean-only DevTools claims cannot produce `READY`.
- [ ] Run the focused tests and confirm each fails for the intended missing validation.
- [ ] Require Solace-primary workflow, upgrade, rollback, evidence-path, stable-contract, and
      production DevTools fields; rename command output to `Solace 1.0 evidence checklist`.
- [ ] Load and verify referenced structured evidence files rather than trusting path strings alone.
- [ ] Mark current React/Vite records as compatibility-only so the checked-in report is
      `INCOMPLETE`.
- [ ] Run `pnpm test tests/unit/scripts/one-zero-readiness*.test.ts` and confirm green.

## Task 2: Freeze The Machine-Readable Public Contract

**Files:**

- Create: `release/public-contract.json`
- Create: `scripts/public-contract-check-config.mjs`
- Create: `scripts/public-contract-check-config.d.mts`
- Create: `scripts/public-contract-check.mjs`
- Create: `tests/unit/scripts/public-contract-check.test.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] Add RED tests for a missing package export, invalid maturity, and a stable-admission claim while
      root Router/async APIs remain beta.
- [ ] Implement the manifest evaluator and CLI with field-specific failure messages.
- [ ] Add `release:contract:check`; run it in `quality` and CI.
- [ ] Make `release:publish` run `release:one-zero:check` before the full release gate while leaving
      `release:publish:beta` unchanged.
- [ ] Add a CI report step using `release:one-zero:check -- --report` so beta CI remains green.

## Task 3: Add A Performance Regression Gate

**Files:**

- Create: `release/performance-budgets.json`
- Create: `scripts/performance-regression-config.mjs`
- Create: `scripts/performance-regression-config.d.mts`
- Create: `scripts/performance-regression-check.mjs`
- Create: `tests/unit/scripts/performance-regression.test.ts`
- Modify: `scripts/one-zero-readiness-config.mjs`
- Modify: `package.json`
- Modify: `docs/performance.md`

- [ ] Add RED tests for missing scenarios, malformed values, over-budget browser latency, over-budget
      jsdom latency, and fewer than five distinct dates.
- [ ] Implement latest-successful-record parsing and deterministic budget evaluation.
- [ ] Add `performance:regression` after both benchmark commands in `release:check`.
- [ ] Check in broad catastrophic-regression budgets for every current browser scenario and jsdom
      task.
- [ ] Run focused tests, both benchmarks, and `pnpm performance:regression`.

## Task 4: Extract Router Contract Validation

**Files:**

- Create: `src/router/contract.ts`
- Modify: `src/router/router.ts`
- Test: `tests/unit/router/router.test.ts`

- [ ] Run the Router contract tests as the RED/characterization baseline.
- [ ] Move option, history, route-record, and raw-location assertions into the new internal module.
- [ ] Keep error types and strings unchanged and import only the two entry assertions from
      `router.ts`.
- [ ] Run Router unit, integration, package, and type tests.

## Task 5: Extract Keyed Sequence Helpers

**Files:**

- Create: `src/renderer/keyed-sequence.ts`
- Create: `tests/unit/renderer/keyed-sequence.test.ts`
- Modify: `src/renderer/diff.ts`

- [ ] Add RED tests for empty, zero-containing, sorted, reversed, and mixed LIS input plus duplicate
      key detection.
- [ ] Move `getIncreasingSubsequence`, `hasUniqueKeys`, and their private types into the focused
      module.
- [ ] Import the helpers from `diff.ts` without changing the keyed patch algorithm.
- [ ] Run focused renderer tests and benchmark scenarios.

## Task 6: Synchronize Public Documentation And Candidate Metadata

**Files:**

- Modify: `docs/compatibility.md`
- Modify: `docs/compatibility.zh-CN.md`
- Modify: `docs/project-status.md`
- Modify: `docs/project-status.zh-CN.md`
- Modify: `docs/release.md`
- Modify: `readme.md`
- Modify: `readme.zh-CN.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create then consume: `.changeset/<generated-name>.md`

- [ ] Document that `READY` is an evidence state, current evidence is `INCOMPLETE`, and beta
      maturity is not silently promoted.
- [ ] Record real-adoption requirements and keep current React/Vite installs as compatibility-only.
- [ ] Record performance budget semantics and the module-boundary refactor.
- [ ] Prepare `0.1.0-beta.6` metadata using the repository prerelease workflow and verify no pending
      changeset remains in the candidate.

## Task 7: Complete The Candidate Gate

- [ ] Run `pnpm quality`.
- [ ] Run `pnpm release:one-zero:check` and require the expected `INCOMPLETE` nonzero result.
- [ ] Run `pnpm release:one-zero:check -- --report` and require an actionable report.
- [ ] Run `pnpm release:check` and record unit/package/coverage/E2E/benchmark results.
- [ ] Run `pnpm release:readiness -- --publishable`; if only Git synchronization blocks it, report
      that exact external condition.
- [ ] Run `git diff --check` and inspect the final worktree.
- [ ] Commit the local beta.6 candidate. Do not publish npm or create/push a tag.
