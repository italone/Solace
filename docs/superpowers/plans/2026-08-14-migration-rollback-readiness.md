# Migration And Rollback Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace boolean-only migration readiness with structured documentation evidence and add executable English and Chinese migration/rollback procedures.

**Architecture:** Keep `evaluateOneZeroReadiness()` pure by validating only the evidence structure and safe repository-relative paths. Bind those paths to real bilingual runbooks through the existing documentation contract test, then update the checked-in evidence and status documents without performing registry or Git mutations.

**Tech Stack:** Node.js ESM, TypeScript 5.9 declaration shims, Vitest, JSON evidence, Markdown, Prettier, pnpm 10.

---

### Task 1: Require structured migration evidence

**Files:**

- Modify: `tests/unit/scripts/one-zero-readiness.test.ts`
- Modify: `scripts/one-zero-readiness-config.mjs`
- Modify if the exported signature changes: `scripts/one-zero-readiness-config.d.mts`

- [x] **Step 1: Change the ready fixture to structured records**

Use this shape for all four procedure keys:

```ts
migrationPolicy: {
  compatibility: {
    documented: true,
    evidence: ["docs/compatibility.md", "docs/compatibility.zh-CN.md"],
  },
  deprecation: {
    documented: true,
    evidence: ["docs/compatibility.md", "docs/compatibility.zh-CN.md"],
  },
  migration: {
    documented: true,
    evidence: ["docs/migration.md", "docs/migration.zh-CN.md"],
  },
  rollback: {
    documented: true,
    evidence: ["docs/migration.md", "docs/migration.zh-CN.md"],
  },
}
```

Add one table-driven test that replaces `migration` with each invalid value: `true`, `false`, an
empty evidence array, an empty path, `/absolute.md`, and `../outside.md`. Assert the
`release.migration-policy` criterion fails and names `migration`.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/one-zero-readiness.test.ts
```

Expected: the ready fixture and invalid-structured-evidence test fail because the evaluator still
compares every procedure directly with `true`.

- [x] **Step 3: Implement the minimal structural validator**

Add a focused helper in `scripts/one-zero-readiness-config.mjs`:

```js
function isDocumentedProcedure(procedure) {
  return (
    procedure?.documented === true &&
    Array.isArray(procedure.evidence) &&
    procedure.evidence.length > 0 &&
    procedure.evidence.every(isSafeEvidencePath)
  );
}

function isSafeEvidencePath(value) {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    !value.startsWith("/") &&
    !value.split(/[\\/]+/u).includes("..")
  );
}
```

Use `isDocumentedProcedure(evidence?.migrationPolicy?.[field])` when collecting missing fields.
Keep the exported evaluator signature and declaration file unchanged.

- [x] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/one-zero-readiness.test.ts
```

Expected: all readiness unit tests pass, including the legacy-boolean and unsafe-path cases.

### Task 2: Add bilingual migration and rollback runbooks

**Files:**

- Create: `docs/migration.md`
- Create: `docs/migration.zh-CN.md`
- Modify: `tests/unit/docs/public-contract-docs.test.ts`

- [x] **Step 1: Add failing documentation assertions**

Read both new documents in the existing `Promise.all()`. Assert both contain migration procedure,
rollback triggers, rollback procedure, exact-version consumer validation, immutable npm version
rules, and explicit maintainer authorization. Use language-specific phrases for prose and shared
literal commands or identifiers for machine-sensitive boundaries.

- [x] **Step 2: Run the documentation contract test and verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts
```

Expected: fail with `ENOENT` for `docs/migration.md` before either runbook exists.

- [x] **Step 3: Write the English runbook**

Include these sections:

```markdown
## Migration Procedure

## Exact Package Consumer Validation

## Evidence Record

## Rollback Triggers

## Rollback Procedure

## Registry And Git Boundaries
```

Document protected-entry classification, replacement and `@deprecated` requirements, before/after
examples, package-only install/typecheck/build/CSR-or-SSR checks, evidence fields, exact known-good
pinning, corrective releases, immutable npm versions and Git tags, and explicit approval for publish,
unpublish, dist-tag, push, or tag operations.

- [x] **Step 4: Write the synchronized Chinese runbook**

Mirror every English section and command boundary in Chinese. Preserve literal package names,
commands, evidence keys, and public import paths so contract assertions can compare the same public
workflow.

- [x] **Step 5: Run the documentation test and verify GREEN**

Run:

```bash
pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts
```

Expected: the documentation contract test passes.

### Task 3: Connect evidence and public status

**Files:**

- Modify: `release/one-zero-readiness.json`
- Modify: `docs/release.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/project-status.md`
- Modify: `docs/project-status.zh-CN.md`
- Modify: `tests/unit/docs/public-contract-docs.test.ts`

- [x] **Step 1: Add status assertions for the narrowed remaining gaps**

Require both project-status documents to say migration/rollback procedures now pass while real
independent applications and five-record performance history remain incomplete. Require
`docs/release.md` to link both runbooks and `docs/roadmap.md` to keep UI libraries and plugin
marketplaces outside the `1.0` gate.

- [x] **Step 2: Run the documentation test and verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts
```

Expected: fail because release, roadmap, and project-status prose still describe migration/rollback
as missing.

- [x] **Step 3: Replace boolean evidence with structured references**

Set all four `release/one-zero-readiness.json` procedure records to `documented: true`. Point
compatibility and deprecation at the two compatibility documents; point migration and rollback at
the two migration documents. Do not change application or performance evidence.

- [x] **Step 4: Synchronize release, roadmap, and project status**

Link the runbooks from `docs/release.md`, mark only the procedure criterion as satisfied in
`docs/roadmap.md`, and update both status documents so the remaining `1.0` gaps are independent
applications and performance history. Do not claim a live rollback rehearsal.

- [x] **Step 5: Verify the focused evidence report and docs**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/one-zero-readiness.test.ts tests/unit/docs/public-contract-docs.test.ts
pnpm release:one-zero:check -- --report
```

Expected: focused tests pass; the report shows PASS for compatibility, DevTools, and migration policy,
and FAIL only for independent applications and recent performance history.

### Task 4: Final verification and metric refresh

**Files:**

- Modify after fresh output: `docs/project-status.md`
- Modify after fresh output: `docs/project-status.zh-CN.md`
- Modify after fresh output: `tests/unit/docs/public-contract-docs.test.ts`

- [x] **Step 1: Format the changed slice**

Run Prettier only on the migration design/plan, both runbooks, readiness files, documentation tests,
evidence JSON, and synchronized public docs.

- [x] **Step 2: Run the full local release gate**

Run:

```bash
pnpm release:check
```

Expected: release readiness, quality, coverage, package/adoption/Operations Console smoke,
benchmarks, browser e2e, and DevTools extension e2e all pass.

- [x] **Step 3: Refresh final metrics from the gate output**

Update only the beta.5 Vitest file/test counts or coverage values that changed. Keep package tests,
browser e2e, DevTools e2e, and benchmark claims aligned with the fresh output. Update the matching
documentation assertions before rerunning the focused docs test.

- [x] **Step 4: Run final integrity checks**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/one-zero-readiness.test.ts tests/unit/docs/public-contract-docs.test.ts
pnpm release:one-zero:check -- --report
git diff --check
git status --short --branch
```

Expected: focused tests pass, the readiness report has exactly two remaining failures, diff checking
passes, and all work remains local and uncommitted.

- [x] **Step 5: Preserve external-state boundaries**

Do not run `npm publish`, `npm unpublish`, `npm dist-tag`, `git push`, or any tag command. A future
commit or release requires a separate maintainer instruction.
