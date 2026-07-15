# CI Browser Benchmark Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align GitHub Actions CI with the local release gate by running the Chromium production browser benchmark.

**Architecture:** Keep the existing single `quality` job and step-by-step structure. Add `pnpm benchmark:browser` after Playwright browser installation and before ordinary e2e tests.

**Tech Stack:** GitHub Actions YAML, pnpm scripts, Playwright Chromium, Vite preview, Markdown docs, Prettier.

---

## File Structure

- Modify `.github/workflows/ci.yml`: add `Browser benchmark` step.
- Modify `docs/release.md`: mention CI also runs the browser benchmark.
- Add `solace-project-log/solace-entries/2026-07-14-005-ci-browser-benchmark-gate.md`: project log entry.
- Modify `solace-project-log/index.md`: add the 2026-07-14 `005` row.

No runtime source, package scripts, benchmark scenarios, or Playwright config should change.

---

### Task 1: Update CI Workflow

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add browser benchmark step**

In `.github/workflows/ci.yml`, after:

```yaml
- name: Install Playwright browsers
  run: pnpm exec playwright install --with-deps chromium
```

add:

```yaml
- name: Browser benchmark
  run: pnpm benchmark:browser
```

Keep the existing `E2E` step after it.

---

### Task 2: Update Docs And Log

**Files:**

- Modify: `docs/release.md`
- Add: `solace-project-log/solace-entries/2026-07-14-005-ci-browser-benchmark-gate.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update release docs**

In `docs/release.md`, after the Local Release Gate paragraph, add:

```md
The GitHub Actions CI workflow keeps these checks split into named steps and also runs both benchmark commands:
`pnpm benchmark` and `pnpm benchmark:browser`.
```

- [ ] **Step 2: Add project log entry**

Create `solace-project-log/solace-entries/2026-07-14-005-ci-browser-benchmark-gate.md` with status `验证中`, affected files, and pending validation rows.

- [ ] **Step 3: Add index row**

Add a `005` row under the `2026-07-14` project log index.

---

### Task 3: Format And Validate

**Files:**

- All touched files.

- [ ] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write .github/workflows/ci.yml docs/release.md docs/superpowers/specs/2026-07-14-ci-browser-benchmark-gate-design.md docs/superpowers/plans/2026-07-14-ci-browser-benchmark-gate.md solace-project-log/solace-entries/2026-07-14-005-ci-browser-benchmark-gate.md solace-project-log/index.md
```

Expected: exits with code 0.

- [ ] **Step 2: Run browser benchmark**

Run:

```bash
pnpm benchmark:browser
```

Expected: exits with code 0 and logs `browser benchmark summary`.

- [ ] **Step 3: Run format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.

- [ ] **Step 4: Update project log validation table**

Set log status to `已完成` and replace pending validation rows with observed results.

- [ ] **Step 5: Run final format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.
