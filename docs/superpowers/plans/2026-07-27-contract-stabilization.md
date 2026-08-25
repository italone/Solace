# Contract Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining contract-stabilization gaps for Solace's alpha SFC/Vite surface, beta router surface, and mandatory public API release gates without expanding SSR/SSG/hydration or DevTools extension UI scope.

**Architecture:** Treat documentation, package exports, package smoke, and release scripts as the public contract boundary. Keep implementation changes limited to drift-prevention tests and documentation consistency; do not add new SFC syntax, router features, package subpaths, SSR/SSG/hydration APIs, or browser DevTools extension UI.

**Tech Stack:** TypeScript, pnpm, Vite 8, Rollup, Vitest, Playwright, Node.js ESM scripts.

---

## File Structure

- Modify `readme.md`: fix the top-level positioning paragraph so it says the current alpha includes an alpha SFC compiler and beta router, while SSR/SSG/hydration and browser extension DevTools remain absent.
- Modify `readme.zh-CN.md`: mirror the English README positioning fix in Chinese.
- Modify `tests/unit/scripts/release-readiness-check.test.ts`: add a static script-contract test proving `release:check` starts with `pnpm release:readiness` and includes the mandatory public API gates.
- Modify `tests/integration/package-exports.test.ts`: add package export boundary tests for the documented public subpaths and router beta/deferred API split.
- Run existing validation gates: `pnpm release:readiness`, `pnpm package:smoke`, `pnpm test:e2e`, `pnpm quality`, and `pnpm release:check`.

---

### Task 1: README Positioning Drift

**Files:**

- Modify: `readme.md`
- Modify: `readme.zh-CN.md`

- [x] **Step 1: Replace the stale English README paragraph**

In `readme.md`, replace:

```md
Solace is suitable today for studying a compact frontend runtime, experimenting with reactive rendering, and validating framework implementation ideas in small examples. It is not yet positioned as a full replacement for React, Vue, Svelte, or other mature production frameworks. The current alpha does not include a compiler, router, SSR/SSG runtime, hydration, first-party UI components, browser extension DevTools, or a compatibility guarantee for internal modules.
```

With:

```md
Solace is suitable today for studying a compact frontend runtime, experimenting with reactive rendering, and validating framework implementation ideas in small examples. It is not yet positioned as a full replacement for React, Vue, Svelte, or other mature production frameworks. The current alpha includes an alpha `.solace` compiler, `@italone/solace/vite` plugin, and beta first-party router slice; it does not yet include SSR/SSG runtime, hydration, first-party UI components, browser extension DevTools, or a compatibility guarantee for internal modules.
```

- [x] **Step 2: Replace the stale Chinese README paragraph**

In `readme.zh-CN.md`, replace:

```md
Solace 当前适合用于学习小型前端运行时、实验响应式渲染，以及在小示例中验证框架实现思路。它还不是 React、Vue、Svelte 或其他成熟生产框架的完整替代品。当前 alpha 不包含 compiler、router、SSR/SSG runtime、hydration、一方 UI 组件、浏览器扩展 DevTools，也不为内部模块提供兼容性承诺。
```

With:

```md
Solace 当前适合用于学习小型前端运行时、实验响应式渲染，以及在小示例中验证框架实现思路。它还不是 React、Vue、Svelte 或其他成熟生产框架的完整替代品。当前 alpha 已包含 alpha `.solace` compiler、`@italone/solace/vite` plugin 和 beta 一方 router slice；它还不包含 SSR/SSG runtime、hydration、一方 UI 组件、浏览器扩展 DevTools，也不为内部模块提供兼容性承诺。
```

- [x] **Step 3: Verify the stale wording is gone**

Run:

```bash
rg -n "does not include a compiler, router|不包含 compiler、router" readme.md readme.zh-CN.md
```

Expected: no matches and exit code `1`.

- [x] **Step 4: Format the README files**

Run:

```bash
pnpm exec prettier --write readme.md readme.zh-CN.md
```

Expected: Prettier completes without errors.

- [x] **Step 5: Commit README drift fix**

Run:

```bash
git add readme.md readme.zh-CN.md
git commit -m "docs: align readme contract status"
```

Expected: commit succeeds.

---

### Task 2: Release Gate Contract Test

**Files:**

- Modify: `tests/unit/scripts/release-readiness-check.test.ts`

- [x] **Step 1: Add package JSON reader import**

Change the first filesystem import from:

```ts
import { mkdtemp, writeFile } from "node:fs/promises";
```

To:

```ts
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
```

- [x] **Step 2: Add the release gate drift test**

Append this test inside `describe("release readiness check CLI", () => { ... })`:

```ts
test("keeps release:check ordered around mandatory public API gates", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    scripts?: Record<string, string>;
  };
  const releaseCheck = packageJson.scripts?.["release:check"];

  expect(releaseCheck?.split(" && ")).toEqual([
    "pnpm release:readiness",
    "pnpm quality",
    "pnpm test:coverage",
    "pnpm package:smoke",
    "pnpm benchmark",
    "pnpm benchmark:browser",
    "pnpm test:e2e",
  ]);
});
```

- [x] **Step 3: Run the targeted script tests**

Run:

```bash
pnpm vitest run tests/unit/scripts/release-readiness-check.test.ts
```

Expected: all release readiness CLI tests pass.

- [x] **Step 4: Commit release gate contract test**

Run:

```bash
git add tests/unit/scripts/release-readiness-check.test.ts
git commit -m "test: lock public api release gates"
```

Expected: commit succeeds.

---

### Task 3: Package Export Boundary Tests

**Files:**

- Modify: `tests/integration/package-exports.test.ts`

- [x] **Step 1: Add the package export allowlist test**

Append this test after `it("builds root, JSX runtime, DevTools, and Vite artifacts", () => { ... })`:

```ts
it("keeps package exports limited to documented public entries", () => {
  const packageJson = require(resolve(root, "package.json")) as {
    exports: Record<string, unknown>;
  };

  expect(Object.keys(packageJson.exports).sort()).toEqual([
    ".",
    "./devtools",
    "./jsx-dev-runtime",
    "./jsx-runtime",
    "./package.json",
    "./sfc",
    "./vite",
  ]);
});
```

- [x] **Step 2: Add router beta/deferred API boundary assertions**

In `it("exports the public root API", async () => { ... })`, after the existing `expect(api).toMatchObject({ ... })` block, add:

```ts
expect(api).not.toHaveProperty("createMemoryHistory");
expect(api).not.toHaveProperty("NavigationGuard");
expect(api).not.toHaveProperty("RouteMeta");
expect(api).not.toHaveProperty("createSSRRouter");
```

- [x] **Step 3: Run package export tests**

Run:

```bash
pnpm build
pnpm vitest run --config vitest.package.config.ts tests/integration/package-exports.test.ts
```

Expected: build succeeds and package export tests pass.

- [x] **Step 4: Commit package boundary tests**

Run:

```bash
git add tests/integration/package-exports.test.ts
git commit -m "test: lock package contract boundary"
```

Expected: commit succeeds.

---

### Task 4: Focused Contract Validation

**Files:**

- Validate: `src/compiler/**`
- Validate: `src/vite/index.ts`
- Validate: `src/router/**`
- Validate: `tests/unit/compiler/**`
- Validate: `tests/unit/vite/solace-plugin.test.ts`
- Validate: `tests/unit/router/**`
- Validate: `tests/integration/router-component.test.ts`
- Validate: `tests/integration/package-exports.test.ts`

- [x] **Step 1: Run SFC/Vite unit and integration checks**

Run:

```bash
pnpm vitest run tests/unit/compiler/parse.test.ts tests/unit/compiler/compile.test.ts tests/unit/vite/solace-plugin.test.ts tests/integration/sfc-compiler.test.ts
```

Expected: all SFC compiler and Vite plugin tests pass.

- [x] **Step 2: Run router beta checks**

Run:

```bash
pnpm vitest run tests/unit/router/query.test.ts tests/unit/router/matcher.test.ts tests/unit/router/history.test.ts tests/unit/router/router.test.ts tests/integration/router-component.test.ts
```

Expected: all router beta tests pass.

- [x] **Step 3: Run release readiness**

Run:

```bash
pnpm release:readiness
```

Expected: prints `release readiness check passed` and reports `public API gates: pnpm release:readiness, pnpm package:smoke, pnpm test:e2e`.

- [x] **Step 4: Run package consumer smoke**

Run:

```bash
pnpm package:smoke
```

Expected: packed consumer install, typecheck, ESM/CJS imports, and Vite `.solace` production build pass.

- [x] **Step 5: Run browser e2e**

Run:

```bash
pnpm test:e2e
```

Expected: Playwright e2e tests pass, including `router-basic` and `sfc-counter`.

- [x] **Step 6: Run full quality**

Run:

```bash
pnpm quality
```

Expected: format check, typecheck, JSX dev typecheck, lint, unit/integration tests, and package tests pass.

---

### Task 5: Release Readiness Gate

**Files:**

- Validate: `package.json`
- Validate: `scripts/release-readiness-check.mjs`
- Validate: package build artifacts through the release script
- Validate: examples and browser benchmark through the release script

- [x] **Step 1: Run the full release gate**

Run:

```bash
pnpm release:check
```

Expected: `release:readiness`, `quality`, `test:coverage`, `package:smoke`, `benchmark`, `benchmark:browser`, and `test:e2e` all pass.

- [x] **Step 2: Confirm final Git state**

Run:

```bash
git status --short --branch
```

Expected: `main...origin/main [ahead N]` with no changed files. The ahead count must be reported because push to GitHub may still be blocked by network.

- [x] **Step 3: Do not publish from an unsynchronized branch**

If `git status --short --branch` reports `[ahead N]`, do not run `npm publish`. Report that the local branch must either be synchronized with `origin/main` or the team must explicitly accept releasing the local commits.
