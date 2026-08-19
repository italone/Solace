# Evidence Gates Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen adoption, performance-history, and DevTools evidence validation without manufacturing production evidence or widening the Solace runtime contract.

**Architecture:** Keep CLI entry points thin and place pure validation in the existing `*-config.mjs` modules. The evaluator will validate repository-relative evidence paths, exact record consistency, distinct UTC dates, and origin-scoped DevTools artifacts while preserving explicit `false`/`INCOMPLETE` results until external evidence exists.

**Tech Stack:** Node.js ESM scripts, Vitest, JSON evidence files, GitHub Actions, pnpm.

---

### Task 1: Adoption and Rollback Evidence Integrity

**Files:**

- Modify: `scripts/one-zero-readiness-config.mjs`
- Modify: `tests/unit/scripts/one-zero-readiness.test.ts`
- Modify: `release/one-zero-readiness.json`
- Modify: `docs/migration.md`

- [ ] **Step 1: Write failing tests** for missing evidence files, mismatched rollback records, and non-exact package versions.
- [ ] **Step 2: Run the focused evaluator tests** and confirm the new assertions fail against the current permissive schema.
- [ ] **Step 3: Implement pure checks** for safe repository-relative evidence paths, exact semver-like package versions, evidence-record identity, rollback target identity, and required rehearsal evidence.
- [ ] **Step 4: Keep current fixtures explicitly excluded** from independent adoption and update failure messages to name the missing external proof.
- [ ] **Step 5: Run focused tests and `pnpm release:one-zero:check`**, expecting adoption to remain failed for the current evidence.

### Task 2: Performance History Freshness and Date Integrity

**Files:**

- Modify: `scripts/one-zero-readiness-config.mjs`
- Modify: `scripts/performance-history-evidence-config.mjs`
- Modify: `tests/unit/scripts/one-zero-readiness.test.ts`
- Modify: `tests/unit/scripts/performance-history-evidence.test.ts`
- Modify: `release/one-zero-readiness.json`
- Modify: `docs/performance.md`

- [ ] **Step 1: Write failing tests** for duplicate timestamps, invalid/future `runAt`, stale evidence beyond the configured age, and distinct UTC-date counting.
- [ ] **Step 2: Run focused tests** and verify they fail before implementation.
- [ ] **Step 3: Add deterministic time injection** to pure evaluators and enforce a 30-day maximum evidence age plus five distinct UTC dates per scenario.
- [ ] **Step 4: Preserve the scheduled workflow** as the only source of new dates; do not alter checked-in history to claim completion.
- [ ] **Step 5: Run focused history/evaluator tests and `pnpm benchmark:history:evidence`** against current artifacts, expecting the six keyed scenarios to remain incomplete.

### Task 3: DevTools Artifact and Origin Evidence Integrity

**Files:**

- Modify: `scripts/devtools-extension-package-config.mjs`
- Modify: `scripts/devtools-extension-package.mjs`
- Modify: `tests/unit/scripts/devtools-extension-package.test.ts`
- Modify: `release/devtools-distribution-evidence.json`
- Modify: `release/devtools-distribution-evidence.md`
- Modify: `docs/devtools.md`

- [ ] **Step 1: Write failing tests** for manifest/origin mismatch, missing SHA-256 evidence, non-HTTPS origins, and repeated packaging output.
- [ ] **Step 2: Run the focused DevTools tests** and verify failures identify the missing integrity contract.
- [ ] **Step 3: Implement deterministic artifact metadata validation** tying normalized origins, generated manifest host permissions, ZIP digest, and test result to one evidence record.
- [ ] **Step 4: Keep production distribution fields false/empty** until a real production origin is supplied and tested.
- [ ] **Step 5: Run the packaging tests and a non-production dry run**, then verify `pnpm release:one-zero:check` still reports DevTools evidence as incomplete.

### Task 4: Cross-Gate Verification

**Files:**

- No source changes expected.

- [ ] **Step 1: Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and focused Vitest suites.**
- [ ] **Step 2: Run `pnpm quality` and `pnpm release:one-zero:check`.**
- [ ] **Step 3: Run `pnpm release:check` if the working tree remains compatible with the existing release gate.**
- [ ] **Step 4: Report which gates pass and which evidence criteria remain intentionally blocked.**
