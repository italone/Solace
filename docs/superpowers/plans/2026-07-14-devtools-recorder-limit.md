# DevTools Recorder Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bounded capture support to the internal DevTools recorder.

**Architecture:** Extend `createDevtoolsRecorder()` with an optional `limit`. Validate the limit at recorder creation and
trim the recorder's internal serialized event array after each event.

**Tech Stack:** TypeScript, Vitest, internal DevTools event bus, Markdown docs, Prettier.

---

## File Structure

- Modify `src/devtools/events.ts`: add `DevtoolsRecorderOptions` and limit trimming.
- Modify `tests/unit/devtools/devtools-events.test.ts`: add limit and invalid limit coverage.
- Modify `docs/devtools.md`: document bounded recorder captures.
- Add `docs/superpowers/specs/2026-07-14-devtools-recorder-limit-design.md`: record design.
- Add `solace-project-log/solace-entries/2026-07-14-017-devtools-recorder-limit.md`: project log entry.
- Modify `solace-project-log/index.md`: add the 2026-07-14 `017` row.

No `src/index.ts`, package export map, public API, runtime event emission, persistence, upload, or UI should change.

---

### Task 1: Add Failing Tests

**Files:**

- Modify: `tests/unit/devtools/devtools-events.test.ts`

- [x] **Step 1: Add bounded recorder test**

Create a recorder with `{ limit: 2 }`, emit three component events, and assert `snapshot()` contains only the latest two.

- [x] **Step 2: Add invalid limit test**

Assert `createDevtoolsRecorder({ limit: 0 })` and `createDevtoolsRecorder({ limit: 1.5 })` throw
`DevTools recorder limit must be a positive integer`.

- [x] **Step 3: Verify tests fail**

Run:

```bash
pnpm exec vitest run tests/unit/devtools/devtools-events.test.ts
```

Expected: fails because `limit` is ignored and invalid limits are accepted.

---

### Task 2: Implement Recorder Limit

**Files:**

- Modify: `src/devtools/events.ts`

- [x] **Step 1: Add options interface**

Add:

```ts
export interface DevtoolsRecorderOptions {
  limit?: number;
}
```

- [x] **Step 2: Validate and trim**

Validate positive integer limits in `createDevtoolsRecorder(options)`. After pushing each serialized event, trim old
events from the front when `events.length > limit`.

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
- Add: `docs/superpowers/specs/2026-07-14-devtools-recorder-limit-design.md`
- Add: `docs/superpowers/plans/2026-07-14-devtools-recorder-limit.md`
- Add: `solace-project-log/solace-entries/2026-07-14-017-devtools-recorder-limit.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Update DevTools docs**

Record `createDevtoolsRecorder({ limit })` bounded capture behavior.

- [x] **Step 2: Add project log entry**

Create a log entry with validation commands and results.

- [x] **Step 3: Add index row**

Add a `017` row under the 2026-07-14 project log section.

---

### Task 4: Format And Validate

**Files:**

- All touched files.

- [x] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write src/devtools/events.ts tests/unit/devtools/devtools-events.test.ts docs/devtools.md docs/superpowers/specs/2026-07-14-devtools-recorder-limit-design.md docs/superpowers/plans/2026-07-14-devtools-recorder-limit.md solace-project-log/solace-entries/2026-07-14-017-devtools-recorder-limit.md solace-project-log/index.md
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
