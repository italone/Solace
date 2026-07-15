# Provide Inject Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `provide()` and `inject()` as public component context APIs with parent-chain lookup and package export coverage.

**Architecture:** Reuse the existing `currentInstance` setup window from lifecycle registration. Add parent links and per-instance `provides` maps to component instances, pass the active parent instance through renderer `patch()` calls, and implement `provide()`/`inject()` in a focused component-context module.

**Tech Stack:** TypeScript, Vitest, Rollup, pnpm, Prettier.

---

### Task 1: Component Context Behavior

**Files:**

- Modify: `tests/unit/component/component.test.ts`
- Modify: `src/component/component.ts`
- Create: `src/component/provide.ts`
- Modify: `src/renderer/diff.ts`
- Modify: `src/index.ts`

- [x] **Step 1: Write failing tests**

Add tests for a child injecting a parent-provided value, an intermediate provider overriding an ancestor, symbol keys, and default values for missing keys.

- [x] **Step 2: Verify RED**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: fail because `provide` and `inject` are not exported.

- [x] **Step 3: Implement minimal context support**

Add `parent` and `provides` to `ComponentInstance`, pass parent instances from renderer component mount calls, and implement `provide()`/`inject()` with string or symbol keys.

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
- Create: `solace-project-log/solace-entries/2026-07-13-004-provide-inject.md`

- [x] **Step 1: Add package export assertions**

Assert `provide` and `inject` are available from both ESM and CJS package root imports.

- [x] **Step 2: Update smoke consumer**

Import `provide` and `inject` in the temporary packed consumer fixture and typecheck a parent-child usage.

- [x] **Step 3: Document public API**

Add `provide()` and `inject()` to `docs/api.md` and README current API list, and remove them from README candidate API sentence.

- [x] **Step 4: Validate**

Run: `pnpm format:check`, `pnpm test tests/unit/component/component.test.ts`, `pnpm test:package`, `pnpm package:smoke`, and `pnpm quality`.

Commits are not applicable because the current directory is not a Git repository.
