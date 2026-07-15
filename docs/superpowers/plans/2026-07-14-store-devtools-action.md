# Store DevTools Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit internal DevTools store action summaries for success and error outcomes.

**Architecture:** Extend the internal DevTools event union with a `store:action` summary. Wrap store actions in
`createStore` with a listener-guarded path that preserves existing return and throw behavior.

**Tech Stack:** TypeScript, Vitest, internal DevTools event bus, Markdown docs, Prettier.

---

## File Structure

- Modify `src/devtools/events.ts`: add the internal `store:action` event shape.
- Modify `src/store/store.ts`: emit guarded action summary events from the existing action wrapper.
- Modify `tests/unit/store/store.test.ts`: add TDD coverage for success and error summaries.
- Modify `docs/devtools.md`: record store action summaries as implemented.
- Add `docs/superpowers/specs/2026-07-14-store-devtools-action-design.md`: record design.
- Add `solace-project-log/solace-entries/2026-07-14-011-store-devtools-action.md`: project log entry.
- Modify `solace-project-log/index.md`: add the 2026-07-14 `011` row.

No `src/index.ts`, package export map, public API, raw state payload, args payload, result payload, error payload, or
DevTools UI should change.

---

### Task 1: Add Failing Tests

**Files:**

- Modify: `tests/unit/store/store.test.ts`

- [x] **Step 1: Add internal DevTools imports and cleanup**

Import `clearDevtoolsListeners`, `onDevtoolsEvent`, and `type DevtoolsEvent`.
Add `afterEach(clearDevtoolsListeners)` and restore Vitest mocks.

- [x] **Step 2: Add successful action summary test**

Register a listener, run a store action, and assert a `store:action` event with:

- `name: "increment"`
- `status: "success"`
- `durationMs >= 0`

Assert the event does not contain `args`, `result`, or `state`.

- [x] **Step 3: Add failed action summary test**

Register a listener, run an action that throws, assert the original error is rethrown, and assert a `store:action` event
with:

- `name: "fail"`
- `status: "error"`
- `durationMs >= 0`

Assert the event does not contain `error` or `state`.

- [x] **Step 4: Verify tests fail**

Run:

```bash
pnpm exec vitest run tests/unit/store/store.test.ts
```

Expected: fails because store action summaries are not emitted yet.

---

### Task 2: Implement Store Action Events

**Files:**

- Modify: `src/devtools/events.ts`
- Modify: `src/store/store.ts`

- [x] **Step 1: Add event union member**

Add:

```ts
| {
    type: "store:action";
    name: string;
    status: "success" | "error";
    durationMs: number;
  }
```

- [x] **Step 2: Emit action summary from action wrapper**

Import `emitDevtoolsEvent`, `hasDevtoolsListeners`, and `type DevtoolsEvent`. If no listener is registered, call the
action directly. If a listener is registered, emit success or error after the action returns or throws.

- [x] **Step 3: Verify store tests pass**

Run:

```bash
pnpm exec vitest run tests/unit/store/store.test.ts
```

Expected: exits with code 0.

---

### Task 3: Update Docs And Log

**Files:**

- Modify: `docs/devtools.md`
- Add: `docs/superpowers/specs/2026-07-14-store-devtools-action-design.md`
- Add: `docs/superpowers/plans/2026-07-14-store-devtools-action.md`
- Add: `solace-project-log/solace-entries/2026-07-14-011-store-devtools-action.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Update DevTools docs**

Record `store:action` summary fields and privacy boundary.

- [x] **Step 2: Add project log entry**

Create a log entry with validation commands and results.

- [x] **Step 3: Add index row**

Add an `011` row under the 2026-07-14 project log section.

---

### Task 4: Format And Validate

**Files:**

- All touched files.

- [x] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write src/devtools/events.ts src/store/store.ts tests/unit/store/store.test.ts docs/devtools.md docs/superpowers/specs/2026-07-14-store-devtools-action-design.md docs/superpowers/plans/2026-07-14-store-devtools-action.md solace-project-log/solace-entries/2026-07-14-011-store-devtools-action.md solace-project-log/index.md
```

Expected: exits with code 0.

- [x] **Step 2: Run store tests**

Run:

```bash
pnpm exec vitest run tests/unit/store/store.test.ts
```

Expected: exits with code 0.

- [x] **Step 3: Run full tests**

Run:

```bash
pnpm test
```

Expected: exits with code 0.

- [x] **Step 4: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: exits with code 0.

- [x] **Step 5: Run lint**

Run:

```bash
pnpm lint
```

Expected: exits with code 0.

- [x] **Step 6: Run build**

Run:

```bash
pnpm build
```

Expected: exits with code 0.

- [x] **Step 7: Run format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.
