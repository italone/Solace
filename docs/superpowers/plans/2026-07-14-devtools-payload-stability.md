# DevTools Payload Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an internal DevTools payload stability smoke check before any public integration surface.

**Architecture:** Add an internal serializer that explicitly copies allowed fields for each `DevtoolsEvent` shape. Use an
integration test to capture runtime events across renderer, component, reactivity, store, and scheduler paths and verify
JSON-safe payloads.

**Tech Stack:** TypeScript, Vitest, internal DevTools event bus, Markdown docs, Prettier.

---

## File Structure

- Modify `src/devtools/events.ts`: add internal `serializeDevtoolsEvent()`.
- Add `tests/integration/devtools-payload-stability.test.ts`: integrated payload stability smoke.
- Modify `docs/devtools.md`: record serializer and payload stability status.
- Add `docs/superpowers/specs/2026-07-14-devtools-payload-stability-design.md`: record design.
- Add `solace-project-log/solace-entries/2026-07-14-014-devtools-payload-stability.md`: project log entry.
- Modify `solace-project-log/index.md`: add the 2026-07-14 `014` row.

No `src/index.ts`, package export map, public API, persisted telemetry, network upload, DevTools UI, DOM node payload,
VNode payload, props payload, children payload, raw reactive target payload, action args payload, return value payload, or
error payload should change.

---

### Task 1: Add Failing Tests

**Files:**

- Add: `tests/integration/devtools-payload-stability.test.ts`

- [x] **Step 1: Add integrated payload stability test**

Import `serializeDevtoolsEvent()` from the internal event bus. Capture events while rendering a component, running a
store action, awaiting the scheduled update, and replacing the component with a static element.

- [x] **Step 2: Assert event order and payload boundaries**

Assert the event stream includes renderer, component, reactivity, store, and scheduler events. Assert each event contains
only allowed keys, round-trips through JSON, and contains no object or function payload values.

- [x] **Step 3: Verify tests fail**

Run:

```bash
pnpm exec vitest run tests/integration/devtools-payload-stability.test.ts
```

Expected: fails because `serializeDevtoolsEvent()` does not exist yet.

---

### Task 2: Implement Internal Serializer

**Files:**

- Modify: `src/devtools/events.ts`

- [x] **Step 1: Add explicit serializer**

Add `serializeDevtoolsEvent(event)` with a `switch` over `event.type`. Return only the documented fields for each event
shape. Do not use object spread.

- [x] **Step 2: Verify payload stability test passes**

Run:

```bash
pnpm exec vitest run tests/integration/devtools-payload-stability.test.ts
```

Expected: exits with code 0.

---

### Task 3: Update Docs And Log

**Files:**

- Modify: `docs/devtools.md`
- Add: `docs/superpowers/specs/2026-07-14-devtools-payload-stability-design.md`
- Add: `docs/superpowers/plans/2026-07-14-devtools-payload-stability.md`
- Add: `solace-project-log/solace-entries/2026-07-14-014-devtools-payload-stability.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Update DevTools docs**

Record `serializeDevtoolsEvent()` as an internal helper and mark payload stability smoke as completed.

- [x] **Step 2: Add project log entry**

Create a log entry with validation commands and results.

- [x] **Step 3: Add index row**

Add a `014` row under the 2026-07-14 project log section.

---

### Task 4: Format And Validate

**Files:**

- All touched files.

- [x] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write src/devtools/events.ts tests/integration/devtools-payload-stability.test.ts docs/devtools.md docs/superpowers/specs/2026-07-14-devtools-payload-stability-design.md docs/superpowers/plans/2026-07-14-devtools-payload-stability.md solace-project-log/solace-entries/2026-07-14-014-devtools-payload-stability.md solace-project-log/index.md
```

Expected: exits with code 0.

- [x] **Step 2: Run payload stability test**

Run:

```bash
pnpm exec vitest run tests/integration/devtools-payload-stability.test.ts
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
