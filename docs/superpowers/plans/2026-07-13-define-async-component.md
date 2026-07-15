# Define Async Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `defineAsyncComponent()` as a public helper for lazy-loading Solace function components.

**Architecture:** Implement async components as a normal wrapper component in `src/component/async-component.ts`. The wrapper starts one loader promise, renders an empty Fragment while pending, stores the resolved component, and schedules its own instance update so the resolved component renders with current props and default slot children.

**Tech Stack:** TypeScript, Solace component runtime, Vitest, Rollup package exports, package consumer smoke.

---

### Task 1: Add Async Component Behavior Tests

**Files:**

- Modify: `tests/unit/component/component.test.ts`

- [x] **Step 1: Import the public helper**

Update the root import:

```ts
import {
  defineAsyncComponent,
  defineComponent,
  h,
  inject,
  nextTick,
  provide,
  reactive,
  render,
} from "../../../src/index";
```

- [x] **Step 2: Write failing behavior tests**

Add these tests inside `describe("component renderer", ...)`:

```ts
it("renders an async component after its loader resolves", async () => {
  const container = document.createElement("div");
  let resolveLoader!: (component: (props: { message?: string }) => ReturnType<typeof h>) => void;
  const LazyMessage = defineAsyncComponent(
    () =>
      new Promise<(props: { message?: string }) => ReturnType<typeof h>>((resolve) => {
        resolveLoader = resolve;
      }),
  );

  render(h(LazyMessage, { message: "loaded" }), container);

  expect(container.innerHTML).toBe("");

  resolveLoader((props) => h("p", null, props.message ?? ""));
  await Promise.resolve();
  await nextTick();

  expect(container.innerHTML).toBe("<p>loaded</p>");
});

it("passes the latest props to a resolved async component", async () => {
  const container = document.createElement("div");
  let resolveLoader!: (component: (props: { message?: string }) => ReturnType<typeof h>) => void;
  const LazyMessage = defineAsyncComponent(
    () =>
      new Promise<(props: { message?: string }) => ReturnType<typeof h>>((resolve) => {
        resolveLoader = resolve;
      }),
  );

  render(h(LazyMessage, { message: "before" }), container);
  render(h(LazyMessage, { message: "after" }), container);

  resolveLoader((props) => h("p", null, props.message ?? ""));
  await Promise.resolve();
  await nextTick();

  expect(container.innerHTML).toBe("<p>after</p>");
});

it("forwards default slot children to a resolved async component", async () => {
  const container = document.createElement("div");
  let resolveLoader!: (
    component: (_props: object, context: ComponentSetupContext) => ReturnType<typeof h>,
  ) => void;
  const LazyPanel = defineAsyncComponent(
    () =>
      new Promise<(_props: object, context: ComponentSetupContext) => ReturnType<typeof h>>(
        (resolve) => {
          resolveLoader = resolve;
        },
      ),
  );

  render(h(LazyPanel, null, h("strong", null, "slot")), container);

  resolveLoader((_props, { slots }) => h("section", null, slots.default?.() ?? null));
  await Promise.resolve();
  await nextTick();

  expect(container.innerHTML).toBe("<section><strong>slot</strong></section>");
});

it("loads an async component only once across rerenders", async () => {
  const state = reactive({ count: 0 });
  const container = document.createElement("div");
  let loadCalls = 0;
  const LazyCounter = defineAsyncComponent(() => {
    loadCalls += 1;
    return Promise.resolve(() => h("span", null, `count: ${state.count}`));
  });

  render(h(LazyCounter), container);
  await Promise.resolve();
  await nextTick();

  state.count = 1;
  await nextTick();

  expect(container.innerHTML).toBe("<span>count: 1</span>");
  expect(loadCalls).toBe(1);
});
```

- [x] **Step 3: Run test to verify RED**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: FAIL because `defineAsyncComponent` is not exported or is not a function.

### Task 2: Implement `defineAsyncComponent`

**Files:**

- Add: `src/component/async-component.ts`
- Modify: `src/index.ts`
- Modify: `tests/integration/package-exports.test.ts`

- [x] **Step 1: Add async component helper**

Create `src/component/async-component.ts`:

```ts
import { getCurrentInstance } from "./lifecycle";
import { h } from "../vnode/h";
import { Fragment, type ComponentType, type VNodeChildren } from "../vnode/vnode";

export type AsyncComponentLoader<Props extends object> = () => Promise<ComponentType<Props>>;

export function defineAsyncComponent<Props extends object>(
  loader: AsyncComponentLoader<Props>,
): ComponentType<Props> {
  let resolvedComponent: ComponentType<Props> | null = null;
  let pendingRequest: Promise<void> | null = null;
  let loadError: unknown = null;

  return (props, { slots }) => {
    const instance = getCurrentInstance();

    return () => {
      if (resolvedComponent !== null) {
        return h(resolvedComponent, props, normalizeSlotChildren(slots.default?.()));
      }

      if (pendingRequest === null && loadError === null) {
        pendingRequest = loader()
          .then((component) => {
            resolvedComponent = component;
            instance?.update?.();
          })
          .catch((error: unknown) => {
            loadError = error;
          });
      }

      return h(Fragment, null, []);
    };
  };
}

function normalizeSlotChildren(children: VNodeChildren | undefined): VNodeChildren {
  return children ?? null;
}
```

- [x] **Step 2: Export helper and type from package root**

Update `src/index.ts`:

```ts
export { defineAsyncComponent } from "./component/async-component";
export type { AsyncComponentLoader } from "./component/async-component";
```

- [x] **Step 3: Cover package root exports**

Update `tests/integration/package-exports.test.ts` root API checks:

```ts
defineAsyncComponent: expect.any(Function),
```

Add CJS assertion:

```ts
expect(api.defineAsyncComponent).toEqual(expect.any(Function));
```

- [x] **Step 4: Run targeted tests to verify GREEN**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: PASS.

### Task 3: Update Package Consumer Smoke

**Files:**

- Modify: `scripts/package-consumer-smoke.mjs`

- [x] **Step 1: Import async helper in packed consumer source**

Change the generated consumer import:

```ts
import {
  createApp,
  createStore,
  defineAsyncComponent,
  defineComponent,
  h,
  inject,
  provide,
  reactive,
  watchEffect,
} from "solace";
```

- [x] **Step 2: Add a typed async consumer component**

Add:

```ts
const LazyPanel = defineAsyncComponent<{ title: string }>(() =>
  Promise.resolve((props: { title: string }, { slots }: ComponentSetupContext) =>
    h("article", { "data-title": props.title }, slots.default?.() ?? null),
  ),
);
```

Use it in `App`:

```ts
h(LazyPanel, { title: "async" }, <em>loaded later</em>),
```

- [x] **Step 3: Update runtime export checks**

Add `api.defineAsyncComponent` to both ESM and CJS smoke checks.

### Task 4: Update Docs And Logs

**Files:**

- Modify: `docs/api.md`
- Modify: `readme.md`
- Add: `solace-project-log/solace-entries/2026-07-13-007-define-async-component.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Document `defineAsyncComponent()`**

Add API documentation showing loader usage and pending empty render behavior.

- [x] **Step 2: Update README API list and candidate note**

Add `defineAsyncComponent` to public API examples and current capabilities. Remove the note that async components remain unimplemented.

- [x] **Step 3: Add project log entry and index row**

Record changed files and verification results.

### Task 5: Validate

**Files:**

- No source edits expected.

- [x] **Step 1: Run targeted component tests**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: PASS.

- [x] **Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

- [x] **Step 3: Run package export tests**

Run: `pnpm test:package`

Expected: PASS.

- [x] **Step 4: Run package consumer smoke**

Run: `pnpm package:smoke`

Expected: PASS.

- [x] **Step 5: Run full quality gate**

Run: `pnpm quality`

Expected: PASS.

- [x] **Step 6: Run format check**

Run: `pnpm format:check`

Expected: PASS.

## Plan Self-Review

- Spec coverage: pending render, resolve update, latest props, default slots, one-time loading, exports, docs, smoke, and logs all map to tasks.
- Placeholder scan: no placeholders remain.
- Type consistency: `defineAsyncComponent`, `AsyncComponentLoader`, `ComponentType<Props>`, `ComponentSetupContext`, and `VNodeChildren` are named consistently.
- Commit steps: omitted because the current project directory is not a Git repository.
