# Performance History Workflow SHA Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the scheduled performance-history workflow supply the checked-out commit SHA required by persisted browser history and record the same identity in jsdom history.

**Architecture:** Keep commit identity at the GitHub Actions job boundary so both benchmark steps inherit one trusted `${{ github.sha }}` value. Preserve the benchmark runners' existing validation and do not relax evidence requirements.

**Tech Stack:** GitHub Actions YAML, pnpm, Vitest.

---

### Task 1: Bind Scheduled History To The Checked-Out Commit

**Files:**

- Modify: `tests/unit/ci-workflow.test.ts`
- Modify: `.github/workflows/performance-history.yml`

- [x] **Step 1: Write the failing workflow contract test**

Add this assertion to the existing `accumulates benchmark history across scheduled CI dates` test:

```ts
expect(workflow).toContain("SOLACE_BENCHMARK_COMMIT_SHA: ${{ github.sha }}");
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm test -- tests/unit/ci-workflow.test.ts
```

Expected: FAIL because `.github/workflows/performance-history.yml` does not contain the required environment binding.

- [x] **Step 3: Add the minimal job-level environment binding**

Add this block to the `collect` job before `steps`:

```yaml
env:
  SOLACE_BENCHMARK_COMMIT_SHA: ${{ github.sha }}
```

Job scope intentionally supplies the same immutable checkout identity to both `pnpm benchmark` and `pnpm benchmark:browser`.

- [x] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
pnpm test -- tests/unit/ci-workflow.test.ts
```

Expected: PASS with all CI workflow tests green.

- [x] **Step 5: Run scoped delivery checks**

Run:

```bash
pnpm exec prettier --check .github/workflows/performance-history.yml tests/unit/ci-workflow.test.ts
git diff --check
```

Expected: both commands exit zero.

- [x] **Step 6: Preserve the external-state boundary**

Do not stage, commit, or push the workflow until the maintainer explicitly authorizes those Git operations. The schedule remains inactive until the workflow exists on the repository's default branch.
