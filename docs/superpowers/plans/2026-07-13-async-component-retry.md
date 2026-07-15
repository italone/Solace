# Async Component Retry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bounded automatic retry support to `defineAsyncComponent()` without changing existing single-attempt behavior.

**Architecture:** Keep retry state inside the async wrapper closure in `src/component/async-component.ts`. Route loader rejection and timeout through one failure handler, use an attempt id to ignore stale promises, and restart delay/timeout timers for each attempt.

**Tech Stack:** TypeScript, Solace component runtime, Vitest fake timers, Rollup package exports, package consumer smoke.

---

### Task 1: Add Failing Retry Tests

**Files:**

- Modify: `tests/unit/component/component.test.ts`

- [ ] **Step 1: Add rejection retry delay test**

```ts
it("retries a rejected async component loader after retryDelay", async () => {
  vi.useFakeTimers();
  const container = document.createElement("div");
  let loadCalls = 0;
  const LazyMessage = defineAsyncComponent({
    loader: () => {
      loadCalls += 1;
      return loadCalls === 1
        ? Promise.reject(new Error("first failure"))
        : new Promise<() => ReturnType<typeof h>>(() => undefined);
    },
    retry: 1,
    retryDelay: 25,
  });

  render(h(LazyMessage), container);
  await Promise.resolve();
  await nextTick();

  expect(loadCalls).toBe(1);

  vi.advanceTimersByTime(24);
  await nextTick();

  expect(loadCalls).toBe(1);

  vi.advanceTimersByTime(1);
  await Promise.resolve();
  await nextTick();

  expect(loadCalls).toBe(2);
  expect(container.innerHTML).toBe("");
});
```

- [ ] **Step 2: Add retry success test**

```ts
it("renders an async component when a retry succeeds", async () => {
  const container = document.createElement("div");
  let loadCalls = 0;
  const ErrorView = () => h("strong", null, "failed");
  const LazyMessage = defineAsyncComponent({
    loader: () => {
      loadCalls += 1;
      return loadCalls === 1
        ? Promise.reject(new Error("first failure"))
        : Promise.resolve((props: { message?: string }) => h("p", null, props.message ?? ""));
    },
    errorComponent: ErrorView,
    retry: 1,
  });

  render(h(LazyMessage, { message: "loaded" }), container);
  await Promise.resolve();
  await Promise.resolve();
  await nextTick();

  expect(loadCalls).toBe(2);
  expect(container.innerHTML).toBe("<p>loaded</p>");
});
```

- [ ] **Step 3: Add retry exhaustion test**

```ts
it("renders an async error component after retries are exhausted", async () => {
  const container = document.createElement("div");
  let loadCalls = 0;
  const ErrorView = () => h("strong", null, "failed");
  const LazyMessage = defineAsyncComponent({
    loader: () => {
      loadCalls += 1;
      return Promise.reject(new Error("load failed"));
    },
    errorComponent: ErrorView,
    retry: 2,
  });

  render(h(LazyMessage), container);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await nextTick();

  expect(loadCalls).toBe(3);
  expect(container.innerHTML).toBe("<strong>failed</strong>");
});
```

- [ ] **Step 4: Add timeout retry test**

```ts
it("retries an async component loader after timeout and renders a later success", async () => {
  vi.useFakeTimers();
  const container = document.createElement("div");
  let loadCalls = 0;
  const LazyMessage = defineAsyncComponent({
    loader: () => {
      loadCalls += 1;
      return loadCalls === 1
        ? new Promise<() => ReturnType<typeof h>>(() => undefined)
        : Promise.resolve(() => h("p", null, "loaded after timeout"));
    },
    timeout: 25,
    retry: 1,
  });

  render(h(LazyMessage), container);

  vi.advanceTimersByTime(25);
  await Promise.resolve();
  await nextTick();

  expect(loadCalls).toBe(2);
  expect(container.innerHTML).toBe("<p>loaded after timeout</p>");
});
```

- [ ] **Step 5: Add no-retry regression test**

```ts
it("keeps single-attempt behavior when retry is omitted", async () => {
  const container = document.createElement("div");
  let loadCalls = 0;
  const ErrorView = () => h("strong", null, "failed");
  const LazyMessage = defineAsyncComponent({
    loader: () => {
      loadCalls += 1;
      return Promise.reject(new Error("load failed"));
    },
    errorComponent: ErrorView,
  });

  render(h(LazyMessage), container);
  await Promise.resolve();
  await nextTick();

  expect(loadCalls).toBe(1);
  expect(container.innerHTML).toBe("<strong>failed</strong>");
});
```

- [ ] **Step 6: Run RED**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: FAIL because `retry` and `retryDelay` are not part of `AsyncComponentOptions` and retry
behavior is not implemented.

### Task 2: Implement Retry

**Files:**

- Modify: `src/component/async-component.ts`

- [ ] **Step 1: Add option fields**

```ts
retry?: number;
retryDelay?: number;
```

- [ ] **Step 2: Add retry state**

```ts
let failedAttempts = 0;
let activeAttemptId = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
```

- [ ] **Step 3: Extract loader start**

Create `startLoad(update)` that increments `activeAttemptId`, clears per-attempt timers, starts
delay/timeout timers, calls `options.loader()`, and stores the promise in `pendingRequest`.

- [ ] **Step 4: Centralize failure handling**

Create `handleLoadFailure(error, attemptId, update)` that ignores stale attempts, clears timers,
retries while `failedAttempts < getRetry(options)`, and sets `loadError` only when no attempts remain.

- [ ] **Step 5: Clear retry timer**

Update `clearAsyncTimers()` to clear delay, timeout, and retry timers.

- [ ] **Step 6: Run GREEN**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: PASS.

### Task 3: Update Docs, Smoke, And Logs

**Files:**

- Modify: `scripts/package-consumer-smoke.mjs`
- Modify: `docs/api.md`
- Modify: `readme.md`
- Add: `solace-project-log/solace-entries/2026-07-13-010-async-component-retry.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Add retry options to package smoke**

Add `retry: 1` and `retryDelay: 10` to `lazyPanelOptions`.

- [ ] **Step 2: Document retry options**

Update `docs/api.md` to mention retry behavior and include `retry` / `retryDelay` in the example.

- [ ] **Step 3: Update README**

Remove async retry from future-work wording and keep current capability text accurate.

- [ ] **Step 4: Add project log entry and index row**

Record changed files, validation commands, and residual risks.

### Task 4: Validate

**Files:**

- No source edits expected.

- [ ] **Step 1: Run targeted component tests**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 3: Run package smoke**

Run: `pnpm package:smoke`

Expected: PASS and print `package consumer smoke passed`.

- [ ] **Step 4: Run full quality gate**

Run: `pnpm quality`

Expected: PASS.

- [ ] **Step 5: Run format check**

Run: `pnpm format:check`

Expected: PASS.
