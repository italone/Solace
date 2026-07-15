# Async Component Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `defineAsyncComponent()` with object options for loading and error components while preserving the existing loader-function API.

**Architecture:** Normalize the input to `{ loader, loadingComponent?, errorComponent? }` inside `src/component/async-component.ts`. Reuse the existing wrapper component, one-time loader cache, props forwarding, and default slot forwarding.

**Tech Stack:** TypeScript, Solace component runtime, Vitest, Rollup package exports, package consumer smoke.

---

### Task 1: Add Failing Option Tests

**Files:**

- Modify: `tests/unit/component/component.test.ts`

- [x] **Step 1: Add loading component test**

```ts
it("renders an async loading component while loader is pending", () => {
  const container = document.createElement("div");
  const Loading = () => h("span", null, "loading");
  const LazyMessage = defineAsyncComponent({
    loader: () =>
      new Promise<(props: { message?: string }) => ReturnType<typeof h>>(() => undefined),
    loadingComponent: Loading,
  });

  render(h(LazyMessage, { message: "pending" }), container);

  expect(container.innerHTML).toBe("<span>loading</span>");
});
```

- [x] **Step 2: Add resolved replacement test**

```ts
it("replaces an async loading component after loader resolves", async () => {
  const container = document.createElement("div");
  let resolveLoader!: (component: (props: { message?: string }) => ReturnType<typeof h>) => void;
  const Loading = () => h("span", null, "loading");
  const LazyMessage = defineAsyncComponent({
    loader: () =>
      new Promise<(props: { message?: string }) => ReturnType<typeof h>>((resolve) => {
        resolveLoader = resolve;
      }),
    loadingComponent: Loading,
  });

  render(h(LazyMessage, { message: "loaded" }), container);

  expect(container.innerHTML).toBe("<span>loading</span>");

  resolveLoader((props) => h("p", null, props.message ?? ""));
  await Promise.resolve();
  await nextTick();

  expect(container.innerHTML).toBe("<p>loaded</p>");
});
```

- [x] **Step 3: Add error component test**

```ts
it("renders an async error component when loader rejects", async () => {
  const container = document.createElement("div");
  const ErrorView = () => h("strong", null, "failed");
  const LazyMessage = defineAsyncComponent({
    loader: () => Promise.reject(new Error("load failed")),
    errorComponent: ErrorView,
  });

  render(h(LazyMessage), container);
  await Promise.resolve();
  await nextTick();

  expect(container.innerHTML).toBe("<strong>failed</strong>");
});
```

- [x] **Step 4: Add forwarding test for loading/error option components**

```ts
it("passes props and slots to async loading and error components", async () => {
  const container = document.createElement("div");
  const Loading = (props: { label?: string }, { slots }: ComponentSetupContext) =>
    h("span", null, [
      h("b", null, props.label ?? ""),
      ...(slots.default?.() ? [slots.default?.()] : []),
    ]);
  const ErrorView = (props: { label?: string }, { slots }: ComponentSetupContext) =>
    h("strong", null, [
      h("b", null, props.label ?? ""),
      ...(slots.default?.() ? [slots.default?.()] : []),
    ]);
  const LazyMessage = defineAsyncComponent({
    loader: () => Promise.reject(new Error("load failed")),
    loadingComponent: Loading,
    errorComponent: ErrorView,
  });

  render(h(LazyMessage, { label: "state" }, h("em", null, "slot")), container);

  expect(container.innerHTML).toBe("<span><b>state</b><em>slot</em></span>");

  await Promise.resolve();
  await nextTick();

  expect(container.innerHTML).toBe("<strong><b>state</b><em>slot</em></strong>");
});
```

- [x] **Step 5: Run test to verify RED**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: FAIL because object input is treated as a loader function.

### Task 2: Implement Option Normalization

**Files:**

- Modify: `src/component/async-component.ts`

- [x] **Step 1: Add options types**

```ts
export interface AsyncComponentOptions<Props extends object> {
  loader: AsyncComponentLoader<Props>;
  loadingComponent?: ComponentType<Props>;
  errorComponent?: ComponentType<Props>;
}

export type AsyncComponentSource<Props extends object> =
  AsyncComponentLoader<Props> | AsyncComponentOptions<Props>;
```

- [x] **Step 2: Update function signature and normalize input**

```ts
export function defineAsyncComponent<Props extends object>(
  source: AsyncComponentSource<Props>,
): ComponentType<Props> {
  const options = normalizeAsyncComponentOptions(source);
  // existing state
}

function normalizeAsyncComponentOptions<Props extends object>(
  source: AsyncComponentSource<Props>,
): AsyncComponentOptions<Props> {
  return typeof source === "function" ? { loader: source } : source;
}
```

- [x] **Step 3: Render loading and error components**

Use a helper:

```ts
function renderComponent<Props extends object>(
  component: ComponentType<Props>,
  props: Props,
  children: VNodeChildren,
) {
  return h(component, props, children);
}
```

Render order:

```ts
const children = normalizeSlotChildren(slots.default?.());

if (resolvedComponent !== null) {
  return renderComponent(resolvedComponent, props, children);
}

if (loadError !== null) {
  return options.errorComponent
    ? renderComponent(options.errorComponent, props, children)
    : h(Fragment, null, []);
}

// start loader if needed

return options.loadingComponent
  ? renderComponent(options.loadingComponent, props, children)
  : h(Fragment, null, []);
```

In the catch handler, set `loadError` and call `instance?.update?.()`.

- [x] **Step 4: Run targeted test to verify GREEN**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: PASS.

### Task 3: Update Package Smoke And Docs

**Files:**

- Modify: `scripts/package-consumer-smoke.mjs`
- Modify: `src/index.ts`
- Modify: `docs/api.md`
- Modify: `readme.md`
- Add: `solace-project-log/solace-entries/2026-07-13-008-async-component-options.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Add object-options usage to package smoke**

Change `LazyPanel` to use:

```ts
const AsyncLoading = () => h("span", null, "loading");
const AsyncError = () => h("span", null, "error");

const LazyPanel = defineAsyncComponent<{ title: string }>({
  loader: () =>
    Promise.resolve((props: { title: string }, { slots }: ComponentSetupContext) =>
      h("article", { "data-title": props.title }, slots.default?.() ?? null),
    ),
  loadingComponent: AsyncLoading,
  errorComponent: AsyncError,
});
```

- [x] **Step 1a: Export option types from package root**

Update `src/index.ts`:

```ts
export type {
  AsyncComponentLoader,
  AsyncComponentOptions,
  AsyncComponentSource,
} from "./component/async-component";
```

- [x] **Step 2: Document object options**

Update `docs/api.md` to show both loader-function and object-options forms.

- [x] **Step 3: Update README follow-up note**

Replace `async loading/error options` with remaining future async options such as `delay`, `timeout`, and `retry`.

- [x] **Step 4: Add project log entry and index row**

Record files changed and verification results.

### Task 4: Validate

**Files:**

- No source edits expected.

- [x] **Step 1: Run targeted tests**

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

- Spec coverage: loading render, resolve replacement, error render, function compatibility, props/slots forwarding, docs, smoke, and logs all map to tasks.
- Placeholder scan: no placeholders remain.
- Type consistency: `AsyncComponentLoader`, `AsyncComponentOptions`, `AsyncComponentSource`, and `ComponentType<Props>` are used consistently.
- Commit steps: omitted because the current project directory is not a Git repository.
