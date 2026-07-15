# Scheduler DevTools Flush Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit an internal DevTools `scheduler:flush` summary after scheduler jobs flush.

**Architecture:** Reuse the internal DevTools event bus. The scheduler checks whether listeners exist before measuring time or constructing payloads, preserving the no-listener fast path.

**Tech Stack:** TypeScript, Vitest, internal DevTools event bus, Markdown docs, Prettier.

---

## File Structure

- Modify `tests/unit/scheduler/scheduler.test.ts`: add TDD coverage for `scheduler:flush`.
- Modify `src/scheduler/scheduler.ts`: emit flush summaries when DevTools listeners exist.
- Modify `docs/devtools.md`: record scheduler flush summary as the first runtime hook.
- Add `solace-project-log/solace-entries/2026-07-14-009-scheduler-devtools-flush.md`: project log entry.
- Modify `solace-project-log/index.md`: add the 2026-07-14 `009` row.

No package root export, package export map, component hook, renderer hook, or public API should change.

---

### Task 1: Add Failing Scheduler Test

**Files:**

- Modify: `tests/unit/scheduler/scheduler.test.ts`

- [ ] **Step 1: Add DevTools imports and cleanup**

Import `clearDevtoolsListeners`, `onDevtoolsEvent`, and `type DevtoolsEvent` from `../../../src/devtools/events`.
Add `afterEach(clearDevtoolsListeners)`.

- [ ] **Step 2: Add scheduler flush test**

Add a test that queues two jobs, awaits `nextTick`, and expects one `scheduler:flush` event with `queuedJobs: 2` and
non-negative `durationMs`.

- [ ] **Step 3: Verify test fails**

Run:

```bash
pnpm exec vitest run tests/unit/scheduler/scheduler.test.ts
```

Expected: fails because no scheduler DevTools event is emitted yet.

---

### Task 2: Implement Scheduler Hook

**Files:**

- Modify: `src/scheduler/scheduler.ts`

- [ ] **Step 1: Import DevTools helpers**

Import `emitDevtoolsEvent` and `hasDevtoolsListeners`.

- [ ] **Step 2: Emit scheduler flush event**

Track executed jobs and duration when listeners exist, then emit `scheduler:flush` in `finally`.

- [ ] **Step 3: Verify scheduler tests pass**

Run:

```bash
pnpm exec vitest run tests/unit/scheduler/scheduler.test.ts
```

Expected: exits with code 0.

---

### Task 3: Update Docs And Log

**Files:**

- Modify: `docs/devtools.md`
- Add: `solace-project-log/solace-entries/2026-07-14-009-scheduler-devtools-flush.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update DevTools docs**

Record that scheduler flush summaries now emit through the internal event bus.

- [ ] **Step 2: Add project log entry**

Create log entry with status `验证中`.

- [ ] **Step 3: Add index row**

Add a `009` row under the 2026-07-14 project log section.

---

### Task 4: Format And Validate

**Files:**

- All touched files.

- [ ] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write src/scheduler/scheduler.ts tests/unit/scheduler/scheduler.test.ts docs/devtools.md docs/superpowers/specs/2026-07-14-scheduler-devtools-flush-design.md docs/superpowers/plans/2026-07-14-scheduler-devtools-flush.md solace-project-log/solace-entries/2026-07-14-009-scheduler-devtools-flush.md solace-project-log/index.md
```

Expected: exits with code 0.

- [ ] **Step 2: Run scheduler tests**

Run:

```bash
pnpm exec vitest run tests/unit/scheduler/scheduler.test.ts
```

Expected: exits with code 0.

- [ ] **Step 3: Run full tests**

Run:

```bash
pnpm test
```

Expected: exits with code 0.

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: exits with code 0.

- [ ] **Step 5: Run lint**

Run:

```bash
pnpm lint
```

Expected: exits with code 0.

- [ ] **Step 6: Run build**

Run:

```bash
pnpm build
```

Expected: exits with code 0.

- [ ] **Step 7: Run format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.

- [ ] **Step 8: Update project log validation table**

Set log status to `已完成` and replace pending validation rows with observed results.

- [ ] **Step 9: Run final format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.
