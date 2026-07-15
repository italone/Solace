# DevTools Recorder Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an internal DevTools recorder boundary for examples and experiments.

**Architecture:** Build on the internal event bus and serializer. The recorder subscribes to DevTools events, stores
serialized payloads, returns snapshot copies, and unsubscribes on stop.

**Tech Stack:** TypeScript, Vitest, internal DevTools event bus, Markdown docs, Prettier.

---

## File Structure

- Modify `src/devtools/events.ts`: add `DevtoolsRecorder` and `createDevtoolsRecorder()`.
- Modify `tests/unit/devtools/devtools-events.test.ts`: add recorder unit coverage.
- Modify `docs/devtools.md`: document the internal recorder boundary.
- Add `docs/superpowers/specs/2026-07-14-devtools-recorder-boundary-design.md`: record design.
- Add `solace-project-log/solace-entries/2026-07-14-015-devtools-recorder-boundary.md`: project log entry.
- Modify `solace-project-log/index.md`: add the 2026-07-14 `015` row.

No `src/index.ts`, package export map, public API, browser extension, DevTools UI, persistence, network upload, or raw
event object recording should change.

---

### Task 1: Add Failing Tests

**Files:**

- Modify: `tests/unit/devtools/devtools-events.test.ts`

- [x] **Step 1: Add recorder import**

Import `createDevtoolsRecorder` from the internal event bus.

- [x] **Step 2: Add recorder behavior test**

Create a recorder, emit an event with an injected extra field, assert `snapshot()` returns the serialized event only,
mutate the returned snapshot, call `stop()`, emit another event, and assert recorder state did not change.

- [x] **Step 3: Verify tests fail**

Run:

```bash
pnpm exec vitest run tests/unit/devtools/devtools-events.test.ts
```

Expected: fails because `createDevtoolsRecorder()` does not exist yet.

---

### Task 2: Implement Recorder

**Files:**

- Modify: `src/devtools/events.ts`

- [x] **Step 1: Add recorder interface**

Add:

```ts
export interface DevtoolsRecorder {
  snapshot(): DevtoolsEvent[];
  stop(): void;
}
```

- [x] **Step 2: Add recorder factory**

Use `onDevtoolsEvent()` and `serializeDevtoolsEvent()` to collect serialized events. Return `snapshot: () => [...events]`
and `stop: unsubscribe`.

- [x] **Step 3: Verify DevTools event tests pass**

Run:

```bash
pnpm exec vitest run tests/unit/devtools/devtools-events.test.ts
```

Expected: exits with code 0.

---

### Task 3: Update Docs And Log

**Files:**

- Modify: `docs/devtools.md`
- Add: `docs/superpowers/specs/2026-07-14-devtools-recorder-boundary-design.md`
- Add: `docs/superpowers/plans/2026-07-14-devtools-recorder-boundary.md`
- Add: `solace-project-log/solace-entries/2026-07-14-015-devtools-recorder-boundary.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Update DevTools docs**

Record `createDevtoolsRecorder()` as an internal integration boundary.

- [x] **Step 2: Add project log entry**

Create a log entry with validation commands and results.

- [x] **Step 3: Add index row**

Add a `015` row under the 2026-07-14 project log section.

---

### Task 4: Format And Validate

**Files:**

- All touched files.

- [x] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write src/devtools/events.ts tests/unit/devtools/devtools-events.test.ts docs/devtools.md docs/superpowers/specs/2026-07-14-devtools-recorder-boundary-design.md docs/superpowers/plans/2026-07-14-devtools-recorder-boundary.md solace-project-log/solace-entries/2026-07-14-015-devtools-recorder-boundary.md solace-project-log/index.md
```

Expected: exits with code 0.

- [x] **Step 2: Run DevTools event tests**

Run:

```bash
pnpm exec vitest run tests/unit/devtools/devtools-events.test.ts
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

- [x] **Step 7: Run e2e**

Run:

```bash
pnpm test:e2e
```

Expected: exits with code 0.

- [x] **Step 8: Run format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.
