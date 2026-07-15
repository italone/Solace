# Watch Effect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `watchEffect()` as a public Solace reactivity API with stop support and package export coverage.

**Architecture:** Implement `watchEffect()` beside `watch()` in `src/reactivity/watch.ts` using the existing `ReactiveEffect` primitive. Export it from `src/index.ts`, document it in API docs and README, and verify both source-level behavior and built package root exports.

**Tech Stack:** TypeScript, Vitest, Rollup, pnpm, Prettier.

---

### Task 1: Reactivity Behavior

**Files:**

- Modify: `tests/unit/reactivity/computed-watch.test.ts`
- Modify: `src/reactivity/watch.ts`
- Modify: `src/index.ts`

- [x] **Step 1: Write failing tests**

Add tests showing that `watchEffect()` runs immediately, reruns when a tracked dependency changes, and returns a stop function.

- [x] **Step 2: Verify RED**

Run: `pnpm test tests/unit/reactivity/computed-watch.test.ts`

Expected: fail because `watchEffect` is not exported.

- [x] **Step 3: Implement minimal API**

Add `watchEffect(fn)` with a `ReactiveEffect`, run it once, and return a stop handle.

- [x] **Step 4: Verify GREEN**

Run: `pnpm test tests/unit/reactivity/computed-watch.test.ts`

Expected: pass.

### Task 2: Package Root And Docs

**Files:**

- Modify: `tests/integration/package-exports.test.ts`
- Modify: `docs/api.md`
- Modify: `readme.md`
- Modify: `solace-project-log/index.md`
- Create: `solace-project-log/solace-entries/2026-07-13-003-watch-effect.md`

- [x] **Step 1: Write failing package export assertion**

Add `watchEffect: expect.any(Function)` to the package root API assertion.

- [x] **Step 2: Verify RED if needed**

Run: `pnpm test:package`

Expected: fail until the built package includes the new export.

- [x] **Step 3: Document API**

Add `watchEffect()` to `docs/api.md` and README public API lists; remove it from the “candidate API” sentence.

- [x] **Step 4: Validate**

Run: `pnpm format:check`, `pnpm typecheck`, `pnpm test tests/unit/reactivity/computed-watch.test.ts`, `pnpm test:package`, and `pnpm quality`.

Commits are not applicable because the current directory is not a Git repository.
