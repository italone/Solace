# Async SSR And Hydration Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit buffered async SSR, sequential async SSG, and prepare-then-commit async hydration while preserving every existing synchronous public contract.

**Architecture:** Introduce public async component/child types and a private prepared-tree resolver shared by server rendering and hydration. Async entry points await preparation; SSR serializes the prepared graph, SSG invokes async SSR sequentially, and hydration commits the prepared graph once without rerunning loaders or setup. Existing sync APIs keep their return types and reject unresolved async values.

**Tech Stack:** TypeScript, Vitest, jsdom, Rollup, Vite, Playwright, pnpm.

**Execution constraint:** Work in the existing authorized checkout, keep all changes uncommitted, do not change `package.json` version, and do not publish or push.

---

### Task 1: Lock The Public Async Type And Sync-Rejection Contract

**Files:**

- Modify: `src/vnode/vnode.ts`
- Modify: `src/vnode/h.ts`
- Modify: `src/app.ts`
- Modify: `src/index.ts`
- Modify: `src/renderer/renderer.ts`
- Modify: `src/shared/utils.ts`
- Test: `tests/unit/server/public-contract-types.test.ts`
- Test: `tests/unit/renderer/vnode-render.test.ts`
- Test: `tests/unit/renderer/hydration.test.ts`

- [x] **Step 1: Add failing public type assertions**

Add compile-only uses that require the approved names and signatures:

```ts
import type { App, AsyncComponentType, AsyncVNodeChild, AsyncVNodeChildren } from "../../../src";

const AsyncApp: AsyncComponentType = async () => () => h("p", null, "async");
const asyncChild: AsyncVNodeChild = Promise.resolve(h("span", null, "child"));
const asyncChildren: AsyncVNodeChildren = [h("span", null, "sync"), asyncChild];

function acceptAsyncHydrate(app: App, container: Element): Promise<void> {
  return app.hydrateAsync(container);
}

createApp(AsyncApp);
h("div", null, asyncChildren);
```

Keep existing `@ts-expect-error` checks for deferred streaming, router, and manifest options.

- [x] **Step 2: Run the typecheck and confirm RED**

Run:

```bash
pnpm typecheck
```

Expected: fail because `AsyncComponentType`, `AsyncVNodeChild`, `AsyncVNodeChildren`, and
`App.hydrateAsync` do not exist.

- [x] **Step 3: Add the public async type surface**

Define the types exactly as follows and export them from the root:

```ts
export type AsyncComponentSetupResult = PromiseLike<ComponentRender | VNode>;

export type AsyncComponentType<Props extends object = ComponentProps> = (
  props: Props,
  context: ComponentSetupContext,
) => AsyncComponentSetupResult;

export type AsyncVNodeChild = PromiseLike<VNodeChild>;
export type AsyncVNodeChildren =
  VNodeChild | AsyncVNodeChild | readonly (VNodeChild | AsyncVNodeChild)[] | null;
```

Add overloads in `createVNode()` and `h()` for `AsyncComponentType` and `AsyncVNodeChildren` without
changing the existing synchronous overload return type `VNode`. Add
`AsyncComponentVNodeChildren = ComponentVNodeChildren | AsyncVNodeChildren` and use it for VNode
input/storage so the private resolver can observe thenables without casts. Do not make slot return
types asynchronous in this slice.

- [x] **Step 4: Add `App.hydrateAsync()` to the interface with a temporary explicit rejection**

Add the method signature now, but keep behavior honest until Task 5:

```ts
hydrateAsync(_container: Element, _options?: HydrationOptions): Promise<void> {
  return Promise.reject(
    new TypeError("Async hydration is not initialized; async tree preparation is required."),
  );
}
```

Allow `createApp()` to accept `ComponentType | AsyncComponentType | VNode`. Do not change
`mount()` or `hydrate()` return types.

- [x] **Step 5: Add focused sync client-render rejection tests**

Test both an async component and a promised child with `render()` and `app.mount()`:

```ts
expect(() => render(h(AsyncApp), container)).toThrow(
  TypeError("Async client rendering is deferred; render() and mount() require synchronous trees."),
);
expect(() => createApp(AsyncApp).mount(container)).toThrow(/Async client rendering is deferred/);
expect(() => render(h("div", null, Promise.resolve(h("span")) as never), container)).toThrow(
  /Async client rendering is deferred/,
);
```

Keep synchronous hydration assertions on the existing `Async hydration is deferred` message.

- [x] **Step 6: Implement sync consumption guards and run focused GREEN checks**

Add one shared `isThenable()` utility and check values at each synchronous consumption boundary:
render sources, component setup/render results, and child values. Do not pre-execute components to
scan the tree because that would run setup twice. Root async components fail before root DOM writes;
nested sync rendering stops at the first async value it encounters.

Run:

```bash
pnpm exec vitest run tests/unit/renderer/vnode-render.test.ts tests/unit/renderer/hydration.test.ts
pnpm typecheck
```

Expected: focused tests and typecheck pass; `hydrateAsync()` remains the only intentional temporary
rejection and is not yet asserted as working.

### Task 2: Build The Private Prepared-Tree Resolver

**Files:**

- Create: `src/shared/async-tree.ts`
- Modify: `src/component/component.ts`
- Modify: `src/component/style.ts`
- Test: `tests/unit/shared/async-tree.test.ts`

- [x] **Step 1: Write resolver RED tests**

Cover these exact outcomes through private source imports:

```ts
const prepared = await prepareAsyncSource(
  h("section", null, [
    Promise.resolve(h("span", null, "child")),
    h(async () => () => h("strong", null, "component")),
  ]),
  { appProvides: null, collectStyles: true },
);

expect(serializePreparedShape(prepared.root)).toEqual({
  type: "section",
  children: [
    { type: "span", children: "child" },
    { component: true, subtree: { type: "strong", children: "component" } },
  ],
});
```

Define `serializePreparedShape()` as a test-local helper. Also assert that rejected sources propagate
the original error object, invalid resolved values throw `TypeError`, and two concurrent preparations
keep separate provides and style sinks.

- [x] **Step 2: Run the resolver tests and confirm RED**

Run:

```bash
pnpm exec vitest run tests/unit/shared/async-tree.test.ts
```

Expected: fail because `src/shared/async-tree.ts` does not exist.

- [x] **Step 3: Implement the private graph types and source normalization**

Use private interfaces with no root or package exports:

```ts
export type AsyncTreeSource =
  | VNode
  | ComponentType
  | AsyncComponentType
  | PromiseLike<VNode | ComponentType | AsyncComponentType>;

export interface PreparedVNode {
  vnode: VNode;
  component: PreparedComponent | null;
  children: string | PreparedVNode[] | null;
}

export interface PreparedComponent {
  instance: ComponentInstance;
  render: ComponentRender | null;
  subtree: PreparedVNode;
  fixed: boolean;
}

export interface PreparedAsyncTree {
  root: PreparedVNode;
  styles: string[];
}

export async function prepareAsyncSource(
  source: AsyncTreeSource,
  options: { appProvides: Provides | null; collectStyles: boolean },
): Promise<PreparedAsyncTree>;
```

Normalize generic thenables with `Promise.resolve()`. Validate every resolved root, component setup
result, render result, and child before recursing.

- [x] **Step 4: Add async setup-once behavior**

Invoke an async component once. If it resolves to a synchronous render function, invoke that render
function under the component instance and store it for updates. If it resolves to a VNode, mark the
prepared component `fixed: true` and never rerun the async function.

Clear current instance and active style sink before awaiting. Re-enter them only when invoking a
resolved synchronous render function. Do not retain process-global context through a promise.

- [x] **Step 5: Add prepared child and fragment traversal**

Preserve input order by awaiting child arrays sequentially:

```ts
const preparedChildren: PreparedVNode[] = [];
for (const child of children) {
  preparedChildren.push(await prepareAsyncVNodeChild(child, parent, appProvides));
}
```

Reject sparse arrays and values outside string, VNode, thenable string, or thenable VNode.

- [x] **Step 6: Run resolver and baseline component tests**

Run:

```bash
pnpm exec vitest run tests/unit/shared/async-tree.test.ts tests/unit/component/component.test.ts tests/unit/component/lifecycle.test.ts
```

Expected: all selected tests pass with no context or style leakage.

### Task 3: Add Buffered `renderToStringAsync()`

**Files:**

- Modify: `src/server/render-to-string.ts`
- Modify: `src/server/index.ts`
- Test: `tests/unit/server/render-to-string.test.ts`
- Test: `tests/unit/server/public-contract-types.test.ts`

- [x] **Step 1: Add failing async SSR behavior tests**

Add tests for promised roots, nested async setup, async children, styles, provides, and rejection:

```ts
const AsyncChild: AsyncComponentType = async () => () => h("strong", null, "ready");
const result = await renderToStringAsync(
  Promise.resolve(h("section", null, [h(AsyncChild), Promise.resolve(h("i", null, "child"))])),
);
expect(result).toEqual({
  html: "<section><strong>ready</strong><i>child</i></section>",
  styles: [],
});
```

Assert unknown fields and deferred `manifest`, `clientEntry`, `router`, and `stream` options fail
before a rejecting source is awaited.

- [x] **Step 2: Run async SSR tests and confirm RED**

Run:

```bash
pnpm exec vitest run tests/unit/server/render-to-string.test.ts
```

Expected: fail because `renderToStringAsync` is not exported.

- [x] **Step 3: Export the async source type and function**

Use the approved signature:

```ts
export type RenderToStringAsyncSource =
  | RenderToStringSource
  | AsyncComponentType
  | PromiseLike<RenderToStringSource | AsyncComponentType>;

export async function renderToStringAsync(
  source: RenderToStringAsyncSource,
  options: RenderToStringOptions = {},
): Promise<RenderToStringResult>;
```

Run existing option validation before calling `prepareAsyncSource()`.

- [x] **Step 4: Serialize the prepared graph with existing HTML policy**

Extract or reuse the current element-name, attribute-name, escaping, event omission, and style-tag
logic. Do not duplicate a second attribute serializer. Serialize the complete prepared graph only
after preparation succeeds; never expose partial output.

- [x] **Step 5: Verify concurrency and sync compatibility**

Add a deferred pair of components whose promises resolve in reverse order. Assert each result keeps
its own provided value and style list. Re-run the existing synchronous SSR tests unchanged.

Run:

```bash
pnpm exec vitest run tests/unit/server/render-to-string.test.ts tests/unit/server/public-contract-types.test.ts
pnpm typecheck
```

Expected: async and sync contracts pass.

### Task 4: Add Sequential `generateStaticSiteAsync()`

**Files:**

- Modify: `src/server/generate-static-site.ts`
- Modify: `src/server/index.ts`
- Test: `tests/unit/server/generate-static-site.test.ts`
- Test: `tests/unit/server/generate-static-site-runtime.test.ts`
- Test: `tests/unit/server/public-contract-types.test.ts`

- [x] **Step 1: Add async SSG RED tests**

Mock `renderToStringAsync()` and assert sequential call order, synchronous shell behavior, copied
context/assets, and first-error stopping:

```ts
const order: string[] = [];
const Slow: AsyncComponentType = async () => {
  order.push("/slow:start");
  await Promise.resolve();
  order.push("/slow:end");
  return () => h("p", null, "slow");
};
const Fast: AsyncComponentType = async () => {
  order.push("/fast:start");
  await Promise.resolve();
  order.push("/fast:end");
  return () => h("p", null, "fast");
};
const result = await generateStaticSiteAsync({
  routes: [
    { path: "/slow", source: Slow },
    { path: "/fast", source: Fast },
  ],
  shell: ({ path, body }) => `${path}:${body}`,
});
expect(result.pages.map((page) => page.path)).toEqual(["/slow", "/fast"]);
expect(order).toEqual(["/slow:start", "/slow:end", "/fast:start", "/fast:end"]);
```

- [x] **Step 2: Confirm RED**

Run:

```bash
pnpm exec vitest run tests/unit/server/generate-static-site.test.ts tests/unit/server/generate-static-site-runtime.test.ts
```

Expected: fail because `generateStaticSiteAsync` and its option types do not exist.

- [x] **Step 3: Add async route and option types**

Add and export:

```ts
export interface AsyncStaticRoute extends Omit<StaticRoute, "source"> {
  source: RenderToStringAsyncSource;
}

export interface GenerateStaticSiteAsyncOptions extends Omit<GenerateStaticSiteOptions, "routes"> {
  routes: readonly AsyncStaticRoute[];
}
```

Reuse the same route, option, manifest, context, provides, duplicate-path, and shell validation
functions as synchronous SSG.

- [x] **Step 4: Implement the sequential route loop**

Use `for...of` with `await renderToStringAsync(...)`; do not use `Promise.all`. Build pages in a local
array and return it only after all routes and shell results pass validation.

- [x] **Step 5: Run async and sync SSG GREEN checks**

Run:

```bash
pnpm exec vitest run tests/unit/server/generate-static-site.test.ts tests/unit/server/generate-static-site-runtime.test.ts tests/unit/server/public-contract-types.test.ts
```

Expected: all selected files pass and existing synchronous output remains unchanged.

### Task 5: Integrate `defineAsyncComponent()` And Async Hydration

**Files:**

- Modify: `src/component/async-component.ts`
- Modify: `src/renderer/renderer.ts`
- Modify: `src/renderer/hydration.ts`
- Modify: `src/app.ts`
- Test: `tests/unit/component/component.test.ts`
- Test: `tests/unit/renderer/hydration.test.ts`
- Test: `tests/integration/ssr-hydration.test.ts`

- [x] **Step 1: Add private async-loader metadata RED tests**

Create a `defineAsyncComponent()` wrapper with retry and timeout options. Through
`renderToStringAsync()` and `app.hydrateAsync()`, assert that the real component is awaited, loading
UI is not serialized, retries are bounded by the existing `retry` option, and the resolved component
is reused after hydration.

- [x] **Step 2: Add prepare-before-commit hydration RED tests**

Capture server DOM identity and use a controllable promise:

```ts
let resolveAsyncSetup!: (render: ComponentRender) => void;
const setup = new Promise<ComponentRender>((resolve) => {
  resolveAsyncSetup = resolve;
});
const AsyncApp: AsyncComponentType = () => setup;
const serverNode = container.firstChild;
const hydration = createApp(AsyncApp).hydrateAsync(container);

expect(container.firstChild).toBe(serverNode);
expect(container.innerHTML).toBe("<button>ready</button>");

resolveAsyncSetup(() => h("button", { onClick }, "ready"));
await hydration;

expect(container.firstChild).toBe(serverNode);
```

Add a rejection case proving HTML, listeners, `_vnode`, and `_solaceRenderEffect` remain unchanged.

- [x] **Step 3: Confirm hydration RED**

Run:

```bash
pnpm exec vitest run tests/unit/component/component.test.ts tests/unit/renderer/hydration.test.ts tests/integration/ssr-hydration.test.ts
```

Expected: fail because loader metadata and hydration commit from a prepared graph do not exist.

- [x] **Step 4: Add private loader metadata**

Attach one non-exported symbol record to `defineAsyncComponent()` wrappers:

```ts
interface AsyncComponentMetadata<Props extends object> {
  load(): Promise<ComponentType<Props>>;
  peek(): ComponentType<Props> | null;
}
```

Factor current timeout/retry/retryDelay behavior into `load()`. Client loading/error component
behavior continues to use the same state. The prepared resolver calls `load()` and never serializes
the transient loading component.

- [x] **Step 5: Add prepared hydration commit**

Extend hydration internals to accept a `PreparedAsyncTree`. During commit, use `prepared.root`, reuse
prepared component instances and subtrees, dedupe `prepared.styles`, attach props/events, install
effects, and set container state without invoking async setup again.

Keep the existing mismatch transaction:

```ts
try {
  commitPreparedHydration(prepared, container, options);
} catch (error) {
  stopPreparedHydrationEffects(prepared);
  if (options.recover && error instanceof SolaceHydrationError) {
    renderPreparedFallback(prepared, container);
    return;
  }
  throw error;
}
```

Define the private helpers with these responsibilities:

```ts
function commitPreparedHydration(
  tree: PreparedAsyncTree,
  container: Element,
  options: HydrationOptions,
): void;
function stopPreparedHydrationEffects(tree: PreparedAsyncTree): void;
function renderPreparedFallback(tree: PreparedAsyncTree, container: Element): void;
```

`commitPreparedHydration()` is the only helper allowed to claim DOM. The cleanup helper stops every
effect installed from the graph, and fallback renders only after a `SolaceHydrationError` with
`recover: true`.

- [x] **Step 6: Replace the temporary `App.hydrateAsync()` rejection**

Validate the container and options synchronously, await `prepareAsyncSource()`, then commit exactly
once. Plugin and app-level provide behavior must match `hydrate()`.

- [x] **Step 7: Verify reactive and fixed-result semantics**

Test that an async setup resolving to a synchronous render function updates after a click and
`nextTick()`. Separately test that an async setup resolving directly to a VNode and promised child
are not rerun during later synchronous updates.

Run:

```bash
pnpm exec vitest run tests/unit/component/component.test.ts tests/unit/renderer/hydration.test.ts tests/integration/ssr-hydration.test.ts
```

Expected: all selected tests pass, including preparation failure cleanup and mismatch recovery.

### Task 6: Validate Public Package Consumption And Browser Hydration

**Files:**

- Modify: `tests/integration/package-exports.test.ts`
- Modify: `scripts/package-consumer-smoke.mjs`
- Create: `examples/async-hydration/index.html`
- Create: `examples/async-hydration/src/main.tsx`
- Create: `examples/async-hydration/vite.config.ts`
- Modify: `playwright.config.ts`
- Create: `tests/e2e/async-hydration.spec.ts`
- Test: `tests/unit/playwright-config.test.ts`

- [x] **Step 1: Add package export RED assertions**

Require `renderToStringAsync` and `generateStaticSiteAsync` from built ESM and CJS server entries,
and `App.hydrateAsync` from the root declaration contract. Render a promised root and sequential
route list from package output.

- [x] **Step 2: Add packed consumer RED assertions**

Extend both ESM and CJS consumer scripts with:

```js
const rendered = await server.renderToStringAsync(
  Promise.resolve(api.h("p", null, "packed async")),
);
if (rendered.html !== "<p>packed async</p>") {
  throw new Error("async SSR package contract mismatch");
}
```

Use top-level `await` in the ESM fixture. Wrap the CJS fixture body in an async IIFE with a terminal
`.catch()` that logs the error and sets `process.exitCode = 1`.

Keep the existing unknown-field and private-subpath assertions.

- [x] **Step 3: Confirm package RED**

Run:

```bash
pnpm test:package
```

Expected: fail until build exports and async APIs are complete.

- [x] **Step 4: Create the async hydration browser example**

Use server-shaped HTML in `index.html`:

```html
<div id="app"><button id="async-counter">count: 0</button></div>
```

In `main.tsx`, create an async root that resolves to a synchronous render function, record the
original button in a local variable, call `createApp(AsyncApp).hydrateAsync(container)`, and set
`data-hydrated="true"` plus `data-node-reused="true"` after resolution.

- [x] **Step 5: Add the Playwright server and three-browser test**

Serve the example on port `6179`. Assert hydration completion, original node identity, click update,
and no console errors:

```ts
await page.goto("http://127.0.0.1:6179");
await expect(page.locator("#app")).toHaveAttribute("data-hydrated", "true");
await expect(page.locator("#app")).toHaveAttribute("data-node-reused", "true");
await page.locator("#async-counter").click();
await expect(page.locator("#async-counter")).toHaveText("count: 1");
```

- [x] **Step 6: Run package and browser GREEN checks**

Run:

```bash
pnpm test:package
pnpm package:smoke
pnpm exec vitest run tests/unit/playwright-config.test.ts
pnpm test:e2e
```

Expected: package checks pass and ordinary E2E reports 15 tests, five in each Chromium, Firefox, and
WebKit project. DevTools extension coverage remains unchanged.

### Task 7: Synchronize English And Chinese Public Documentation

**Files:**

- Modify: `docs/api.md`
- Modify: `docs/api.zh-CN.md`
- Modify: `docs/package-usage.md`
- Modify: `readme.md`
- Modify: `readme.zh-CN.md`
- Modify: `docs/project-status.md`
- Modify: `docs/project-status.zh-CN.md`
- Modify: `docs/release.md`
- Modify: `tests/unit/docs/public-contract-docs.test.ts`
- Modify: `tests/unit/docs/release-docs.test.ts`

- [x] **Step 1: Add documentation contract RED assertions**

Require all public docs to name `renderToStringAsync()`, `generateStaticSiteAsync()`, and
`hydrateAsync()`. Require API docs in both languages to state:

- Async setup is initial/setup-once.
- Returning a synchronous render function is required for later reactive updates.
- Ambient instance APIs after `await` are outside the beta.4 contract.
- Streaming, router-aware SSR/hydration, and async update scheduling remain deferred.
- Sync APIs retain synchronous return types and reject unresolved async values.

- [x] **Step 2: Confirm documentation RED**

Run:

```bash
pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts tests/unit/docs/release-docs.test.ts
```

Expected: fail because public docs do not yet mention the new APIs and limits.

- [x] **Step 3: Update API and package usage docs**

Add runnable ESM examples for async SSR, sequential async SSG, and app hydration. Include one CJS
async IIFE example. Keep exact deferred errors and unknown-own-field behavior visible.

- [x] **Step 4: Update README and project status in both languages**

Describe the capability as buffered async initial rendering, not streaming or Suspense. Do not
claim the final test count or coverage percentages until Task 8 produces fresh evidence.

- [x] **Step 5: Update release compatibility guidance**

Record that existing sync APIs remain stable and new async APIs are additive documented public
entries. State that changing or removing them requires the stable deprecation policy; do not add a
version bump or publish instruction.

- [x] **Step 6: Run documentation and formatting checks**

Run:

```bash
pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts tests/unit/docs/release-docs.test.ts
pnpm format:check
git diff --check
```

Expected: documentation tests, formatting, and whitespace checks pass.

### Task 8: Run Full Gates And Record Only Fresh Evidence

**Files:**

- Modify after verification: `docs/project-status.md`
- Modify after verification: `docs/project-status.zh-CN.md`
- Modify after verification: `tests/unit/docs/public-contract-docs.test.ts`
- Review: `coverage/coverage-final.json`
- Review: `dist/**`
- Review: `examples/devtools-extension/dist/**`

- [x] **Step 1: Run focused async boundary tests**

Run:

```bash
pnpm exec vitest run tests/unit/shared/async-tree.test.ts tests/unit/server/render-to-string.test.ts tests/unit/server/generate-static-site.test.ts tests/unit/server/generate-static-site-runtime.test.ts tests/unit/renderer/hydration.test.ts tests/integration/ssr-hydration.test.ts
```

Expected: all selected files pass with no unhandled rejection warnings.

- [x] **Step 2: Run public package gates**

Run:

```bash
pnpm test:package
pnpm package:smoke
```

Expected: ESM, CJS, declaration, Vite consumer, unknown-field, and private-subpath checks pass.

- [x] **Step 3: Run the full release gate**

Run:

```bash
pnpm release:check
```

Expected: readiness, quality, coverage thresholds, consumer smoke, benchmarks, 15 ordinary browser
E2E tests, and 2 Chromium-only DevTools extension E2E tests pass.

- [x] **Step 4: Refresh status metrics from the command output**

Replace the prior test count and four coverage percentages only with values printed by the fresh
Task 8 gate. Update the English and Chinese documentation assertions to match those exact values.

- [x] **Step 5: Re-run the final full gate and integrity checks**

Run:

```bash
pnpm release:check
git diff --check
git status --short
```

Expected: the complete gate passes against the final documentation and metrics; generated `dist`,
coverage, benchmark history, and DevTools extension output introduce no unexpected tracked changes.
Leave the complete implementation uncommitted and do not publish.
