# SFC Compiler Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the alpha `.solace` compiler and `@italone/solace/vite` plugin enough for documented beta usage, predictable diagnostics, and package-consumer validation.

**Architecture:** Keep the compiler as a small package-internal pipeline: `parseSFC`/`parseTemplate` produce an AST, `generateRender` produces Solace render code, and `compile` wraps script/style/template into a default component export. Add a compiler-specific diagnostic error type at the compiler boundary, preserve current runtime semantics, and let the Vite plugin convert compiler failures into Vite-friendly transform errors while keeping the current no-production-sourcemap package policy.

**Tech Stack:** TypeScript, Vite plugin API, Rollup package build, Vitest, jsdom, Playwright smoke coverage, pnpm.

---

## File Structure

- Modify `src/compiler/types.ts`: add compiler diagnostic types and source location shape.
- Modify `src/compiler/parse.ts`: add source offset tracking for block and template parse failures.
- Modify `src/compiler/index.ts`: export `SolaceCompileError`, normalize parser/codegen errors, and return diagnostics-friendly failures.
- Modify `src/vite/index.ts`: preserve `map: null`, expose an explicit plugin name, and rethrow compiler diagnostics with file context.
- Modify `tests/unit/compiler/parse.test.ts`: add failing tests for line/column diagnostics on missing closing tags, mismatched tags, and unclosed interpolations.
- Modify `tests/unit/compiler/compile.test.ts`: add failing tests for `SolaceCompileError` metadata.
- Create `tests/unit/vite/solace-plugin.test.ts`: unit-test transform filtering, successful transform result shape, and error context.
- Modify `tests/integration/package-exports.test.ts`: assert ESM and CJS `@italone/solace/vite` exports.
- Modify `scripts/package-consumer-smoke.mjs`: typecheck a consumer Vite config importing `solacePlugin` and default plugin export.
- Modify `docs/package-usage.md`, `docs/api.md`, `docs/api.zh-CN.md`, `docs/examples.md`, `readme.md`, and `readme.zh-CN.md`: document alpha SFC usage, syntax constraints, diagnostics, and source-map policy.

---

### Task 1: Compiler Diagnostic Type

**Files:**

- Modify: `src/compiler/types.ts`
- Modify: `src/compiler/index.ts`
- Test: `tests/unit/compiler/compile.test.ts`

- [ ] **Step 1: Write failing tests for compile diagnostics**

Append these tests to `tests/unit/compiler/compile.test.ts` inside the existing `describe("compile", () => { ... })` block:

```ts
it("throws SolaceCompileError with code and location for missing template", () => {
  try {
    compile("<script>const count = 0;</script>", { id: "/app/src/App.solace" });
    throw new Error("compile should have thrown");
  } catch (error) {
    expect(error).toMatchObject({
      name: "SolaceCompileError",
      code: "SFC_MISSING_TEMPLATE",
      filename: "/app/src/App.solace",
      message: "Missing <template> block",
    });
    expect((error as { loc?: unknown }).loc).toBeUndefined();
  }
});

it("throws SolaceCompileError with source location for parse errors", () => {
  const source = `
<template>
  <section>
    <span>{count</span>
  </section>
</template>
`;

  try {
    compile(source, { id: "/app/src/Broken.solace" });
    throw new Error("compile should have thrown");
  } catch (error) {
    expect(error).toMatchObject({
      name: "SolaceCompileError",
      code: "SFC_PARSE_ERROR",
      filename: "/app/src/Broken.solace",
      loc: { line: 4, column: 11 },
    });
    expect(String((error as Error).message)).toContain("Unclosed interpolation expression");
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm vitest run tests/unit/compiler/compile.test.ts
```

Expected: fails because `SolaceCompileError`, `code`, `filename`, and `loc` are not implemented.

- [ ] **Step 3: Add diagnostic types**

Add this to `src/compiler/types.ts` after `SFCDescriptor`:

```ts
export interface SourceLocation {
  offset: number;
  line: number;
  column: number;
}

export type SolaceCompileErrorCode =
  "SFC_MISSING_TEMPLATE" | "SFC_PARSE_ERROR" | "SFC_CODEGEN_ERROR";

export interface SolaceCompileErrorOptions {
  code: SolaceCompileErrorCode;
  message: string;
  filename?: string;
  loc?: SourceLocation;
  cause?: unknown;
}
```

- [ ] **Step 4: Implement `SolaceCompileError` and error wrapping**

In `src/compiler/index.ts`, replace the imports with:

```ts
import { createHash } from "node:crypto";

import { generateRender } from "./codegen";
import { parseSFC, parseTemplate } from "./parse";
import { scopeStyle } from "./style";
import type { SolaceCompileErrorOptions, SourceLocation } from "./types";
```

Add this class above `export interface CompileOptions`:

```ts
export class SolaceCompileError extends Error {
  readonly code: SolaceCompileErrorOptions["code"];
  readonly filename: string | undefined;
  readonly loc: SourceLocation | undefined;

  constructor(options: SolaceCompileErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "SolaceCompileError";
    this.code = options.code;
    this.filename = options.filename;
    this.loc = options.loc;
  }
}
```

Replace the start of `compile` through `generateRender` with:

```ts
export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const filename = options.id;
  const scopeId = filename ? hashId(filename) : undefined;
  const descriptor = wrapCompileStep(
    () => parseSFC(source),
    "SFC_PARSE_ERROR",
    filename,
  );

  if (descriptor.template === undefined) {
    throw new SolaceCompileError({
      code: "SFC_MISSING_TEMPLATE",
      message: "Missing <template> block",
      filename,
    });
  }

  const ast = wrapCompileStep(
    () => parseTemplate(descriptor.template ?? "", descriptor.templateOffset ?? 0, source),
    "SFC_PARSE_ERROR",
    filename,
  );
  const renderExpr = wrapCompileStep(
    () => generateRender(ast, { scopeId }),
    "SFC_CODEGEN_ERROR",
    filename,
  );
```

Add this helper below `compile`:

```ts
function wrapCompileStep<T>(
  step: () => T,
  code: SolaceCompileErrorOptions["code"],
  filename: string | undefined,
): T {
  try {
    return step();
  } catch (error) {
    if (error instanceof SolaceCompileError) {
      throw error;
    }

    const maybeLocated = error as { loc?: SourceLocation; message?: string };
    throw new SolaceCompileError({
      code,
      message: maybeLocated.message ?? "Solace SFC compile failed",
      filename,
      loc: maybeLocated.loc,
      cause: error,
    });
  }
}
```

- [ ] **Step 5: Run test and capture next failure**

Run:

```bash
pnpm vitest run tests/unit/compiler/compile.test.ts
```

Expected: still fails because `SFCDescriptor.templateOffset`, `parseTemplate(template, offset, source)`, and parse locations are not implemented yet.

- [ ] **Step 6: Commit diagnostic type scaffold**

Do not commit yet if tests do not pass. This task commits after Task 2 makes the tests pass.

---

### Task 2: Parser Source Locations

**Files:**

- Modify: `src/compiler/types.ts`
- Modify: `src/compiler/parse.ts`
- Test: `tests/unit/compiler/parse.test.ts`
- Test: `tests/unit/compiler/compile.test.ts`

- [ ] **Step 1: Write failing parser location tests**

Append these tests to `tests/unit/compiler/parse.test.ts`:

```ts
it("reports location for mismatched closing tags", () => {
  try {
    parseTemplate("<section>\n  <span>bad</strong>\n</section>", 10);
    throw new Error("parseTemplate should have thrown");
  } catch (error) {
    expect(error).toMatchObject({
      loc: { offset: 25, line: 2, column: 13 },
    });
    expect(String((error as Error).message)).toContain(
      "Mismatched closing tag: expected </span> but found </strong>",
    );
  }
});

it("reports location for unclosed interpolation", () => {
  try {
    parseTemplate("<p>{count</p>", 20);
    throw new Error("parseTemplate should have thrown");
  } catch (error) {
    expect(error).toMatchObject({
      loc: { offset: 23, line: 1, column: 4 },
    });
    expect(String((error as Error).message)).toContain("Unclosed interpolation expression");
  }
});
```

Update the `parseSFC` test `extracts template, script, and style blocks` with:

```ts
expect(result.templateOffset).toBeGreaterThan(0);
expect(result.scriptOffset).toBeGreaterThan(0);
expect(result.styleOffset).toBeGreaterThan(0);
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm vitest run tests/unit/compiler/parse.test.ts tests/unit/compiler/compile.test.ts
```

Expected: fails because offsets and `loc` fields are missing.

- [ ] **Step 3: Add offsets to descriptor type**

Update `SFCDescriptor` in `src/compiler/types.ts` to:

```ts
export interface SFCDescriptor {
  template: string | undefined;
  templateOffset: number | undefined;
  script: string | undefined;
  scriptOffset: number | undefined;
  style: string | undefined;
  styleOffset: number | undefined;
}
```

- [ ] **Step 4: Implement `ParseError` and location helpers**

In `src/compiler/parse.ts`, change the import to:

```ts
import type { Attribute, SFCDescriptor, SourceLocation, TemplateNode } from "./types";
```

Add this class and helpers below imports:

```ts
export class ParseError extends Error {
  readonly loc: SourceLocation;

  constructor(message: string, loc: SourceLocation) {
    super(message);
    this.name = "ParseError";
    this.loc = loc;
  }
}

function createLocation(source: string, offset: number): SourceLocation {
  const before = source.slice(0, offset);
  const lines = before.split("\n");

  return {
    offset,
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

function createParseError(source: string, offset: number, message: string): ParseError {
  return new ParseError(message, createLocation(source, offset));
}
```

- [ ] **Step 5: Track block offsets in `parseSFC`**

Replace `parseSFC` and `extractBlock` with:

```ts
export function parseSFC(source: string): SFCDescriptor {
  const template = extractBlock(source, "template");
  const script = extractBlock(source, "script");
  const style = extractBlock(source, "style");

  return {
    template: template?.content,
    templateOffset: template?.offset,
    script: script?.content,
    scriptOffset: script?.offset,
    style: style?.content,
    styleOffset: style?.offset,
  };
}

function extractBlock(
  source: string,
  tag: string,
): { content: string; offset: number } | undefined {
  const open = `<${tag}>`;
  const openIndex = source.indexOf(open);
  if (openIndex === -1) {
    return undefined;
  }

  const close = `</${tag}>`;
  const contentStart = openIndex + open.length;
  const closeIndex = source.indexOf(close, contentStart);
  if (closeIndex === -1) {
    throw createParseError(source, openIndex, `Missing closing tag </${tag}>`);
  }

  const rawContent = source.slice(contentStart, closeIndex);
  const trimmedStart = rawContent.length - rawContent.trimStart().length;

  return {
    content: rawContent.trim(),
    offset: contentStart + trimmedStart,
  };
}
```

- [ ] **Step 6: Add source-aware parser parameters**

Change `parseTemplate` signature to:

```ts
export function parseTemplate(
  template: string,
  sourceOffset = 0,
  source = template,
): TemplateNode[] {
```

Update every internal parser call so `sourceOffset` and `source` are passed through:

```ts
const result = parseElement(template, index, sourceOffset, source);
const result = parseInterpolation(template, index, sourceOffset, source);
```

Change helper signatures to include the same parameters where errors can occur:

```ts
function parseInterpolation(
  template: string,
  start: number,
  sourceOffset: number,
  source: string,
): { node: { type: "interpolation"; expression: string }; index: number };

function parseElement(
  template: string,
  start: number,
  sourceOffset: number,
  source: string,
): { node: TemplateNode; index: number };

function parseAttribute(
  template: string,
  start: number,
  sourceOffset: number,
  source: string,
): { attribute: Attribute; index: number };
```

- [ ] **Step 7: Replace parser throws with located errors**

Use these replacements in `src/compiler/parse.ts`:

```ts
throw createParseError(source, sourceOffset + start, "Unclosed interpolation expression");
```

```ts
throw createParseError(
  source,
  sourceOffset + closeStart - 2,
  `Mismatched closing tag: expected </${tag}> but found </${closeTag}>`,
);
```

```ts
throw createParseError(
  source,
  sourceOffset + valueStart - 1,
  `Unclosed attribute value for ${name}`,
);
```

```ts
throw createParseError(
  source,
  sourceOffset + index,
  `Unexpected character in attribute value for ${name}`,
);
```

- [ ] **Step 8: Run parser and compiler tests**

Run:

```bash
pnpm vitest run tests/unit/compiler/parse.test.ts tests/unit/compiler/compile.test.ts
```

Expected: all tests in both files pass.

- [ ] **Step 9: Commit diagnostics and locations**

Run:

```bash
git add src/compiler/types.ts src/compiler/parse.ts src/compiler/index.ts tests/unit/compiler/parse.test.ts tests/unit/compiler/compile.test.ts
git commit -m "feat: add SFC compiler diagnostics"
```

---

### Task 3: Vite Plugin Transform Contract

**Files:**

- Modify: `src/vite/index.ts`
- Create: `tests/unit/vite/solace-plugin.test.ts`

- [ ] **Step 1: Write failing Vite plugin tests**

Create `tests/unit/vite/solace-plugin.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { solacePlugin } from "../../../src/vite/index";

describe("solacePlugin", () => {
  it("ignores non-Solace files", () => {
    const plugin = solacePlugin();
    const result = plugin.transform?.call({} as never, "export default 1;", "/app/src/main.ts");

    expect(result).toBeNull();
  });

  it("transforms .solace files and keeps source maps disabled", () => {
    const plugin = solacePlugin();
    const result = plugin.transform?.call(
      {} as never,
      `<template><button>count</button></template>`,
      "/app/src/App.solace",
    );

    expect(result).toMatchObject({ map: null });
    expect((result as { code: string }).code).toContain(
      'import * as _Solace from "@italone/solace"',
    );
    expect((result as { code: string }).code).toContain('_Solace.h("button"');
  });

  it("adds Vite file context to compiler diagnostics", () => {
    const plugin = solacePlugin();

    expect(() =>
      plugin.transform?.call(
        {} as never,
        `<template><button>{count</button></template>`,
        "/app/src/Broken.solace",
      ),
    ).toThrow(/\/app\/src\/Broken\.solace:1:19/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm vitest run tests/unit/vite/solace-plugin.test.ts
```

Expected: fails because Vite plugin diagnostics are not formatted with file, line, and column.

- [ ] **Step 3: Implement Vite diagnostic formatting**

Replace `src/vite/index.ts` with:

```ts
import type { Plugin } from "vite";

import { compile, SolaceCompileError } from "../compiler/index";

export function solacePlugin(): Plugin {
  return {
    name: "solace-sfc",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith(".solace")) {
        return null;
      }

      try {
        const result = compile(code, { id });
        return {
          code: result.code,
          map: null,
        };
      } catch (error) {
        if (error instanceof SolaceCompileError) {
          throw new Error(formatViteCompileError(error));
        }

        throw error;
      }
    },
  };
}

function formatViteCompileError(error: SolaceCompileError): string {
  const location = error.loc
    ? `${error.filename ?? "unknown"}:${error.loc.line}:${error.loc.column}`
    : (error.filename ?? "unknown");

  return `[${error.code}] ${location} ${error.message}`;
}

export default solacePlugin;
```

- [ ] **Step 4: Run Vite plugin tests**

Run:

```bash
pnpm vitest run tests/unit/vite/solace-plugin.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit Vite plugin contract**

Run:

```bash
git add src/vite/index.ts tests/unit/vite/solace-plugin.test.ts
git commit -m "test: cover SFC Vite plugin contract"
```

---

### Task 4: Package Export And Consumer Smoke Coverage

**Files:**

- Modify: `tests/integration/package-exports.test.ts`
- Modify: `scripts/package-consumer-smoke.mjs`

- [ ] **Step 1: Write failing package export assertions**

In `tests/integration/package-exports.test.ts`, update the first test name to `builds root, JSX runtime, DevTools, and Vite artifacts` and add these assertions before the test ends:

```ts
expect(existsSync(resolve(root, "dist/vite.js"))).toBe(true);
expect(existsSync(resolve(root, "dist/vite.cjs"))).toBe(true);
expect(existsSync(resolve(root, "dist/vite.d.ts"))).toBe(true);
```

Add this test after `exports JSX runtime entry points`:

```ts
it("exports the public Vite plugin subpath", async () => {
  const vite = await import("@italone/solace/vite");

  expect(vite).toMatchObject({
    default: expect.any(Function),
    solacePlugin: expect.any(Function),
  });
});
```

Update `supports CommonJS package exports` by adding:

```ts
const vite = require("@italone/solace/vite") as Record<string, unknown>;
```

and before the end of the test:

```ts
expect(vite.default).toEqual(expect.any(Function));
expect(vite.solacePlugin).toEqual(expect.any(Function));
```

- [ ] **Step 2: Run package export tests to verify current coverage**

Run:

```bash
pnpm build && pnpm vitest run --config vitest.package.config.ts tests/integration/package-exports.test.ts
```

Expected: pass if current build already emits the Vite subpath; if it fails, fix `rollup.config.mjs` entry points before continuing.

- [ ] **Step 3: Extend consumer smoke TypeScript coverage**

In `scripts/package-consumer-smoke.mjs`, add this import to the generated `src/main.tsx` string:

```ts
import solacePlugin, { solacePlugin as namedSolacePlugin } from "@italone/solace/vite";
```

Add this after the DevTools setup in the same generated file:

```ts
const vitePlugin = solacePlugin();
const namedVitePlugin = namedSolacePlugin();
if (vitePlugin.name !== "solace-sfc" || namedVitePlugin.name !== "solace-sfc") {
  throw new Error("vite plugin export mismatch");
}
```

- [ ] **Step 4: Run package smoke**

Run:

```bash
pnpm package:smoke
```

Expected: package consumer smoke passes.

- [ ] **Step 5: Commit export coverage**

Run:

```bash
git add tests/integration/package-exports.test.ts scripts/package-consumer-smoke.mjs
git commit -m "test: cover Vite plugin package exports"
```

---

### Task 5: Public SFC Usage Documentation

**Files:**

- Modify: `docs/package-usage.md`
- Modify: `docs/api.md`
- Modify: `docs/api.zh-CN.md`
- Modify: `docs/examples.md`
- Modify: `readme.md`
- Modify: `readme.zh-CN.md`

- [ ] **Step 1: Update package usage docs**

In `docs/package-usage.md`, add this section after `## Use JSX`:

````markdown
## Use `.solace` Single-File Components

The `@italone/solace/vite` entry exposes the alpha Vite plugin for `.solace` files:

```ts
import { defineConfig } from "vite";
import solace from "@italone/solace/vite";

export default defineConfig({
  plugins: [solace()],
});
```

Current `.solace` files support one `<template>`, optional `<script>`, and optional `<style>` block.
Template expressions use JSX-like braces and runtime identifiers from the script block:

```solace
<template>
  <button class="counter" onClick={increment}>
    count: {count.value}
  </button>
</template>

<script>
  import { ref } from "@italone/solace";
  const count = ref(0);
  const increment = () => count.value++;
</script>

<style>
  .counter { color: blue; }
</style>
```

The compiler is an alpha surface. It intentionally supports a small syntax subset, reports compile
diagnostics through Vite transform errors, injects scoped styles at runtime, and currently returns
`map: null` to match the package policy of not publishing production source maps.
````

- [ ] **Step 2: Update API docs**

In `docs/api.md`, add this section after the public tooling entry points and before `## DevTools Subpath`:

````markdown
## Vite Plugin Subpath

Import the alpha `.solace` compiler plugin from `@italone/solace/vite`:

```ts
import solace, { solacePlugin } from "@italone/solace/vite";
```

Both the default export and named `solacePlugin` export create the same Vite plugin. The plugin
transforms files ending in `.solace`, returns JavaScript component modules, and leaves all other file
ids untouched. Compiler failures are reported as Vite transform errors that include the diagnostic
code, filename, line, and column when available.
````

- [ ] **Step 3: Update Chinese API docs**

In `docs/api.zh-CN.md`, add this section after the public tooling entry points and before `## DevTools 子路径`:

````markdown
## Vite Plugin 子路径

从 `@italone/solace/vite` 导入 alpha `.solace` compiler plugin：

```ts
import solace, { solacePlugin } from "@italone/solace/vite";
```

默认导出和具名 `solacePlugin` 导出会创建同一个 Vite plugin。该 plugin 只转换以 `.solace` 结尾的文件，返回 JavaScript component module，并保持其他文件 id 不变。Compiler failure 会作为 Vite transform error 抛出，并在可用时包含 diagnostic code、filename、line 和 column。
````

- [ ] **Step 4: Update examples docs and READMEs**

In `docs/examples.md`, add the SFC example to the examples list with:

```markdown
- `examples/sfc-counter`: `.solace` single-file component example using `@italone/solace/vite`.
```

In `readme.md`, add one sentence under `## Examples`:

```markdown
The `examples/sfc-counter` app demonstrates the alpha `.solace` compiler and Vite plugin.
```

In `readme.zh-CN.md`, add the matching sentence under `## 示例`:

```markdown
`examples/sfc-counter` 应用演示 alpha `.solace` compiler 和 Vite plugin。
```

- [ ] **Step 5: Format touched docs**

Run:

```bash
pnpm exec prettier --write docs/package-usage.md docs/api.md docs/api.zh-CN.md docs/examples.md readme.md readme.zh-CN.md
```

Expected: files are formatted.

- [ ] **Step 6: Run docs-relevant quality checks**

Run:

```bash
pnpm format:check
pnpm test tests/unit/devtools/devtools-docs.test.ts
```

Expected: both commands pass.

- [ ] **Step 7: Commit docs**

Run:

```bash
git add docs/package-usage.md docs/api.md docs/api.zh-CN.md docs/examples.md readme.md readme.zh-CN.md
git commit -m "docs: document alpha SFC compiler usage"
```

---

### Task 6: Final Stabilization Gate

**Files:**

- No code edits unless a prior validation failure identifies a concrete bug.

- [ ] **Step 1: Run targeted compiler and Vite tests**

Run:

```bash
pnpm vitest run tests/unit/compiler/parse.test.ts tests/unit/compiler/compile.test.ts tests/unit/vite/solace-plugin.test.ts tests/integration/sfc-compiler.test.ts
```

Expected: all targeted tests pass.

- [ ] **Step 2: Run quality gate**

Run:

```bash
pnpm quality
```

Expected: format check, typecheck, JSX dev typecheck, lint, unit/integration tests, build, and package export tests pass.

- [ ] **Step 3: Run package smoke**

Run:

```bash
pnpm package:smoke
```

Expected: packed consumer smoke passes and validates `@italone/solace/vite` ESM/CJS imports plus TypeScript usage.

- [ ] **Step 4: Record final status**

Run:

```bash
git status -sb
git log --oneline -5
```

Expected: working tree clean; latest commits include the compiler diagnostics, Vite plugin contract, export coverage, and docs commits.

---

## Self-Review

- Spec coverage: The plan covers the roadmap item `SFC compiler stabilization` through compiler diagnostics, Vite plugin transform behavior, package export/consumer smoke coverage, and public docs.
- Scope boundary: The plan does not add router, SSR, hydration, DevTools UI, or a broader template language. Those remain separate beta tasks.
- Placeholder scan: Each implementation task includes exact file paths, code snippets, commands, and expected outcomes.
- Type consistency: Diagnostic names are consistently `SolaceCompileError`, `SourceLocation`, `SolaceCompileErrorCode`, and `SolaceCompileErrorOptions`. The Vite public export remains `solacePlugin` plus default export.
