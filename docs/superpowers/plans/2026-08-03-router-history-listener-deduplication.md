# Router History Listener Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing web and hash history adapters notify each listener once per normalized location change.

**Architecture:** Keep the public `RouterHistory` interface unchanged. Add a small internal listener wrapper in `src/router/history.ts` that snapshots the adapter location at registration and suppresses native events whose current normalized location matches the last notified value. Use the same wrapper for both adapters so `popstate` and `hashchange` share one deduplication rule.

**Tech Stack:** TypeScript, Vitest, jsdom, Prettier, pnpm quality scripts.

---

## Files

- Modify `tests/unit/router/history.test.ts`: make the existing web listener test represent a real location change and add duplicate-event and later-location regression cases.
- Modify `src/router/history.ts`: wrap native event callbacks with location-based deduplication while preserving current push/replace and cleanup behavior.
- Modify `docs/api.md`: document location-based listener notifications and duplicate native-event suppression.
- Modify `docs/api.zh-CN.md`: mirror the history listener contract in Simplified Chinese.
- Modify `docs/project-status.md`: record the stabilized history listener contract in Router completion and stabilization notes.
- Modify `docs/project-status.zh-CN.md`: mirror the project status update in Simplified Chinese.

### Task 1: Add failing history listener tests

**Files:** `tests/unit/router/history.test.ts`

- [x] **Step 1: Update the existing web listener test to change the URL before dispatching `popstate`.**

Use `window.history.pushState(null, "", "/changed")` before the first dispatch, keep the cleanup call, and retain the expectation that only the first changed event is observed after cleanup.

- [x] **Step 2: Add a web duplicate-event test.**

Add:

```ts
it("ignores repeated popstate events for the same location", () => {
  window.history.replaceState(null, "", "/start");
  const history = createWebHistory();
  const listener = vi.fn();
  history.listen(listener);

  window.history.pushState(null, "", "/next");
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.dispatchEvent(new PopStateEvent("popstate"));

  expect(listener).toHaveBeenCalledTimes(1);
});
```

- [x] **Step 3: Add a hash duplicate-event and later-location test.**

Replace the current hash cleanup event sequence with a test that starts at `/#/start`, registers a listener, changes to `/#/next`, dispatches one `popstate` and one `hashchange`, then changes to `/#/final` and dispatches another `hashchange`. Expect exactly two callbacks. After calling cleanup, dispatch both event types again and expect no additional callbacks.

- [x] **Step 4: Run the focused tests and verify the new tests fail for the missing deduplication behavior.**

Run:

```bash
pnpm vitest run tests/unit/router/history.test.ts
```

Expected: the existing adapter tests pass, while the new web duplicate-event and hash duplicate-event assertions fail because the current adapters forward every native event.

### Task 2: Implement location-based listener deduplication

**Files:** `src/router/history.ts`

- [x] **Step 1: Add an internal listener wrapper.**

Implement a private helper with this behavior:

```ts
function createLocationChangeListener(location: () => string, listener: () => void): () => void {
  let lastLocation = location();

  return () => {
    const nextLocation = location();
    if (nextLocation === lastLocation) {
      return;
    }

    lastLocation = nextLocation;
    listener();
  };
}
```

- [x] **Step 2: Wrap `createWebHistory()` listeners.**

Define the adapter's `location` function in a local variable before returning the object, pass that
variable to `createLocationChangeListener(location, listener)` inside `listen(listener)`, register the
wrapped callback for `popstate`, and remove that exact callback in cleanup. Do not use `this.location`
because the adapter methods are object-literal functions and the helper must receive an explicit
function reference.

- [x] **Step 3: Wrap `createWebHashHistory()` listeners.**

Create one wrapped callback from the hash adapter's `location` function and register that same callback for both `popstate` and `hashchange`. Cleanup must remove the same callback from both event types.

- [x] **Step 4: Run the focused tests and verify they pass.**

Run:

```bash
pnpm vitest run tests/unit/router/history.test.ts
```

Expected: all history tests pass, including one callback for a changed location and suppression of duplicate native events.

### Task 3: Update the public documentation

**Files:** `docs/api.md`, `docs/api.zh-CN.md`, `docs/project-status.md`, `docs/project-status.zh-CN.md`

- [x] **Step 1: Update the English API section.**

In the `createWebHistory()` / `createWebHashHistory()` section, state that `listen()` notifies on normalized location changes and suppresses repeated native events for the same location; `push()` and `replace()` do not invoke listeners directly.

- [x] **Step 2: Mirror the API statement in Chinese.**

Use the same semantics: listener callbacks are based on normalized location changes, duplicate native events are suppressed, and `push()` / `replace()` do not directly call listeners.

- [x] **Step 3: Update both project status files.**

Add history listener deduplication to the Router completion evidence and the 2026-08-03 stabilization note. Do not remove or expand the existing deferred Router list.

- [x] **Step 4: Format and check documentation.**

Run:

```bash
pnpm exec prettier --write src/router/history.ts tests/unit/router/history.test.ts docs/api.md docs/api.zh-CN.md docs/project-status.md docs/project-status.zh-CN.md
git diff --check
```

### Task 4: Run full validation and publish the branch changes

**Files:** all files modified above

- [x] **Step 1: Run Router regression tests.**

Run:

```bash
pnpm vitest run tests/unit/router tests/integration/router-component.test.ts
```

Expected: all Router unit and integration tests pass.

- [x] **Step 2: Run the repository quality gate.**

Run:

```bash
pnpm quality
```

Expected: format check, build, both typechecks, lint, full Vitest suite, and package tests all exit successfully.

- [x] **Step 3: Review the final diff.**

Run:

```bash
git diff --check
git status --short --branch
git diff --stat
```

Confirm only the intended source, test, and documentation files changed.

- [x] **Step 4: Commit the implementation.**

```bash
git add src/router/history.ts tests/unit/router/history.test.ts docs/api.md docs/api.zh-CN.md docs/project-status.md docs/project-status.zh-CN.md
git commit -m "fix(router): dedupe browser history listener events"
```

- [x] **Step 5: Push and verify synchronization.**

```bash
git -c http.version=HTTP/1.1 push
git fetch origin main
git rev-list --left-right --count origin/main...HEAD
git status --short --branch
```

Expected: push succeeds, the ahead/behind count is `0 0`, and the working tree is clean. Do not run npm publish.
