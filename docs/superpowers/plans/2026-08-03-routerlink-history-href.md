# RouterLink History Href Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `RouterLink` href attributes respect the installed first-party history adapter while preserving current public Router types.

**Architecture:** Add internal symbol-keyed href formatters used only inside `src/router`. First-party history adapters provide internal history href formatting; `createRouter()` resolves route locations once and applies the formatter; `RouterLink` reads the internal router formatter with a fallback to `router.resolve(to).fullPath`.

**Tech Stack:** TypeScript, Solace router internals, Vitest integration tests, jsdom, Prettier, pnpm quality scripts.

---

## Files

- Create `src/router/internal.ts`: internal symbol and interfaces for history/router href formatting.
- Modify `src/router/history.ts`: add internal href formatters to first-party web/hash history adapters.
- Modify `src/router/router.ts`: add a symbol-keyed internal href formatter to created routers.
- Modify `src/router/components.ts`: make `RouterLink` use the internal href formatter with fallback.
- Modify `tests/integration/router-component.test.ts`: add hash-history-aware href coverage.
- Modify `docs/api.md`: document history-aware `RouterLink` href formatting.
- Modify `docs/api.zh-CN.md`: mirror the API docs.
- Modify `docs/project-status.md`: record hash-history-aware href coverage.
- Modify `docs/project-status.zh-CN.md`: mirror the status update.

### Task 1: Add failing hash history RouterLink href tests

**Files:** `tests/integration/router-component.test.ts`

- [x] **Step 1: Import `createWebHashHistory`.**

Add `createWebHashHistory` to the existing import list from `../../src/index`.

- [x] **Step 2: Add test `renders hash history RouterLink hrefs for browser-owned navigation`.**

Set the browser URL to `/#/`, create a router with `history: createWebHashHistory()`, mount two
links, and assert literal href attributes:

```ts
window.history.replaceState(null, "", "/#/");
const router = createRouter({
  history: createWebHashHistory(),
  routes: [{ path: "/users/:id", component: () => h("p", null, "user") }],
});
const App = () => () =>
  h("nav", null, [
    h(RouterLink, { to: "/users/42///?tab=profile", id: "hash-string-link" }, "String"),
    h(
      RouterLink,
      { to: { path: "users/7///", query: { tag: ["a", "b"] } }, id: "hash-object-link" },
      "Object",
    ),
  ]);
const container = document.createElement("div");

createApp(App).use(router).mount(container);

expect(container.querySelector<HTMLAnchorElement>("#hash-string-link")?.getAttribute("href")).toBe(
  "#/users/42?tab=profile",
);
expect(container.querySelector<HTMLAnchorElement>("#hash-object-link")?.getAttribute("href")).toBe(
  "#/users/7?tag=a&tag=b",
);
```

- [x] **Step 3: Run the focused test and verify RED.**

Run:

```bash
pnpm vitest run tests/integration/router-component.test.ts
```

Expected: the new hash history href test fails because current `RouterLink` renders `/users/...`
instead of `#/users/...`.

### Task 2: Add internal href formatter boundary

**Files:** `src/router/internal.ts`, `src/router/history.ts`, `src/router/router.ts`, `src/router/components.ts`

- [x] **Step 1: Create `src/router/internal.ts`.**

```ts
import type { RouteLocationRaw } from "./types";

export const routerHrefFormatterKey = Symbol("Solace.router.hrefFormatter");
export const historyHrefFormatterKey = Symbol("Solace.router.historyHrefFormatter");

export interface HistoryHrefFormatter {
  [historyHrefFormatterKey](path: string): string;
}

export interface RouterHrefFormatter {
  [routerHrefFormatterKey](to: RouteLocationRaw): string;
}

export function hasHistoryHrefFormatter(history: unknown): history is HistoryHrefFormatter {
  return (
    typeof history === "object" &&
    history !== null &&
    typeof (history as Partial<HistoryHrefFormatter>)[historyHrefFormatterKey] === "function"
  );
}
```

- [x] **Step 2: Add history adapter href formatters.**

In `createWebHistory()`, return an adapter object that includes:

```ts
[historyHrefFormatterKey]: (path: string) => normalizeHistoryTarget(path),
```

In `createWebHashHistory()`, return an adapter object that includes:

```ts
[historyHrefFormatterKey]: (path: string) => `#${normalizeHashTarget(path)}`,
```

Keep exported function return types as `RouterHistory` so this does not become a public type
contract.

- [x] **Step 3: Add router internal formatter.**

Import `hasHistoryHrefFormatter` and `routerHrefFormatterKey` into `src/router/router.ts`. Add this
symbol-keyed method to the router object:

```ts
[routerHrefFormatterKey](to: RouteLocationRaw) {
  const fullPath = resolveLocation(to).fullPath;
  return hasHistoryHrefFormatter(options.history)
    ? options.history[historyHrefFormatterKey](fullPath)
    : fullPath;
},
```

If TypeScript rejects the object literal because `Router` does not declare the symbol key, type the
object as `Router & RouterHrefFormatter` internally while keeping `createRouter()`'s return type as
`Router`.

- [x] **Step 4: Use the internal formatter in `RouterLink`.**

Import `routerHrefFormatterKey` and `RouterHrefFormatter`. Compute href as:

```ts
const hrefFormatter = router as Router & Partial<RouterHrefFormatter>;
const href = hrefFormatter[routerHrefFormatterKey]?.(to) ?? router.resolve(to).fullPath;
```

Keep click handling unchanged.

- [x] **Step 5: Run focused tests and verify GREEN.**

Run:

```bash
pnpm vitest run tests/integration/router-component.test.ts
```

Expected: all router component integration tests pass.

### Task 3: Update documentation

**Files:** `docs/api.md`, `docs/api.zh-CN.md`, `docs/project-status.md`, `docs/project-status.zh-CN.md`

- [x] **Step 1: Update English API docs.**

In the `RouterLink` / `RouterView` section, state that first-party history adapters format rendered
hrefs, including `#/` hrefs for `createWebHashHistory()`.

- [x] **Step 2: Update Chinese API docs.**

Mirror the same statement in Simplified Chinese.

- [x] **Step 3: Update project status docs.**

Add hash-history-aware `RouterLink` href coverage to the Router evidence and stabilization note.
Do not change the deferred Router feature list.

- [x] **Step 4: Format and check.**

Run:

```bash
pnpm exec prettier --write src/router/internal.ts src/router/history.ts src/router/router.ts src/router/components.ts tests/integration/router-component.test.ts docs/api.md docs/api.zh-CN.md docs/project-status.md docs/project-status.zh-CN.md
git diff --check
```

### Task 4: Validate, review, commit, and push

**Files:** all files modified above

- [x] **Step 1: Run Router regression tests.**

Run:

```bash
pnpm vitest run tests/unit/router tests/integration/router-component.test.ts
```

Expected: all Router unit and integration tests pass.

- [x] **Step 2: Run full quality gate.**

Run:

```bash
pnpm quality
```

Expected: format check, build, typechecks, lint, full Vitest suite, and package tests pass.

- [x] **Step 3: Review final diff.**

Run:

```bash
git diff --check
git status --short --branch
git diff --stat
```

Confirm only router internals, focused tests, and docs changed.

- [x] **Step 4: Commit.**

```bash
git add src/router/internal.ts src/router/history.ts src/router/router.ts src/router/components.ts tests/integration/router-component.test.ts docs/api.md docs/api.zh-CN.md docs/project-status.md docs/project-status.zh-CN.md
git commit -m "fix(router): format RouterLink hrefs through history"
```

- [x] **Step 5: Push and confirm synchronization.**

```bash
git -c http.version=HTTP/1.1 push
git fetch origin main
git rev-list --left-right --count origin/main...HEAD
git status --short --branch
```

Expected: push succeeds, ahead/behind count is `0 0`, and the working tree is clean. Do not run npm
publish.
