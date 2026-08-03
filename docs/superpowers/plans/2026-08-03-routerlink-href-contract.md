# RouterLink Href Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add regression coverage and documentation for the existing `RouterLink` href contract.

**Architecture:** Keep `RouterLink` tied to `router.resolve(to).fullPath`. Add integration tests at the rendered anchor boundary and update API/status documentation. Avoid new public Router APIs and avoid hash-history-specific href behavior in this slice.

**Tech Stack:** TypeScript, Solace integration tests, Vitest, jsdom, Prettier, pnpm quality scripts.

---

## Files

- Modify `tests/integration/router-component.test.ts`: add rendered `href` contract coverage for string and object locations.
- Modify `docs/api.md`: document `RouterLink` href generation from `router.resolve(to).fullPath`.
- Modify `docs/api.zh-CN.md`: mirror the API documentation in Simplified Chinese.
- Modify `docs/project-status.md`: record `RouterLink` href contract coverage.
- Modify `docs/project-status.zh-CN.md`: mirror the project status update in Simplified Chinese.
- Modify `src/router/components.ts` only if the tests expose a mismatch.

### Task 1: Add RouterLink href contract tests

**Files:** `tests/integration/router-component.test.ts`

- [ ] **Step 1: Add a test named `renders RouterLink hrefs from resolved full paths`.**

Mount an app with three links:

```ts
const App = () => () =>
  h("nav", null, [
    h(RouterLink, { to: "/users/42///?tab=profile", id: "string-link" }, "String"),
    h(
      RouterLink,
      { to: { path: "users/7///", query: { tab: "profile" } }, id: "object-link" },
      "Object",
    ),
    h(
      RouterLink,
      { to: { path: "/users/8", query: { tag: ["a", "b"] } }, id: "array-link" },
      "Array",
    ),
  ]);
```

Use a router with `/users/:id` and assert:

```ts
expect(container.querySelector<HTMLAnchorElement>("#string-link")?.getAttribute("href")).toBe(
  "/users/42?tab=profile",
);
expect(container.querySelector<HTMLAnchorElement>("#object-link")?.getAttribute("href")).toBe(
  "/users/7?tab=profile",
);
expect(container.querySelector<HTMLAnchorElement>("#array-link")?.getAttribute("href")).toBe(
  "/users/8?tag=a&tag=b",
);
```

- [ ] **Step 2: Run the focused test file.**

Run:

```bash
pnpm vitest run tests/integration/router-component.test.ts
```

Expected: if current `RouterLink` already delegates to `router.resolve(to).fullPath`, all tests pass.
If a mismatch appears, update `src/router/components.ts` with the smallest local change and rerun.

### Task 2: Update documentation

**Files:** `docs/api.md`, `docs/api.zh-CN.md`, `docs/project-status.md`, `docs/project-status.zh-CN.md`

- [ ] **Step 1: Update English API docs.**

In the `RouterLink` / `RouterView` section, state that `RouterLink` renders the anchor `href` from
`router.resolve(to).fullPath`.

- [ ] **Step 2: Update Chinese API docs.**

Mirror the same statement in Simplified Chinese.

- [ ] **Step 3: Update both project status files.**

Add `RouterLink` href contract coverage to the Router evidence and stabilization note without
changing the deferred Router feature list.

- [ ] **Step 4: Format and check.**

Run:

```bash
pnpm exec prettier --write tests/integration/router-component.test.ts docs/api.md docs/api.zh-CN.md docs/project-status.md docs/project-status.zh-CN.md
git diff --check
```

### Task 3: Validate, commit, and push

**Files:** all files modified above

- [ ] **Step 1: Run Router regression tests.**

Run:

```bash
pnpm vitest run tests/unit/router tests/integration/router-component.test.ts
```

Expected: all Router unit and integration tests pass.

- [ ] **Step 2: Run the full quality gate.**

Run:

```bash
pnpm quality
```

Expected: format check, build, both typechecks, lint, full Vitest suite, and package tests all pass.

- [ ] **Step 3: Review the diff.**

Run:

```bash
git diff --check
git status --short --branch
git diff --stat
```

Confirm only the intended integration test and documentation files changed unless the tests exposed
an implementation mismatch.

- [ ] **Step 4: Commit.**

If no production implementation changed:

```bash
git add tests/integration/router-component.test.ts docs/api.md docs/api.zh-CN.md docs/project-status.md docs/project-status.zh-CN.md
git commit -m "test(router): cover RouterLink href contract"
```

If `src/router/components.ts` changed:

```bash
git add src/router/components.ts tests/integration/router-component.test.ts docs/api.md docs/api.zh-CN.md docs/project-status.md docs/project-status.zh-CN.md
git commit -m "fix(router): stabilize RouterLink href contract"
```

- [ ] **Step 5: Push and confirm synchronization.**

```bash
git -c http.version=HTTP/1.1 push
git fetch origin main
git rev-list --left-right --count origin/main...HEAD
git status --short --branch
```

Expected: push succeeds, ahead/behind count is `0 0`, and the working tree is clean. Do not run npm publish.
