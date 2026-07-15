# Component DevTools Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit internal DevTools component lifecycle summaries for mount, update, and unmount.

**Architecture:** Add internal component ids and name helper to component instances. Emit summary events from renderer lifecycle points through the existing internal DevTools event bus.

**Tech Stack:** TypeScript, Vitest, internal DevTools event bus, Markdown docs, Prettier.

---

## File Structure

- Modify `src/component/component.ts`: add `devtoolsId` and component name helper.
- Modify `src/renderer/diff.ts`: emit component lifecycle summary events.
- Modify `tests/unit/component/lifecycle.test.ts`: add TDD coverage for component DevTools lifecycle events.
- Modify `docs/devtools.md`: record component lifecycle summaries as implemented.
- Add `solace-project-log/solace-entries/2026-07-14-010-component-devtools-lifecycle.md`: project log entry.
- Modify `solace-project-log/index.md`: add the 2026-07-14 `010` row.

No `src/index.ts`, package export map, public API, props/state event payload, or DevTools UI should change.

---

### Task 1: Add Failing Tests

**Files:**

- Modify: `tests/unit/component/lifecycle.test.ts`

- [ ] **Step 1: Add internal DevTools imports and cleanup**

Import `clearDevtoolsListeners`, `onDevtoolsEvent`, and `type DevtoolsEvent`.
Add `afterEach(clearDevtoolsListeners)`.

- [ ] **Step 2: Add named component lifecycle event test**

Register a listener, render a named component, update reactive state, unmount it, and assert component events are:

- `component:mount`
- `component:update`
- `component:unmount`

with the same numeric id and name `Counter`.

- [ ] **Step 3: Add anonymous component fallback test**

Render an inline anonymous component and assert the mount event name is `AnonymousComponent`.

- [ ] **Step 4: Verify tests fail**

Run:

```bash
pnpm exec vitest run tests/unit/component/lifecycle.test.ts
```

Expected: fails because component events are not emitted yet.

---

### Task 2: Implement Component Lifecycle Events

**Files:**

- Modify: `src/component/component.ts`
- Modify: `src/renderer/diff.ts`

- [ ] **Step 1: Add component devtools id and name helper**

Add `devtoolsId` to `ComponentInstance`, assign it in `createComponentInstance`, and export
`getComponentDevtoolsName`.

- [ ] **Step 2: Emit lifecycle events from renderer**

Import `emitDevtoolsEvent`, `hasDevtoolsListeners`, and `getComponentDevtoolsName`. Emit mount/update/unmount
summary events after lifecycle hooks.

- [ ] **Step 3: Verify lifecycle tests pass**

Run:

```bash
pnpm exec vitest run tests/unit/component/lifecycle.test.ts
```

Expected: exits with code 0.

---

### Task 3: Update Docs And Log

**Files:**

- Modify: `docs/devtools.md`
- Add: `solace-project-log/solace-entries/2026-07-14-010-component-devtools-lifecycle.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update DevTools docs**

Record that component mount/update/unmount summaries are emitted through the internal event bus.

- [ ] **Step 2: Add project log entry**

Create log entry with status `验证中`.

- [ ] **Step 3: Add index row**

Add a `010` row under the 2026-07-14 project log section.

---

### Task 4: Format And Validate

**Files:**

- All touched files.

- [ ] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write src/component/component.ts src/renderer/diff.ts tests/unit/component/lifecycle.test.ts docs/devtools.md docs/superpowers/specs/2026-07-14-component-devtools-lifecycle-design.md docs/superpowers/plans/2026-07-14-component-devtools-lifecycle.md solace-project-log/solace-entries/2026-07-14-010-component-devtools-lifecycle.md solace-project-log/index.md
```

Expected: exits with code 0.

- [ ] **Step 2: Run lifecycle tests**

Run:

```bash
pnpm exec vitest run tests/unit/component/lifecycle.test.ts
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
