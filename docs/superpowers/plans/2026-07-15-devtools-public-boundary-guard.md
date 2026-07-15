# DevTools Public Boundary Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guard the current package boundary so internal DevTools helpers remain private.

**Architecture:** Extend package export tests with negative assertions for root DevTools helper names and the missing
`solace/devtools` subpath. Do not change package exports.

**Tech Stack:** TypeScript, Vitest package exports config, Rollup build artifacts, Markdown docs, Prettier.

---

## File Structure

- Modify `tests/integration/package-exports.test.ts`: add DevTools negative export assertions.
- Modify `docs/devtools.md`: record the public package boundary guard.
- Add `docs/superpowers/specs/2026-07-15-devtools-public-boundary-guard-design.md`: record design.
- Add `solace-project-log/solace-entries/2026-07-15-001-devtools-public-boundary-guard.md`: project log entry.
- Modify `solace-project-log/index.md`: add the 2026-07-15 `001` row.

No `package.json`, `src/index.ts`, package export map, public API, browser extension, DevTools UI, production build flag,
or runtime instrumentation should change.

---

### Task 1: Add Package Boundary Guard Tests

**Files:**

- Modify: `tests/integration/package-exports.test.ts`

- [x] **Step 1: Extend root negative assertions**

Assert the `solace` root API does not contain:

- `clearDevtoolsListeners`
- `createDevtoolsRecorder`
- `emitDevtoolsEvent`
- `onDevtoolsEvent`
- `serializeDevtoolsEvent`

- [x] **Step 2: Add missing subpath assertion**

Assert dynamic `import("solace/devtools")` rejects.

- [x] **Step 3: Verify package exports pass**

Run:

```bash
pnpm test:package
```

Expected: exits with code 0.

---

### Task 2: Update Docs And Log

**Files:**

- Modify: `docs/devtools.md`
- Add: `docs/superpowers/specs/2026-07-15-devtools-public-boundary-guard-design.md`
- Add: `docs/superpowers/plans/2026-07-15-devtools-public-boundary-guard.md`
- Add: `solace-project-log/solace-entries/2026-07-15-001-devtools-public-boundary-guard.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Update DevTools docs**

Record package export guard as complete and keep recommendation focused on public API lifecycle design.

- [x] **Step 2: Add project log entry**

Create a log entry with validation commands and results.

- [x] **Step 3: Add index row**

Add a `001` row under a new 2026-07-15 project log section.

---

### Task 3: Format And Validate

**Files:**

- All touched files.

- [x] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write tests/integration/package-exports.test.ts docs/devtools.md docs/superpowers/specs/2026-07-15-devtools-public-boundary-guard-design.md docs/superpowers/plans/2026-07-15-devtools-public-boundary-guard.md solace-project-log/solace-entries/2026-07-15-001-devtools-public-boundary-guard.md solace-project-log/index.md
```

Expected: exits with code 0.

- [x] **Step 2: Run package export tests**

Run:

```bash
pnpm test:package
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
