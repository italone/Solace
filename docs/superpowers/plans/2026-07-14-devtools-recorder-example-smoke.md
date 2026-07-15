# DevTools Recorder Example Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate the internal DevTools recorder with an example-shaped interaction.

**Architecture:** Add a `clear()` method to the internal recorder so tests can focus on one interaction window. Add a
todo-style integration smoke that uses the recorder without changing package exports or example app source.

**Tech Stack:** TypeScript, Vitest, internal DevTools event bus, Markdown docs, Prettier.

---

## File Structure

- Modify `src/devtools/events.ts`: add `clear()` to `DevtoolsRecorder`.
- Modify `tests/unit/devtools/devtools-events.test.ts`: add recorder clear coverage.
- Add `tests/integration/devtools-recorder-example-smoke.test.ts`: add todo-style recorder smoke.
- Modify `docs/devtools.md`: document recorder `clear()` and example smoke.
- Add `docs/superpowers/specs/2026-07-14-devtools-recorder-example-smoke-design.md`: record design.
- Add `solace-project-log/solace-entries/2026-07-14-016-devtools-recorder-example-smoke.md`: project log entry.
- Modify `solace-project-log/index.md`: add the 2026-07-14 `016` row.

No `src/index.ts`, package export map, public API, browser extension, DevTools UI, example source, persistence, network
upload, or raw event object recording should change.

---

### Task 1: Add Failing Tests

**Files:**

- Modify: `tests/unit/devtools/devtools-events.test.ts`
- Add: `tests/integration/devtools-recorder-example-smoke.test.ts`

- [x] **Step 1: Add recorder clear unit coverage**

Create a recorder, emit an event, call `clear()`, emit another event, and assert only the second event remains while the
recorder is still subscribed.

- [x] **Step 2: Add example-oriented smoke**

Render a todo-style component and store, call `recorder.clear()` after initial mount, click an add button, await
`nextTick()`, and assert the recorder captured serialized reactivity, store, renderer, component, and scheduler events.

- [x] **Step 3: Verify tests fail**

Run:

```bash
pnpm exec vitest run tests/unit/devtools/devtools-events.test.ts tests/integration/devtools-recorder-example-smoke.test.ts
```

Expected: fails because `recorder.clear()` does not exist yet.

---

### Task 2: Implement Recorder Clear

**Files:**

- Modify: `src/devtools/events.ts`

- [x] **Step 1: Add clear to recorder interface**

Add `clear(): void` to `DevtoolsRecorder`.

- [x] **Step 2: Add clear implementation**

Return `clear: () => { events.length = 0; }` from `createDevtoolsRecorder()`.

- [x] **Step 3: Verify targeted tests pass**

Run:

```bash
pnpm exec vitest run tests/unit/devtools/devtools-events.test.ts tests/integration/devtools-recorder-example-smoke.test.ts
```

Expected: exits with code 0.

---

### Task 3: Update Docs And Log

**Files:**

- Modify: `docs/devtools.md`
- Add: `docs/superpowers/specs/2026-07-14-devtools-recorder-example-smoke-design.md`
- Add: `docs/superpowers/plans/2026-07-14-devtools-recorder-example-smoke.md`
- Add: `solace-project-log/solace-entries/2026-07-14-016-devtools-recorder-example-smoke.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Update DevTools docs**

Record recorder `clear()` and the example-oriented smoke.

- [x] **Step 2: Add project log entry**

Create a log entry with validation commands and results.

- [x] **Step 3: Add index row**

Add a `016` row under the 2026-07-14 project log section.

---

### Task 4: Format And Validate

**Files:**

- All touched files.

- [x] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write src/devtools/events.ts tests/unit/devtools/devtools-events.test.ts tests/integration/devtools-recorder-example-smoke.test.ts docs/devtools.md docs/superpowers/specs/2026-07-14-devtools-recorder-example-smoke-design.md docs/superpowers/plans/2026-07-14-devtools-recorder-example-smoke.md solace-project-log/solace-entries/2026-07-14-016-devtools-recorder-example-smoke.md solace-project-log/index.md
```

Expected: exits with code 0.

- [x] **Step 2: Run targeted tests**

Run:

```bash
pnpm exec vitest run tests/unit/devtools/devtools-events.test.ts tests/integration/devtools-recorder-example-smoke.test.ts
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
