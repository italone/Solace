# Define Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `defineComponent()` as a public component declaration helper without changing runtime component behavior.

**Architecture:** Implement `defineComponent(component)` as a focused identity helper over the existing function component contract while preserving the input function's exact type. Export it from the package root, verify it mounts through the current renderer, and document it as a semantic/type helper rather than an options API.

**Tech Stack:** TypeScript, Vitest, Rollup, pnpm, Prettier.

---

### Task 1: Component Helper Behavior

**Files:**

- Create: `src/component/define-component.ts`
- Modify: `src/index.ts`
- Modify: `tests/unit/component/component.test.ts`

- [x] **Step 1: Write failing tests**

Add tests showing `defineComponent()` components mount normally and receive props.

- [x] **Step 2: Verify RED**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: fail because `defineComponent` is not exported.

- [x] **Step 3: Implement minimal helper**

Create `defineComponent<Props, Result>(component)` so it returns the input component unchanged while preserving the component function's exact props and return type.

- [x] **Step 4: Verify GREEN**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: pass.

### Task 2: Public Package Surface And Docs

**Files:**

- Modify: `tests/integration/package-exports.test.ts`
- Modify: `scripts/package-consumer-smoke.mjs`
- Modify: `docs/api.md`
- Modify: `readme.md`
- Modify: `solace-project-log/index.md`
- Create: `solace-project-log/solace-entries/2026-07-13-005-define-component.md`

- [x] **Step 1: Add package export assertions**

Assert `defineComponent` is available from both ESM and CJS package root imports.

- [x] **Step 2: Update smoke consumer**

Use `defineComponent()` in the temporary packed consumer fixture.

- [x] **Step 3: Document public API**

Add `defineComponent()` to `docs/api.md` and README current API list, and remove it from the README candidate API sentence.

- [x] **Step 4: Validate**

Run: `pnpm format:check`, `pnpm test tests/unit/component/component.test.ts`, `pnpm test:package`, `pnpm package:smoke`, and `pnpm quality`.

Commits are not applicable because the current directory is not a Git repository.
