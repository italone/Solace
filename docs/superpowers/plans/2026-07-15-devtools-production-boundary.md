# DevTools Production Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production artifact guard that prevents DevTools internals from being exposed through published sourcemaps.

**Architecture:** Extend the existing package exports integration test to inspect the built `dist` directory after `pnpm build`. Disable Rollup JavaScript sourcemap output so package builds ship JavaScript and declaration artifacts without `.map` files. Document the production boundary and record the change in the project log.

**Tech Stack:** TypeScript, Rollup, Vitest, Node `fs` and `path`, pnpm, Markdown, Prettier.

---

## File Structure

- Modify `tests/integration/package-exports.test.ts`: add a production artifact test that fails when `dist` contains `.map` files and keep the existing public API shape assertions.
- Modify `rollup.config.mjs`: stop producing JavaScript sourcemaps from the TypeScript transpile step and Rollup outputs.
- Modify `docs/devtools.md`: document that package production builds do not publish sourcemaps.
- Add `solace-project-log/solace-entries/2026-07-15-005-devtools-production-boundary.md`: record the change and validation results.
- Modify `solace-project-log/index.md`: add the `2026-07-15` `005` row after validation.

---

### Task 1: Add The RED Production Artifact Test

**Files:**

- Modify: `tests/integration/package-exports.test.ts`

- [ ] **Step 1: Import `readdirSync`**

Change the first import from:

```ts
import { existsSync } from "node:fs";
```

to:

```ts
import { existsSync, readdirSync } from "node:fs";
```

- [ ] **Step 2: Add the production sourcemap guard**

Add this test after `builds root and JSX runtime artifacts`:

```ts
it("does not publish production sourcemaps", () => {
  const sourcemaps = readdirSync(resolve(root, "dist"))
    .filter((entry) => entry.endsWith(".map"))
    .sort();

  expect(sourcemaps).toEqual([]);
});
```

- [ ] **Step 3: Verify RED**

Run:

```bash
pnpm test:package
```

Expected: fails because the current Rollup build emits `.map` files in `dist`.

---

### Task 2: Disable Production Sourcemaps

**Files:**

- Modify: `rollup.config.mjs`

- [ ] **Step 1: Stop TypeScript transform maps**

Change the custom TypeScript plugin option from:

```js
          sourceMap: true,
```

to:

```js
          sourceMap: false,
```

- [ ] **Step 2: Stop ESM Rollup output maps**

Change the ESM output from:

```js
        sourcemap: true,
```

to:

```js
        sourcemap: false,
```

- [ ] **Step 3: Stop CJS Rollup output maps**

Change the CJS output from:

```js
        sourcemap: true,
```

to:

```js
        sourcemap: false,
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
pnpm test:package
```

Expected: passes and `dist` contains no `.map` files.

---

### Task 3: Document And Log The Boundary

**Files:**

- Modify: `docs/devtools.md`
- Add: `solace-project-log/solace-entries/2026-07-15-005-devtools-production-boundary.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update DevTools docs**

In `docs/devtools.md`, add this paragraph after the recorder paragraph:

```md
Production package builds do not publish JavaScript sourcemaps. This keeps internal DevTools wiring visible in source
control but out of package artifacts, so consumers do not accidentally couple to private helper names or module layout.
```

- [ ] **Step 2: Add the project log entry**

Create `solace-project-log/solace-entries/2026-07-15-005-devtools-production-boundary.md` with observed validation rows
after running final validation.

- [ ] **Step 3: Update the project log index**

Add this row after `004` in the `2026-07-15` section:

```md
| 005 | 收紧 DevTools 生产构建边界 | package artifacts、Rollup sourcemaps、DevTools 文档、项目日志 | `rollup.config.mjs`, `tests/integration/package-exports.test.ts`, `docs/devtools.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-15-005-devtools-production-boundary.md) |
```

---

### Task 4: Final Validation

**Files:**

- All changed files

- [ ] **Step 1: Format changed files**

Run:

```bash
pnpm exec prettier --write rollup.config.mjs tests/integration/package-exports.test.ts docs/devtools.md docs/superpowers/specs/2026-07-15-devtools-production-boundary-design.md docs/superpowers/plans/2026-07-15-devtools-production-boundary.md solace-project-log/solace-entries/2026-07-15-005-devtools-production-boundary.md solace-project-log/index.md
```

Expected: exits with code 0.

- [ ] **Step 2: Run package boundary test**

Run:

```bash
pnpm test:package
```

Expected: exits with code 0.

- [ ] **Step 3: Run build**

Run:

```bash
pnpm build
```

Expected: exits with code 0 and emits no `.map` files.

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: exits with code 0.

- [ ] **Step 5: Run lint**

Run:

```bash
pnpm lint
```

Expected: exits with code 0.

- [ ] **Step 6: Run full tests**

Run:

```bash
pnpm test
```

Expected: exits with code 0.

- [ ] **Step 7: Run format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.

- [ ] **Step 8: Commit**

Run:

```bash
git add rollup.config.mjs tests/integration/package-exports.test.ts docs/devtools.md docs/superpowers/specs/2026-07-15-devtools-production-boundary-design.md docs/superpowers/plans/2026-07-15-devtools-production-boundary.md solace-project-log/solace-entries/2026-07-15-005-devtools-production-boundary.md solace-project-log/index.md
git commit -m "test: guard devtools production boundary"
```

Expected: creates a commit after validation passes.
