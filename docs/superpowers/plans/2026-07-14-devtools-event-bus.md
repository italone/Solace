# DevTools Event Bus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an internal DevTools event bus without exposing a public API or wiring runtime hooks.

**Architecture:** Create `src/devtools/events.ts` as a small listener registry. Tests import the internal module directly. No package root export changes are made.

**Tech Stack:** TypeScript, Vitest, Markdown docs, Prettier.

---

## File Structure

- Add `tests/unit/devtools/devtools-events.test.ts`: TDD coverage for internal event bus behavior.
- Add `src/devtools/events.ts`: internal event bus and event types.
- Modify `docs/devtools.md`: mark the internal event bus phase as implemented.
- Add `solace-project-log/solace-entries/2026-07-14-008-devtools-event-bus.md`: project log entry.
- Modify `solace-project-log/index.md`: add the 2026-07-14 `008` row.

No `src/index.ts`, package exports, runtime hook wiring, or UI files should change.

---

### Task 1: Add Failing Tests

**Files:**

- Add: `tests/unit/devtools/devtools-events.test.ts`

- [ ] **Step 1: Create tests**

Create tests that import from `../../../src/devtools/events` and cover:

- no-listener emit does not throw,
- listener receives event,
- unsubscribe removes listener,
- throwing listener logs and later listener still receives event.

- [ ] **Step 2: Verify tests fail**

Run:

```bash
pnpm exec vitest run tests/unit/devtools/devtools-events.test.ts
```

Expected: fails because `src/devtools/events.ts` does not exist.

---

### Task 2: Implement Internal Event Bus

**Files:**

- Add: `src/devtools/events.ts`

- [ ] **Step 1: Implement minimal module**

Implement event types, listener registration, emission, listener check, and cleanup.

- [ ] **Step 2: Verify targeted tests pass**

Run:

```bash
pnpm exec vitest run tests/unit/devtools/devtools-events.test.ts
```

Expected: exits with code 0.

---

### Task 3: Update Docs And Log

**Files:**

- Modify: `docs/devtools.md`
- Add: `solace-project-log/solace-entries/2026-07-14-008-devtools-event-bus.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update DevTools docs**

Update `docs/devtools.md` to state that the internal event bus exists and runtime hook integration is next.

- [ ] **Step 2: Add project log entry**

Create log entry with status `验证中`.

- [ ] **Step 3: Add index row**

Add a `008` row under the 2026-07-14 project log section.

---

### Task 4: Format And Validate

**Files:**

- All touched files.

- [ ] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write src/devtools/events.ts tests/unit/devtools/devtools-events.test.ts docs/devtools.md docs/superpowers/specs/2026-07-14-devtools-event-bus-design.md docs/superpowers/plans/2026-07-14-devtools-event-bus.md solace-project-log/solace-entries/2026-07-14-008-devtools-event-bus.md solace-project-log/index.md
```

Expected: exits with code 0.

- [ ] **Step 2: Run targeted test**

Run:

```bash
pnpm exec vitest run tests/unit/devtools/devtools-events.test.ts
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
