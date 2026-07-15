# DevTools Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document DevTools candidate capabilities and safe future hook boundaries without changing runtime code.

**Architecture:** Add `docs/devtools.md` as a planning document. Update README to link it and update the project log.

**Tech Stack:** Markdown docs, Prettier.

---

## File Structure

- Add `docs/devtools.md`: DevTools evaluation and phased roadmap.
- Modify `readme.md`: link the DevTools evaluation under current docs / next steps.
- Add `solace-project-log/solace-entries/2026-07-14-007-devtools-evaluation.md`: project log entry.
- Modify `solace-project-log/index.md`: add the 2026-07-14 `007` row.

No runtime source, package scripts, package exports, tests, or CI workflow should change.

---

### Task 1: Add DevTools Evaluation Doc

**Files:**

- Add: `docs/devtools.md`

- [ ] **Step 1: Create documentation**

Create `docs/devtools.md` with sections for goals, non-goals, candidate panels, hook boundaries, privacy/performance risks, and phased roadmap.

---

### Task 2: Update README And Log

**Files:**

- Modify: `readme.md`
- Add: `solace-project-log/solace-entries/2026-07-14-007-devtools-evaluation.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Link DevTools docs in README**

Add `docs/devtools.md` near existing docs links and update the DevTools next-step bullet.

- [ ] **Step 2: Add project log entry**

Create the project log entry with status `验证中`.

- [ ] **Step 3: Add index row**

Add a `007` row under the `2026-07-14` project log index.

---

### Task 3: Format And Validate

**Files:**

- All touched files.

- [ ] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write docs/devtools.md readme.md docs/superpowers/specs/2026-07-14-devtools-evaluation-design.md docs/superpowers/plans/2026-07-14-devtools-evaluation.md solace-project-log/solace-entries/2026-07-14-007-devtools-evaluation.md solace-project-log/index.md
```

Expected: exits with code 0.

- [ ] **Step 2: Run format check**

Run:

```bash
pnpm format:check
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

- [ ] **Step 5: Update project log validation table**

Set log status to `已完成` and replace pending validation rows with observed results.

- [ ] **Step 6: Run final format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.
