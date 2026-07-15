# Async Component Timing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `delay` and `timeout` options to `defineAsyncComponent()` while preserving existing async component behavior.

**Architecture:** Keep timing state inside the async wrapper closure in `src/component/async-component.ts`. Use delay and timeout timers only after the loader starts, clear both timers when loading settles, and ignore late resolves after timeout.

**Tech Stack:** TypeScript, Solace component runtime, Vitest fake timers, Rollup package exports, package consumer smoke.

---

### Task 1: Add Failing Timing Tests

**Files:**

- Modify: `tests/unit/component/component.test.ts`

- [x] **Step 1: Import `vi`**

Update the Vitest import:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
```

Add cleanup near the top of the file:

```ts
afterEach(() => {
  vi.useRealTimers();
});
```

- [x] **Step 2: Add delay visibility test**

```ts
it("waits for delay before rendering an async loading component", async () => {
  vi.useFakeTimers();
  const container = document.createElement("div");
  const Loading = () => h("span", null, "loading");
  const LazyMessage = defineAsyncComponent({
    loader: () => new Promise<(props: object) => ReturnType<typeof h>>(() => undefined),
    loadingComponent: Loading,
    delay: 50,
  });

  render(h(LazyMessage), container);

  expect(container.innerHTML).toBe("");

  vi.advanceTimersByTime(49);
  await nextTick();

  expect(container.innerHTML).toBe("");

  vi.advanceTimersByTime(1);
  await nextTick();

  expect(container.innerHTML).toBe("<span>loading</span>");
});
```

- [x] **Step 3: Add fast resolve test**

```ts
it("skips delayed loading when an async component resolves before delay", async () => {
  vi.useFakeTimers();
  const container = document.createElement("div");
  let resolveLoader!: (component: () => ReturnType<typeof h>) => void;
  const Loading = () => h("span", null, "loading");
  const LazyMessage = defineAsyncComponent({
    loader: () =>
      new Promise<() => ReturnType<typeof h>>((resolve) => {
        resolveLoader = resolve;
      }),
    loadingComponent: Loading,
    delay: 50,
  });

  render(h(LazyMessage), container);

  resolveLoader(() => h("p", null, "loaded"));
  await Promise.resolve();
  await nextTick();

  vi.advanceTimersByTime(50);
  await nextTick();

  expect(container.innerHTML).toBe("<p>loaded</p>");
});
```

- [x] **Step 4: Add timeout error test**

```ts
it("renders an async error component after timeout", async () => {
  vi.useFakeTimers();
  const container = document.createElement("div");
  const ErrorView = () => h("strong", null, "timed out");
  const LazyMessage = defineAsyncComponent({
    loader: () => new Promise<(props: object) => ReturnType<typeof h>>(() => undefined),
    errorComponent: ErrorView,
    timeout: 25,
  });

  render(h(LazyMessage), container);

  vi.advanceTimersByTime(25);
  await nextTick();

  expect(container.innerHTML).toBe("<strong>timed out</strong>");
});
```

- [x] **Step 5: Add late resolve after timeout test**

```ts
it("keeps the error component when an async loader resolves after timeout", async () => {
  vi.useFakeTimers();
  const container = document.createElement("div");
  let resolveLoader!: (component: () => ReturnType<typeof h>) => void;
  const ErrorView = () => h("strong", null, "timed out");
  const LazyMessage = defineAsyncComponent({
    loader: () =>
      new Promise<() => ReturnType<typeof h>>((resolve) => {
        resolveLoader = resolve;
      }),
    errorComponent: ErrorView,
    timeout: 25,
  });

  render(h(LazyMessage), container);

  vi.advanceTimersByTime(25);
  await nextTick();

  expect(container.innerHTML).toBe("<strong>timed out</strong>");

  resolveLoader(() => h("p", null, "late"));
  await Promise.resolve();
  await nextTick();

  expect(container.innerHTML).toBe("<strong>timed out</strong>");
});
```

- [x] **Step 6: Run test to verify RED**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: FAIL because `delay` and `timeout` are ignored by the current helper.

### Task 2: Implement Delay And Timeout

**Files:**

- Modify: `src/component/async-component.ts`

- [x] **Step 1: Add option fields**

```ts
delay?: number;
timeout?: number;
```

- [x] **Step 2: Add timing state**

Inside `defineAsyncComponent()`:

```ts
let isLoadingVisible = getDelay(options) <= 0;
let delayTimer: ReturnType<typeof setTimeout> | null = null;
let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
```

- [x] **Step 3: Start timers with loader**

When loader starts:

```ts
startDelayTimer(options, instance?.update ?? null);
startTimeoutTimer(options, instance?.update ?? null);
```

Use helpers to set `isLoadingVisible` and `loadError`.

- [x] **Step 4: Clear timers on settle and ignore late resolve**

In `then`:

```ts
if (loadError !== null) {
  return;
}
clearAsyncTimers();
resolvedComponent = component;
instance?.update?.();
```

In `catch`:

```ts
clearAsyncTimers();
loadError = error;
instance?.update?.();
```

- [x] **Step 5: Use `isLoadingVisible` in render**

Render loading only when `options.loadingComponent && isLoadingVisible`.

- [x] **Step 6: Run targeted test to verify GREEN**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: PASS.

### Task 3: Update Docs, Smoke, And Logs

**Files:**

- Modify: `scripts/package-consumer-smoke.mjs`
- Modify: `docs/api.md`
- Modify: `readme.md`
- Add: `solace-project-log/solace-entries/2026-07-13-009-async-component-timing.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Add timing options to package smoke**

Add `delay: 10` and `timeout: 5000` to `lazyPanelOptions`.

- [x] **Step 2: Document timing options**

Update `docs/api.md` to mention `delay` and `timeout`.

- [x] **Step 3: Update README follow-up note**

Replace `async delay/timeout/retry options` with `async retry options`.

- [x] **Step 4: Add project log entry and index row**

Record changed files and verification results.

### Task 4: Validate

**Files:**

- No source edits expected.

- [x] **Step 1: Run targeted component tests**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: PASS.

- [x] **Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

- [x] **Step 3: Run package smoke**

Run: `pnpm package:smoke`

Expected: PASS.

- [x] **Step 4: Run full quality gate**

Run: `pnpm quality`

Expected: PASS.

- [x] **Step 5: Run format check**

Run: `pnpm format:check`

Expected: PASS.

## Plan Self-Review

- Spec coverage: delay visibility, fast resolve, timeout, late resolve, docs, smoke, and logs all map to tasks.
- Placeholder scan: no placeholders remain.
- Type consistency: `delay`, `timeout`, `AsyncComponentOptions`, and timer helpers are named consistently.
- Commit steps: omitted because the current project directory is not a Git repository.
