# Stable Contract Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Solace stable/beta/experimental maturity boundary machine-checkable and synchronized across the public contract checker, bilingual compatibility policy, and release tests without changing runtime behavior.

**Architecture:** Add one repository-owned frozen contract map to the public-contract checker. The checker will validate exact export membership, uniqueness, import paths, and the approved maturity for each protected entry while preserving `stableAdmission: false`. Bilingual documentation will describe the same boundary, and focused tests will fail on accidental promotion or manifest drift.

**Tech Stack:** Node.js ESM release scripts, Vitest, Markdown/JSON documentation, pnpm, Prettier.

---

### Task 1: Enforce the frozen manifest boundary

**Files:**

- Modify: `scripts/public-contract-check-config.mjs`
- Test: `tests/unit/scripts/public-contract-check.test.ts`

- [x] **Step 1: Add the frozen entry map and duplicate/path checks**

Export the approved map from `scripts/public-contract-check-config.mjs`:

```js
export const FROZEN_PUBLIC_CONTRACT = Object.freeze({
  ".": { path: "@italone/solace", maturity: "beta" },
  "./devtools": { path: "@italone/solace/devtools", maturity: "beta" },
  "./jsx-dev-runtime": { path: "@italone/solace/jsx-dev-runtime", maturity: "stable" },
  "./jsx-runtime": { path: "@italone/solace/jsx-runtime", maturity: "stable" },
  "./package.json": { path: "@italone/solace/package.json", maturity: "stable" },
  "./server": { path: "@italone/solace/server", maturity: "beta" },
  "./sfc": { path: "@italone/solace/sfc", maturity: "experimental" },
  "./vite": { path: "@italone/solace/vite", maturity: "experimental" },
});
```

Within `evaluatePublicContract`, report duplicate manifest keys, reject a manifest key outside the
frozen map, require the package export keys to match the frozen map exactly, and compare each entry's
`path` and `maturity` with the frozen record. Keep the existing `stableAdmission` rule so setting it
to `true` still fails while any frozen entry is not stable.

- [x] **Step 2: Add red tests for each new invariant**

Extend `tests/unit/scripts/public-contract-check.test.ts` with cases that:

```ts
it("rejects duplicate manifest entries", () => {
  const result = evaluatePublicContract({
    packageJson,
    manifest: { ...manifest, entries: [...manifest.entries, manifest.entries[0]] },
  });
  expect(result.valid).toBe(false);
  expect(result.errors.join(" ")).toContain("duplicate manifest entries");
});

it("rejects a path or maturity drift from the frozen boundary", () => {
  const result = evaluatePublicContract({
    packageJson,
    manifest: {
      ...manifest,
      entries: manifest.entries.map((entry) =>
        entry.key === "./server"
          ? { ...entry, path: "@italone/solace/wrong", maturity: "stable" }
          : entry,
      ),
    },
  });
  expect(result.valid).toBe(false);
  expect(result.errors.join(" ")).toContain("./server path must remain");
  expect(result.errors.join(" ")).toContain("./server maturity must remain beta");
});
```

Also add a test that parses the checked-in `package.json` and `release/public-contract.json` and
asserts `evaluatePublicContract` returns `{ valid: true, stableAdmission: false, errors: [] }`.

- [x] **Step 3: Run the focused checker tests**

Run: `pnpm exec vitest run tests/unit/scripts/public-contract-check.test.ts`

Expected: all tests in the file pass.

- [x] **Step 4: Run the release contract command**

Run: `pnpm release:contract:check`

Expected: `public contract check: PASS`.

- [x] **Step 5: Commit the checker slice**

```bash
git add scripts/public-contract-check-config.mjs tests/unit/scripts/public-contract-check.test.ts
git commit -m "test: freeze public contract maturity boundary"
```

### Task 2: Synchronize the bilingual compatibility policy

**Files:**

- Modify: `docs/compatibility.md`
- Modify: `docs/compatibility.zh-CN.md`
- Test: `tests/unit/docs/compatibility-docs.test.ts`
- Test: `tests/unit/docs/public-contract-docs.test.ts`

- [x] **Step 1: Add the frozen-boundary section to both policies**

Add an English section after the protected-entry table:

```md
## Frozen Public Maturity Boundary

The current beta line freezes `./jsx-runtime`, `./jsx-dev-runtime`, and `./package.json` as stable
tooling/metadata entries. The root entry, `./server`, and `./devtools` remain beta; `./sfc` and
`./vite` remain experimental. This boundary does not declare Solace 1.0 ready. A promotion requires
a separate design, synchronized documentation, retained package tests, a changeset, and fresh
release evidence.
```

Add the equivalent Chinese section:

```md
## 冻结的公共成熟度边界

当前 beta 线将 `./jsx-runtime`、`./jsx-dev-runtime` 和 `./package.json` 冻结为 stable 的
tooling/metadata 入口。根入口、`./server` 和 `./devtools` 继续为 beta；`./sfc` 和 `./vite`
继续为 experimental。该边界不代表 Solace 已达到 1.0。任何成熟度晋级都需要单独设计、同步文档、
保留 package tests、changeset 和新的 release evidence。
```

- [x] **Step 2: Extend the bilingual structure and content assertions**

Add both new headings to the section arrays in `tests/unit/docs/compatibility-docs.test.ts`. Assert
that the English policy contains the stable entry names, the beta/experimental entry names,
`stableAdmission`, and the separate-design requirement. Assert the equivalent Chinese phrases in the
Chinese policy. Extend `tests/unit/docs/public-contract-docs.test.ts` to require the same maturity
sentences so later status edits cannot remove the boundary from the public documentation set.

- [x] **Step 3: Format and run the documentation tests**

Run:

```bash
pnpm prettier --check docs/compatibility.md docs/compatibility.zh-CN.md tests/unit/docs/compatibility-docs.test.ts tests/unit/docs/public-contract-docs.test.ts
pnpm exec vitest run tests/unit/docs/compatibility-docs.test.ts tests/unit/docs/public-contract-docs.test.ts
```

Expected: Prettier reports all files matched and both test files pass.

- [x] **Step 4: Commit the documentation slice**

```bash
git add docs/compatibility.md docs/compatibility.zh-CN.md tests/unit/docs/compatibility-docs.test.ts tests/unit/docs/public-contract-docs.test.ts
git commit -m "docs: document frozen public maturity boundary"
```

### Task 3: Add release metadata and run the complete verification slice

**Files:**

- Create: `.changeset/frozen-contract-boundary.md`

- [x] **Step 1: Add the beta patch changeset**

Create `.changeset/frozen-contract-boundary.md`:

```md
---
"@italone/solace": patch
---

Freeze the documented stable, beta, and experimental public entry boundaries and enforce them in the release contract gate.
```

- [x] **Step 2: Verify the release metadata and formatting**

Run:

```bash
pnpm changeset status
pnpm prettier --check .changeset/frozen-contract-boundary.md
git diff --check
```

Expected: Changesets reports `@italone/solace` under patch bumps; formatting and whitespace checks
pass.

- [x] **Step 3: Run the complete local quality gate**

Run: `pnpm quality`

Expected: format, public contract check, build, both typechecks, lint, 742 unit tests, and 16 package
tests pass.

- [x] **Step 4: Re-run the 1.0 and publishability checks**

Run:

```bash
pnpm release:one-zero:check -- --report
pnpm release:readiness -- --publishable
```

Expected: 1.0 remains `INCOMPLETE` with stable admission still blocked; publishable readiness fails
only because the local branch is ahead of `origin/main`. Do not push, publish, or create a tag.

- [ ] **Step 5: Commit the changeset and final local state**

```bash
git add .changeset/frozen-contract-boundary.md
git commit -m "chore: record frozen contract boundary"
git status -sb
```

Expected: the worktree is clean and the branch remains local-only.
