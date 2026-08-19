# Independent Adoption Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe, deterministic evidence-bundle validator for independently owned Solace-primary applications without fabricating production adoption.

**Architecture:** Keep command-line parsing and pure evidence validation in `scripts/adoption-evidence-config.mjs`. Keep `scripts/adoption-evidence.mjs` as a thin runner that reads phase JSON records, validates baseline/candidate/rollback identity and digests, then writes one atomically generated bundle. The existing `one-zero-readiness` evaluator remains the final admission boundary and continues to reject current fixtures and React-primary applications.

**Tech Stack:** Node.js ESM, Node crypto/fs APIs, Vitest, JSON evidence records, pnpm scripts.

---

### Task 1: Add the pure evidence contract

**Files:**

- Create: `scripts/adoption-evidence-config.mjs`
- Create: `scripts/adoption-evidence-config.d.mts`
- Test: `tests/unit/scripts/adoption-evidence.test.ts`

- [ ] **Step 1: Write failing tests** for exact HTTPS origins, exact semver versions, required phase fields, command result validation, workflow completeness, and baseline digest binding.
- [ ] **Step 2: Run `pnpm exec vitest run tests/unit/scripts/adoption-evidence.test.ts`** and confirm the module is missing.
- [ ] **Step 3: Implement pure helpers**: `parseAdoptionEvidenceArguments`, `validatePhaseRecord`, `createEvidenceBundle`, `serializeEvidenceBundle`, and `sha256Json`.
- [ ] **Step 4: Ensure failed command records force `verified: false`** and reject missing lockfile digests, dirty worktrees, non-HTTPS origins, ranges, duplicate phases, or mismatched application identities.
- [ ] **Step 5: Run the focused test and confirm all contract cases pass.**

### Task 2: Add the thin bundle CLI

**Files:**

- Create: `scripts/adoption-evidence.mjs`
- Modify: `package.json`
- Test: `tests/unit/scripts/adoption-evidence.test.ts`

- [ ] **Step 1: Write failing CLI tests** for `--phase`, `--record`, `--output`, duplicate phase input, and safe output path handling.
- [ ] **Step 2: Implement JSON record loading and repository-relative output checks** without reading arbitrary environment values or shell-evaluating commands.
- [ ] **Step 3: Write the bundle atomically** to `<output>.json`, preserving invalid input diagnostics and never changing `release/adoption-evidence.json`.
- [ ] **Step 4: Add `adoption:evidence` to `package.json`** and document the exact invocation in `docs/migration.md` and `docs/migration.zh-CN.md`.
- [ ] **Step 5: Run focused tests and a disposable local dry run** using synthetic records; verify the generated bundle is deterministic and marked non-production until reviewer metadata is present.

### Task 3: Bind the bundle to the existing 1.0 evidence shape

**Files:**

- Modify: `scripts/one-zero-readiness-config.mjs`
- Modify: `tests/unit/scripts/one-zero-readiness.test.ts`
- Modify: `release/one-zero-readiness.json`
- Modify: `docs/release.md`

- [ ] **Step 1: Write failing evaluator tests** for bundle digest mismatch, phase identity mismatch, missing reviewer approval, and incomplete rollback.
- [ ] **Step 2: Add an optional `adoptionEvidenceBundle` reference** that is required only for independent applications; preserve the current explicit `0/2` result.
- [ ] **Step 3: Require bundle phases to match exact versions, workflows, evidence paths, and rollback target identity before counting an application.**
- [ ] **Step 4: Run focused evaluator tests and `pnpm release:one-zero:check`**, confirming the current records still fail adoption honestly.

### Task 4: Cross-gate verification

**Files:**

- No source changes expected.

- [ ] **Step 1: Run `pnpm exec prettier --write` on changed files and the focused tests.**
- [ ] **Step 2: Run `pnpm quality`.**
- [ ] **Step 3: Run `pnpm release:one-zero:check`; expected result remains `INCOMPLETE`.**
- [ ] **Step 4: Run `git diff --check` and report exact remaining production evidence gaps.**
