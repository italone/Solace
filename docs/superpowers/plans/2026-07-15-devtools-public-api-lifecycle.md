# DevTools Public API Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a verifiable lifecycle policy for the `solace/devtools` public API.

**Architecture:** Add a docs contract test that requires a `## Public API Lifecycle` section, update DevTools docs with lifecycle rules, and tighten package exports tests so `solace/devtools` has an exact JavaScript export list.

**Tech Stack:** TypeScript, Vitest, package exports, Node filesystem APIs, Markdown, Prettier.

---

## File Structure

- Create `tests/unit/devtools/devtools-docs.test.ts`: document lifecycle policy coverage.
- Modify `tests/integration/package-exports.test.ts`: exact runtime export list for `solace/devtools`.
- Modify `docs/devtools.md`: add public API lifecycle policy.
- Add `solace-project-log/solace-entries/2026-07-15-008-devtools-public-api-lifecycle.md`: record change and validation.
- Modify `solace-project-log/index.md`: add 2026-07-15 row `008`.

No runtime framework source, package export map, Rollup config, event payload shape, or browser benchmark harness should change.

---

### Task 1: Add Failing Lifecycle Docs Test

**Files:**

- Create: `tests/unit/devtools/devtools-docs.test.ts`

- [x] **Step 1: Add docs lifecycle contract test**

Create `tests/unit/devtools/devtools-docs.test.ts`:

```ts
import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";

describe("DevTools documentation", () => {
  test("documents the public API lifecycle policy", async () => {
    const docs = await readFile("docs/devtools.md", "utf8");

    expect(docs).toContain("## Public API Lifecycle");
    expect(docs).toContain("New runtime exports require package boundary tests");
    expect(docs).toContain("Event payload additions must remain small serializable summaries");
    expect(docs).toContain("Renames or removals require an intentional breaking-change plan");
    expect(docs).toContain("Internal helpers remain private");
  });
});
```

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm test -- tests/unit/devtools/devtools-docs.test.ts
```

Expected: fails because `docs/devtools.md` does not yet contain `## Public API Lifecycle`.

---

### Task 2: Tighten Public DevTools Export Boundary

**Files:**

- Modify: `tests/integration/package-exports.test.ts`

- [x] **Step 1: Add exact JavaScript export list assertion**

In `exports the public DevTools subpath without internal emit helpers`, after importing `devtools`, add:

```ts
expect(Object.keys(devtools).sort()).toEqual(["createDevtoolsRecorder", "onDevtoolsEvent"]);
```

Keep the existing positive and negative assertions.

- [x] **Step 2: Verify package boundary**

Run:

```bash
pnpm test:package
```

Expected: exits with code 0 because the current public runtime keys already match the intended lifecycle boundary.

---

### Task 3: Document Public API Lifecycle

**Files:**

- Modify: `docs/devtools.md`

- [x] **Step 1: Add lifecycle policy section**

After the `## Public API` section, add:

```md
## Public API Lifecycle

`solace/devtools` is the only supported public DevTools entry point. New runtime exports require package boundary tests,
packed consumer smoke coverage, documentation, and a project log entry before they are treated as supported API.

Event payload additions must remain small serializable summaries and must update payload stability coverage. They should
not include raw props, state, DOM nodes, VNodes, reactive targets, action arguments, action results, stack traces, or
user content.

Renames or removals require an intentional breaking-change plan. Internal helpers remain private even when public APIs
reuse them internally, and incidental runtime cleanup must not change the public subpath shape.
```

- [x] **Step 2: Verify docs test GREEN**

Run:

```bash
pnpm test -- tests/unit/devtools/devtools-docs.test.ts
```

Expected: exits with code 0.

---

### Task 4: Document And Log

**Files:**

- Add: `solace-project-log/solace-entries/2026-07-15-008-devtools-public-api-lifecycle.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Add project log entry**

Create `solace-project-log/solace-entries/2026-07-15-008-devtools-public-api-lifecycle.md` with observed validation rows.

- [x] **Step 2: Update project log index**

Add this row after `007` under `2026-07-15`:

```md
| 008 | 补充 DevTools public API lifecycle guard | DevTools 文档、package exports、文档契约测试、项目日志 | `docs/devtools.md`, `tests/integration/package-exports.test.ts`, `tests/unit/devtools/devtools-docs.test.ts`, `solace-project-log/**` | [查看](./solace-entries/2026-07-15-008-devtools-public-api-lifecycle.md) |
```

---

### Task 5: Final Validation

**Files:**

- All changed files

- [x] **Step 1: Format changed files**

Run:

```bash
pnpm exec prettier --write docs/devtools.md tests/integration/package-exports.test.ts tests/unit/devtools/devtools-docs.test.ts docs/superpowers/specs/2026-07-15-devtools-public-api-lifecycle-design.md docs/superpowers/plans/2026-07-15-devtools-public-api-lifecycle.md solace-project-log/solace-entries/2026-07-15-008-devtools-public-api-lifecycle.md solace-project-log/index.md
```

Expected: exits with code 0.

- [x] **Step 2: Run docs test**

Run:

```bash
pnpm test -- tests/unit/devtools/devtools-docs.test.ts
```

Expected: exits with code 0.

- [x] **Step 3: Run package exports**

Run:

```bash
pnpm test:package
```

Expected: exits with code 0.

- [x] **Step 4: Run full tests**

Run:

```bash
pnpm test
```

Expected: exits with code 0.

- [x] **Step 5: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: exits with code 0.

- [x] **Step 6: Run lint**

Run:

```bash
pnpm lint
```

Expected: exits with code 0.

- [x] **Step 7: Run build**

Run:

```bash
pnpm build
```

Expected: exits with code 0.

- [x] **Step 8: Run format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.

- [x] **Step 9: Commit**

Run:

```bash
git add docs/devtools.md tests/integration/package-exports.test.ts tests/unit/devtools/devtools-docs.test.ts docs/superpowers/specs/2026-07-15-devtools-public-api-lifecycle-design.md docs/superpowers/plans/2026-07-15-devtools-public-api-lifecycle.md solace-project-log/solace-entries/2026-07-15-008-devtools-public-api-lifecycle.md solace-project-log/index.md
git commit -m "test: guard devtools public api lifecycle"
```

Expected: creates a commit after validation passes.
