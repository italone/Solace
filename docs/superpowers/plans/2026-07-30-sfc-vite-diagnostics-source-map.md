# SFC Vite Diagnostics And Source Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the alpha `.solace` compiler and `@italone/solace/vite` contract explicit for diagnostics and source-map behavior without expanding SFC syntax or public APIs.

**Architecture:** Keep the public surface unchanged and move only the contract-hardening pieces behind small internal helpers. One helper should format compiler diagnostics consistently for compiler/Vite consumers; another should centralize the Vite transform result shape so `map: null` stays deliberate. Tests should prove the contract from the compiler layer, the Vite layer, and the public package boundary.

**Tech Stack:** TypeScript, Vitest, Vite plugin hooks, pnpm, Rollup, package smoke tests, Markdown docs.

---

## File Structure

- Create `src/compiler/diagnostics.ts`: internal formatter for stable `SolaceCompileError` messages.
- Create `src/vite/transform-result.ts`: internal factory for Vite transform results with `map: null`.
- Modify `src/vite/index.ts`: route compiler failures through the shared diagnostics formatter and use the shared transform-result factory.
- Modify `tests/unit/compiler/compile.test.ts`: tighten direct compiler error assertions.
- Create `tests/unit/compiler/diagnostics.test.ts`: lock the diagnostic formatter contract.
- Modify `tests/unit/vite/solace-plugin.test.ts`: assert the exact transform error format and preserve `map: null`.
- Create `tests/unit/vite/transform-result.test.ts`: lock the Vite source-map policy helper.
- Modify `tests/unit/vite/public-contract-types.test.ts`: keep the plugin contract narrow and explicit.
- Modify `docs/api.md`, `docs/api.zh-CN.md`, `docs/package-usage.md`, `docs/project-status.md`, `docs/project-status.zh-CN.md`: document diagnostics and source-map policy.

---

### Task 1: Compiler Diagnostics Formatter

**Files:**

- Create: `src/compiler/diagnostics.ts`
- Modify: `src/vite/index.ts`
- Modify: `tests/unit/compiler/compile.test.ts`
- Create: `tests/unit/compiler/diagnostics.test.ts`

- [ ] **Step 1: Write the failing diagnostic formatter tests**

Create `tests/unit/compiler/diagnostics.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { SolaceCompileError } from "../../../src/compiler";
import { formatSolaceCompileError } from "../../../src/compiler/diagnostics";

describe("compiler diagnostics", () => {
  it("formats compiler errors with filename and location", () => {
    const error = new SolaceCompileError({
      code: "SFC_PARSE_ERROR",
      message: "Unclosed interpolation expression",
      filename: "/app/src/Broken.solace",
      loc: { offset: 23, line: 1, column: 4 },
      cause: new SyntaxError("bad interpolation"),
    });

    expect(formatSolaceCompileError(error)).toBe(
      "[SFC_PARSE_ERROR] /app/src/Broken.solace:1:4 Unclosed interpolation expression",
    );
  });

  it("formats compiler errors without a filename", () => {
    const error = new SolaceCompileError({
      code: "SFC_MISSING_TEMPLATE",
      message: "Missing <template> block",
      cause: new Error("missing template"),
    });

    expect(formatSolaceCompileError(error)).toBe(
      "[SFC_MISSING_TEMPLATE] unknown Missing <template> block",
    );
  });
});
```

Add one direct compiler assertion in `tests/unit/compiler/compile.test.ts`:

```ts
expect(error).toMatchObject({
  name: "SolaceCompileError",
  code: "SFC_PARSE_ERROR",
  filename: "/app/src/Broken.solace",
  loc: { line: 4, column: 11 },
  cause: expect.any(Error),
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run:

```bash
pnpm vitest run tests/unit/compiler/diagnostics.test.ts tests/unit/compiler/compile.test.ts
```

Expected: the diagnostics test fails first because `src/compiler/diagnostics.ts` does not exist yet.

- [ ] **Step 3: Implement the formatter and wire it into Vite**

Create `src/compiler/diagnostics.ts`:

```ts
import type { SolaceCompileError } from "./index";

export function formatSolaceCompileError(error: SolaceCompileError): string {
  const location = error.loc
    ? `${error.filename ?? "unknown"}:${error.loc.line}:${error.loc.column}`
    : (error.filename ?? "unknown");

  return `[${error.code}] ${location} ${error.message}`;
}
```

Modify `src/vite/index.ts` to import the shared formatter:

```ts
import { formatSolaceCompileError } from "../compiler/diagnostics";
```

```ts
throw new Error(formatSolaceCompileError(error));
```

- [ ] **Step 4: Re-run the compiler diagnostics tests**

Run:

```bash
pnpm vitest run tests/unit/compiler/diagnostics.test.ts tests/unit/compiler/compile.test.ts tests/unit/vite/solace-plugin.test.ts
```

Expected: all compiler diagnostic assertions pass.

- [ ] **Step 5: Commit the diagnostics formatter**

Run:

```bash
git add src/compiler/diagnostics.ts src/vite/index.ts tests/unit/compiler/compile.test.ts tests/unit/compiler/diagnostics.test.ts tests/unit/vite/solace-plugin.test.ts
git commit -m "feat: stabilize sfc diagnostics formatting"
```

---

### Task 2: Vite Source Map Policy

**Files:**

- Create: `src/vite/transform-result.ts`
- Modify: `src/vite/index.ts`
- Create: `tests/unit/vite/transform-result.test.ts`
- Modify: `tests/unit/vite/solace-plugin.test.ts`
- Modify: `tests/unit/vite/public-contract-types.test.ts`

- [ ] **Step 1: Write the failing source-map policy test**

Create `tests/unit/vite/transform-result.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createSolaceTransformResult } from "../../../src/vite/transform-result";

describe("solace Vite transform result policy", () => {
  it("always disables source maps for .solace transforms", () => {
    expect(createSolaceTransformResult("export default {}")).toEqual({
      code: "export default {}",
      map: null,
    });
  });
});
```

Add one explicit result assertion to `tests/unit/vite/solace-plugin.test.ts`:

```ts
expect(result).toMatchObject({ map: null });
```

Keep the existing `transform` diagnostics test, but make the expected message exact:

```ts
expect(() =>
  transformWith(plugin, "<template><button>{count</button></template>", "/app/src/Broken.solace"),
).toThrow("[SFC_PARSE_ERROR] /app/src/Broken.solace:1:19 Unclosed interpolation expression");
```

- [ ] **Step 2: Run the new source-map policy test to verify it fails**

Run:

```bash
pnpm vitest run tests/unit/vite/transform-result.test.ts tests/unit/vite/solace-plugin.test.ts
```

Expected: the source-map policy test fails first because `src/vite/transform-result.ts` does not exist yet.

- [ ] **Step 3: Implement the shared transform-result helper**

Create `src/vite/transform-result.ts`:

```ts
import type { TransformResult } from "vite";

export function createSolaceTransformResult(code: string): TransformResult {
  return { code, map: null };
}
```

Modify `src/vite/index.ts` to use it:

```ts
import { createSolaceTransformResult } from "./transform-result";
```

```ts
return createSolaceTransformResult(result.code);
```

- [ ] **Step 4: Re-run the Vite contract tests**

Run:

```bash
pnpm vitest run tests/unit/vite/transform-result.test.ts tests/unit/vite/solace-plugin.test.ts tests/unit/vite/public-contract-types.test.ts
```

Expected: the transform result helper and plugin contract checks pass.

- [ ] **Step 5: Commit the source-map policy helper**

Run:

```bash
git add src/vite/transform-result.ts src/vite/index.ts tests/unit/vite/transform-result.test.ts tests/unit/vite/solace-plugin.test.ts tests/unit/vite/public-contract-types.test.ts
git commit -m "feat: codify sfc source map policy"
```

---

### Task 3: Docs And Boundary Alignment

**Files:**

- Modify: `docs/api.md`
- Modify: `docs/api.zh-CN.md`
- Modify: `docs/package-usage.md`
- Modify: `docs/project-status.md`
- Modify: `docs/project-status.zh-CN.md`

- [ ] **Step 1: Update the English docs**

In `docs/api.md`, replace the SFC paragraph that ends with `do not import compiler or router deep subpaths such as @italone/solace/compiler, @italone/solace/router, or @italone/solace/dist/**.` with this:

```md
The `.solace` compiler contract is currently limited to the documented Vite plugin and the
`@italone/solace/sfc` type shim. The parser, generated JavaScript shape, and internal compiler
modules remain alpha implementation details. Scoped styles are registered through the public
`useStyle()` runtime helper, but generated module shape and compiler internals are not compatibility
targets. The Vite plugin does not accept public options yet; passing options throws a `TypeError` so
syntax expansion is not implied. SFC block attributes and custom top-level blocks are rejected; the
documented block model remains one `<template>`, optional `<script>`, and optional `<style>`. Vite
transform failures are the public diagnostics surface for invalid `.solace` files, and the current
transform policy intentionally returns `map: null` instead of publishing source maps. Do not import
compiler or router deep subpaths such as `@italone/solace/compiler`, `@italone/solace/router`, or
`@italone/solace/dist/**`.
```

In `docs/package-usage.md`, replace the paragraph that starts with `The public SFC contract is intentionally narrow:` with:

```md
The public SFC contract is intentionally narrow: use `@italone/solace/vite` as the Vite plugin and
`@italone/solace/sfc` as the TypeScript type shim for `.solace` imports. The compiler remains an
alpha surface. It supports a small syntax subset, reports compile diagnostics through Vite transform
errors, routes scoped styles through the public `useStyle()` runtime helper, and currently returns
`map: null` because source maps are not part of the alpha contract. Parser internals, generated
module shape, and scoped-style implementation details are not public compatibility targets. The
plugin does not accept public options yet; passing options throws a `TypeError`. SFC query
transforms such as `.solace?raw` are rejected until sub-request semantics are designed. SFC block
attributes and custom top-level blocks also throw so the syntax remains the documented one-template,
optional-script, optional-style model. The `@italone/solace/vite` subpath intentionally exports only
`default` and `solacePlugin`; do not import compiler helpers or deep subpaths such as
`@italone/solace/compiler`, `@italone/solace/router`, or `@italone/solace/dist/**`.
```

- [ ] **Step 2: Update the Chinese docs and project status wording**

In `docs/api.zh-CN.md`, replace the SFC contract paragraph with:

```md
`.solace` compiler 契约当前限于文档化的 Vite plugin 和 `@italone/solace/sfc` 类型声明入口。parser、生成 JavaScript 形状和内部 compiler modules 仍属于 alpha 实现细节。scoped style 会通过公开的 `useStyle()` runtime helper 注册，但生成模块形状和 compiler 内部实现不属于兼容性目标。Vite plugin 还没有公开 options；传入 options 会抛出 `TypeError`，避免暗示语法扩展。SFC block attributes 和自定义顶层 blocks 会被拒绝；文档化 block model 仍是一个 `<template>`、可选 `<script>` 和可选 `<style>`。无效 `.solace` 文件的公开 diagnostics surface 是 Vite transform failure，当前 transform policy 会有意返回 `map: null`，不发布 source maps。不要导入 `@italone/solace/compiler`、`@italone/solace/router` 或 `@italone/solace/dist/**` 这类 compiler/router deep subpaths。
```

In `docs/project-status.md`, update the SFC compiler evidence row to include:

```md
Vite transform diagnostics, explicit `map: null` source-map policy, rejected plugin options, and rejected `.solace?*` query transforms
```

In `docs/project-status.md`, update the SFC known-gap bullet so it says:

```md
The current `.solace` compiler and Vite plugin are documented for one `<template>`, optional `<script>`, optional `<style>`, Vite transform diagnostics, and explicit `map: null` source-map policy; syntax expansion remains deferred.
```

In `docs/project-status.zh-CN.md`, update the SFC compiler evidence row to include:

```md
Vite transform diagnostics、显式 `map: null` source-map policy、被拒绝的 plugin options 和被拒绝的 `.solace?*` query transforms
```

In `docs/project-status.zh-CN.md`, update the SFC known-gap bullet so it says:

```md
当前 `.solace` compiler 和 Vite plugin 已文档化为支持一个 `<template>`、可选 `<script>`、可选 `<style>`、Vite transform diagnostics 和显式 `map: null` source-map policy；语法扩展继续推迟。
```

- [ ] **Step 3: Verify the stale wording is gone**

Run:

```bash
rg -n "map: null|Vite transform diagnostics|source maps are not part of the alpha contract" docs/api.md docs/api.zh-CN.md docs/package-usage.md docs/project-status.md docs/project-status.zh-CN.md
```

Expected: the new wording appears in the updated files and the old stale phrases are gone from the
sections you replaced.

- [ ] **Step 4: Format the touched Markdown files**

Run:

```bash
pnpm exec prettier --write docs/api.md docs/api.zh-CN.md docs/package-usage.md docs/project-status.md docs/project-status.zh-CN.md
```

Expected: Prettier completes without errors.

- [ ] **Step 5: Commit the documentation alignment**

Run:

```bash
git add docs/api.md docs/api.zh-CN.md docs/package-usage.md docs/project-status.md docs/project-status.zh-CN.md
git commit -m "docs: align sfc diagnostics contract"
```

---

### Task 4: Final Validation

**Files:**

- Validate: `src/compiler/diagnostics.ts`
- Validate: `src/vite/transform-result.ts`
- Validate: `src/vite/index.ts`
- Validate: `tests/unit/compiler/diagnostics.test.ts`
- Validate: `tests/unit/vite/transform-result.test.ts`
- Validate: `tests/unit/vite/solace-plugin.test.ts`
- Validate: `tests/unit/vite/public-contract-types.test.ts`
- Validate: `tests/integration/sfc-compiler.test.ts`
- Validate: `docs/api.md`
- Validate: `docs/api.zh-CN.md`
- Validate: `docs/package-usage.md`
- Validate: `docs/project-status.md`
- Validate: `docs/project-status.zh-CN.md`

- [ ] **Step 1: Run the focused SFC contract tests**

Run:

```bash
pnpm vitest run tests/unit/compiler/diagnostics.test.ts tests/unit/compiler/compile.test.ts tests/unit/vite/transform-result.test.ts tests/unit/vite/solace-plugin.test.ts tests/unit/vite/public-contract-types.test.ts tests/integration/sfc-compiler.test.ts
```

Expected: all targeted SFC contract tests pass.

- [ ] **Step 2: Run the package-level validation**

Run:

```bash
pnpm quality
pnpm package:smoke
pnpm release:readiness -- --publishable
```

Expected: quality passes, package smoke passes, and publishable readiness stays green.

- [ ] **Step 3: Check the branch status before wrapping up**

Run:

```bash
git status --short --branch
git rev-list --left-right --count @{upstream}...HEAD
```

Expected: clean worktree and a clear ahead/behind count before any final report.
