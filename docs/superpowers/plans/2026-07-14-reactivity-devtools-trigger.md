# Reactivity DevTools Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit internal DevTools reactivity trigger summaries for direct and scheduled effects.

**Architecture:** Extend the internal DevTools event union with a `reactivity:trigger` summary. Count active direct and
scheduled effects inside `trigger()` and emit only privacy-preserving summary fields.

**Tech Stack:** TypeScript, Vitest, internal DevTools event bus, Markdown docs, Prettier.

---

## File Structure

- Modify `src/devtools/events.ts`: add the internal `reactivity:trigger` event shape.
- Modify `src/reactivity/effect.ts`: emit guarded trigger summary events from `trigger()`.
- Modify `tests/unit/reactivity/reactive-effect.test.ts`: add TDD coverage for direct and scheduled effect summaries.
- Modify `docs/devtools.md`: record reactivity trigger summaries as implemented.
- Add `docs/superpowers/specs/2026-07-14-reactivity-devtools-trigger-design.md`: record design.
- Add `solace-project-log/solace-entries/2026-07-14-012-reactivity-devtools-trigger.md`: project log entry.
- Modify `solace-project-log/index.md`: add the 2026-07-14 `012` row.

No `src/index.ts`, package export map, public API, raw target payload, raw key payload, raw value payload, dependency
payload, or DevTools UI should change.

---

### Task 1: Add Failing Tests

**Files:**

- Modify: `tests/unit/reactivity/reactive-effect.test.ts`

- [x] **Step 1: Add internal DevTools imports and cleanup**

Import `clearDevtoolsListeners`, `onDevtoolsEvent`, and `type DevtoolsEvent`. Add `afterEach(clearDevtoolsListeners)`.

- [x] **Step 2: Add direct effect summary test**

Register a listener, run an effect, mutate a dependency, and assert a `reactivity:trigger` event with:

- `targetType: "object"`
- `keyType: "string"`
- `effectCount: 1`
- `scheduledEffects: 0`
- `runEffects: 1`

Assert the event does not contain `target`, `key`, `value`, or `effects`.

- [x] **Step 3: Add scheduled effect summary test**

Register a listener, create a `watch()` dependency, mutate it, and assert a `reactivity:trigger` event with:

- `targetType: "object"`
- `keyType: "string"`
- `effectCount: 1`
- `scheduledEffects: 1`
- `runEffects: 0`

- [x] **Step 4: Verify tests fail**

Run:

```bash
pnpm exec vitest run tests/unit/reactivity/reactive-effect.test.ts
```

Expected: fails because reactivity trigger summaries are not emitted yet.

---

### Task 2: Implement Reactivity Trigger Events

**Files:**

- Modify: `src/devtools/events.ts`
- Modify: `src/reactivity/effect.ts`

- [x] **Step 1: Add event union member**

Add:

```ts
| {
    type: "reactivity:trigger";
    targetType: string;
    keyType: string;
    effectCount: number;
    scheduledEffects: number;
    runEffects: number;
  }
```

- [x] **Step 2: Emit trigger summary from `trigger()`**

Import `emitDevtoolsEvent`, `hasDevtoolsListeners`, and `type DevtoolsEvent`. Count direct and scheduled active effects
while preserving existing execution order. Emit the summary after the trigger loop only when a listener exists.

- [x] **Step 3: Verify reactivity tests pass**

Run:

```bash
pnpm exec vitest run tests/unit/reactivity/reactive-effect.test.ts
```

Expected: exits with code 0.

---

### Task 3: Update Docs And Log

**Files:**

- Modify: `docs/devtools.md`
- Add: `docs/superpowers/specs/2026-07-14-reactivity-devtools-trigger-design.md`
- Add: `docs/superpowers/plans/2026-07-14-reactivity-devtools-trigger.md`
- Add: `solace-project-log/solace-entries/2026-07-14-012-reactivity-devtools-trigger.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Update DevTools docs**

Record `reactivity:trigger` summary fields and privacy boundary.

- [x] **Step 2: Add project log entry**

Create a log entry with validation commands and results.

- [x] **Step 3: Add index row**

Add a `012` row under the 2026-07-14 project log section.

---

### Task 4: Format And Validate

**Files:**

- All touched files.

- [x] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write src/devtools/events.ts src/reactivity/effect.ts tests/unit/reactivity/reactive-effect.test.ts docs/devtools.md docs/superpowers/specs/2026-07-14-reactivity-devtools-trigger-design.md docs/superpowers/plans/2026-07-14-reactivity-devtools-trigger.md solace-project-log/solace-entries/2026-07-14-012-reactivity-devtools-trigger.md solace-project-log/index.md
```

Expected: exits with code 0.

- [x] **Step 2: Run reactivity tests**

Run:

```bash
pnpm exec vitest run tests/unit/reactivity/reactive-effect.test.ts
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
