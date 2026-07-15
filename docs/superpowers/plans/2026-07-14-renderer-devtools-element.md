# Renderer DevTools Element Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit internal DevTools renderer element summaries for mount, update, and unmount.

**Architecture:** Extend the internal DevTools event union with a `renderer:element` summary. Emit listener-guarded events
from the existing element mount, patch, and unmount paths.

**Tech Stack:** TypeScript, Vitest, internal DevTools event bus, Markdown docs, Prettier.

---

## File Structure

- Modify `src/devtools/events.ts`: add the internal `renderer:element` event shape.
- Modify `src/renderer/diff.ts`: emit guarded element summary events from mount/update/unmount paths.
- Modify `tests/unit/renderer/diff.test.ts`: add TDD coverage for element summaries.
- Modify `docs/devtools.md`: record renderer element summaries as implemented.
- Add `docs/superpowers/specs/2026-07-14-renderer-devtools-element-design.md`: record design.
- Add `solace-project-log/solace-entries/2026-07-14-013-renderer-devtools-element.md`: project log entry.
- Modify `solace-project-log/index.md`: add the 2026-07-14 `013` row.

No `src/index.ts`, package export map, public API, DOM node payload, VNode payload, props payload, children payload, or
DevTools UI should change.

---

### Task 1: Add Failing Tests

**Files:**

- Modify: `tests/unit/renderer/diff.test.ts`

- [x] **Step 1: Add internal DevTools imports and cleanup**

Import `clearDevtoolsListeners`, `onDevtoolsEvent`, and `type DevtoolsEvent`. Add `afterEach(clearDevtoolsListeners)`.

- [x] **Step 2: Add element summary test**

Register a listener, render `p`, update `p`, replace it with `section`, and assert events:

- `{ type: "renderer:element", operation: "mount", tag: "p" }`
- `{ type: "renderer:element", operation: "update", tag: "p" }`
- `{ type: "renderer:element", operation: "unmount", tag: "p" }`
- `{ type: "renderer:element", operation: "mount", tag: "section" }`

Assert events do not contain `node`, `el`, `vnode`, `props`, or `children`.

- [x] **Step 3: Verify tests fail**

Run:

```bash
pnpm exec vitest run tests/unit/renderer/diff.test.ts
```

Expected: fails because renderer element summaries are not emitted yet.

---

### Task 2: Implement Renderer Element Events

**Files:**

- Modify: `src/devtools/events.ts`
- Modify: `src/renderer/diff.ts`

- [x] **Step 1: Add event union member**

Add:

```ts
| {
    type: "renderer:element";
    operation: "mount" | "update" | "unmount";
    tag: string;
  }
```

- [x] **Step 2: Emit element summaries**

Import paths already have `emitDevtoolsEvent` and `hasDevtoolsListeners`. Emit after element insert, after element patch,
and after element remove.

- [x] **Step 3: Verify renderer tests pass**

Run:

```bash
pnpm exec vitest run tests/unit/renderer/diff.test.ts
```

Expected: exits with code 0.

---

### Task 3: Update Docs And Log

**Files:**

- Modify: `docs/devtools.md`
- Add: `docs/superpowers/specs/2026-07-14-renderer-devtools-element-design.md`
- Add: `docs/superpowers/plans/2026-07-14-renderer-devtools-element.md`
- Add: `solace-project-log/solace-entries/2026-07-14-013-renderer-devtools-element.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Update DevTools docs**

Record `renderer:element` summary fields and privacy boundary.

- [x] **Step 2: Add project log entry**

Create a log entry with validation commands and results.

- [x] **Step 3: Add index row**

Add a `013` row under the 2026-07-14 project log section.

---

### Task 4: Format And Validate

**Files:**

- All touched files.

- [x] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write src/devtools/events.ts src/renderer/diff.ts tests/unit/renderer/diff.test.ts docs/devtools.md docs/superpowers/specs/2026-07-14-renderer-devtools-element-design.md docs/superpowers/plans/2026-07-14-renderer-devtools-element.md solace-project-log/solace-entries/2026-07-14-013-renderer-devtools-element.md solace-project-log/index.md
```

Expected: exits with code 0.

- [x] **Step 2: Run renderer tests**

Run:

```bash
pnpm exec vitest run tests/unit/renderer/diff.test.ts
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
