# CI Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run Solace's release readiness check in GitHub Actions CI.

**Architecture:** Keep the existing `quality` job and named CI steps. Add `pnpm release:readiness` after dependency installation and before format/typecheck/lint/build/test steps.

**Tech Stack:** GitHub Actions YAML, pnpm scripts, Node.js release readiness CLI, Markdown docs, Prettier.

---

## File Structure

- Modify `.github/workflows/ci.yml`: add `Release readiness` step.
- Modify `docs/release.md`: mention CI runs readiness before longer checks.
- Add `solace-project-log/solace-entries/2026-07-14-006-ci-release-readiness.md`: project log entry.
- Modify `solace-project-log/index.md`: add the 2026-07-14 `006` row.

No runtime source, package scripts, package exports, or publishability state should change.

---

### Task 1: Update CI Workflow

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add readiness step**

After:

```yaml
- name: Install dependencies
  run: pnpm install --frozen-lockfile
```

add:

```yaml
- name: Release readiness
  run: pnpm release:readiness
```

---

### Task 2: Update Docs And Log

**Files:**

- Modify: `docs/release.md`
- Add: `solace-project-log/solace-entries/2026-07-14-006-ci-release-readiness.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update release docs**

Add this sentence after the CI workflow sentence in `docs/release.md`:

```md
CI also runs `pnpm release:readiness` before the longer checks so package metadata and release script drift fail early.
```

- [ ] **Step 2: Add project log entry**

Create the project log entry with status `验证中`.

- [ ] **Step 3: Add index row**

Add a `006` row under the `2026-07-14` project log index.

---

### Task 3: Format And Validate

**Files:**

- All touched files.

- [ ] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write .github/workflows/ci.yml docs/release.md docs/superpowers/specs/2026-07-14-ci-release-readiness-design.md docs/superpowers/plans/2026-07-14-ci-release-readiness.md solace-project-log/solace-entries/2026-07-14-006-ci-release-readiness.md solace-project-log/index.md
```

Expected: exits with code 0.

- [ ] **Step 2: Run readiness**

Run:

```bash
pnpm release:readiness
```

Expected: exits with code 0.

- [ ] **Step 3: Run lint**

Run:

```bash
pnpm lint
```

Expected: exits with code 0.

- [ ] **Step 4: Run build**

Run:

```bash
pnpm build
```

Expected: exits with code 0.

- [ ] **Step 5: Run format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.

- [ ] **Step 6: Update project log validation table**

Set log status to `已完成` and replace pending validation rows with observed results.

- [ ] **Step 7: Run final format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.
