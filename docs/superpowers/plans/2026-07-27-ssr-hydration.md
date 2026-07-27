# SSR Hydration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first Solace SSR + hydration minimum loop: `@italone/solace/server` renders synchronous VNode/component trees to HTML, and `createApp(App).hydrate(container)` attaches behavior to existing DOM.

**Architecture:** Add a DOM-free server renderer under `src/server/`, then add a focused hydration path to the existing renderer that claims existing nodes and hands later updates back to normal `patch()` semantics. Keep SFC syntax and router beta scope unchanged; package changes are limited to a new `@italone/solace/server` subpath and root `App.hydrate()`.

**Tech Stack:** TypeScript, Solace VNode/component runtime, Rollup, Vitest, jsdom, Playwright, pnpm.

---

## File Structure

- Create `src/server/render-to-string.ts`: DOM-free HTML serializer for VNodes and synchronous function components.
- Create `src/server/index.ts`: public server subpath exports.
- Create `src/renderer/hydration.ts`: hydration walker, `SolaceHydrationError`, node claiming, event attachment, and post-hydration VNode state.
- Modify `src/renderer/renderer.ts`: expose `hydrate()` beside `render()` and share reactive render setup.
- Modify `src/app.ts`: add `App.hydrate(container)` while preserving `mount(container)`.
- Modify `rollup.config.mjs`: add `server` to JS/CJS and d.ts build inputs.
- Modify `package.json`: add `./server` package export.
- Modify `scripts/package-consumer-smoke.mjs`: import `renderToString` from packed `@italone/solace/server`.
- Create `tests/unit/server/render-to-string.test.ts`: server rendering contract tests.
- Create `tests/unit/renderer/hydration.test.ts`: hydration mismatch and event attachment tests.
- Modify `tests/unit/app/create-app.test.ts`: app-level `hydrate()` behavior.
- Modify `tests/integration/package-exports.test.ts`: server subpath ESM/CJS export tests and package allowlist update.
- Create `tests/integration/ssr-hydration.test.ts`: render HTML, hydrate jsdom DOM, click, and verify reactive update.
- Modify docs: `docs/api.md`, `docs/api.zh-CN.md`, `docs/package-usage.md`, `docs/project-status.md`, `docs/project-status.zh-CN.md`, `docs/roadmap.md`, `readme.md`, `readme.zh-CN.md`.

---

### Task 1: Server Renderer

**Files:**

- Create: `src/server/render-to-string.ts`
- Create: `src/server/index.ts`
- Test: `tests/unit/server/render-to-string.test.ts`

- [ ] **Step 1: Write failing server renderer tests**

Create `tests/unit/server/render-to-string.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { h, Fragment, onMounted, onUnmounted, onUpdated } from "../../../src";
import { renderToString } from "../../../src/server";

describe("renderToString", () => {
  it("serializes elements, text, fragments, and synchronous components", () => {
    const Message = () => h("strong", { class: "label" }, "hello");

    const result = renderToString(
      h(Fragment, null, [h("p", { id: "intro", "data-active": true }, "count < 1"), h(Message)]),
    );

    expect(result).toEqual({
      html: '<p id="intro" data-active="true">count &lt; 1</p><strong class="label">hello</strong>',
      styles: [],
    });
  });

  it("escapes attributes and omits event props and falsey attributes", () => {
    const result = renderToString(
      h(
        "button",
        {
          title: '5 > "4"',
          disabled: false,
          onClick: () => undefined,
          key: "ignored",
        },
        "Save & continue",
      ),
    );

    expect(result.html).toBe('<button title="5 &gt; &quot;4&quot;">Save &amp; continue</button>');
  });

  it("rejects unsafe element and attribute names", () => {
    expect(() => renderToString(h("div onclick=alert(1)", null, "bad"))).toThrow(TypeError);
    expect(() => renderToString(h("p", { "bad name": "x" }, "bad"))).toThrow(TypeError);
  });

  it("does not run DOM lifecycle hooks on the server", () => {
    const mounted = vi.fn();
    const updated = vi.fn();
    const unmounted = vi.fn();
    const App = () => {
      onMounted(mounted);
      onUpdated(updated);
      onUnmounted(unmounted);

      return h("p", null, "server");
    };

    expect(renderToString(h(App)).html).toBe("<p>server</p>");
    expect(mounted).not.toHaveBeenCalled();
    expect(updated).not.toHaveBeenCalled();
    expect(unmounted).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run server renderer tests to verify RED**

Run:

```bash
pnpm vitest run tests/unit/server/render-to-string.test.ts
```

Expected: fails because `src/server` does not exist.

- [ ] **Step 3: Implement server renderer**

Create `src/server/render-to-string.ts`:

```ts
import {
  createComponentInstance,
  setupComponent,
  type ComponentInstance,
} from "../component/component";
import type { Provides } from "../component/provide";
import { ShapeFlags } from "../shared/flags";
import { Fragment, type ComponentType, type VNode, type VNodeProps } from "../vnode/vnode";
import { h } from "../vnode/h";

export interface RenderToStringOptions {
  context?: Record<string, unknown>;
  provides?: Provides;
}

export interface RenderToStringResult {
  html: string;
  styles: string[];
}

export type RenderToStringSource = VNode | ComponentType | (() => VNode);

export function renderToString(
  source: RenderToStringSource,
  options: RenderToStringOptions = {},
): RenderToStringResult {
  const vnode = normalizeSource(source);

  return {
    html: renderVNodeToString(vnode, null, options.provides ?? null),
    styles: [],
  };
}

function normalizeSource(source: RenderToStringSource): VNode {
  if (isVNode(source)) {
    return source;
  }

  return h(source as ComponentType);
}

function renderVNodeToString(
  vnode: VNode,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): string {
  if (vnode.shapeFlag & ShapeFlags.ELEMENT) {
    return renderElementToString(vnode, parentComponent, appProvides);
  }

  if (vnode.shapeFlag & ShapeFlags.FRAGMENT) {
    return renderChildrenToString(vnode.children, parentComponent, appProvides);
  }

  if (vnode.shapeFlag & ShapeFlags.COMPONENT) {
    return renderComponentToString(vnode, parentComponent, appProvides);
  }

  return "";
}

function renderElementToString(
  vnode: VNode,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): string {
  const tag = String(vnode.type);
  assertSafeHtmlName(tag, "element");
  const attrs = renderAttributes(vnode.props);
  const children = renderChildrenToString(vnode.children, parentComponent, appProvides);

  return `<${tag}${attrs}>${children}</${tag}>`;
}

function renderComponentToString(
  vnode: VNode,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): string {
  const instance = createComponentInstance(vnode, parentComponent, appProvides);
  vnode.component = instance;
  setupComponent(instance);
  const subTree = instance.render();
  instance.subTree = subTree;

  return renderVNodeToString(subTree, instance, instance.appProvides);
}

function renderChildrenToString(
  children: VNode["children"],
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): string {
  if (children === null) {
    return "";
  }

  if (typeof children === "string") {
    return escapeHtml(children);
  }

  if (Array.isArray(children)) {
    return children
      .map((child) => renderVNodeToString(child, parentComponent, appProvides))
      .join("");
  }

  if (isVNode(children)) {
    return renderVNodeToString(children, parentComponent, appProvides);
  }

  return "";
}

function renderAttributes(props: VNodeProps | null): string {
  if (props === null) {
    return "";
  }

  const rendered: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    if (
      key === "key" ||
      isEventProp(key) ||
      value === null ||
      value === undefined ||
      value === false
    ) {
      continue;
    }

    assertSafeHtmlName(key, "attribute");
    rendered.push(`${key}="${escapeAttribute(String(value))}"`);
  }

  return rendered.length === 0 ? "" : ` ${rendered.join(" ")}`;
}

function isVNode(value: unknown): value is VNode {
  return value !== null && typeof value === "object" && "shapeFlag" in value && "type" in value;
}

function isEventProp(key: string): boolean {
  return /^on[A-Z]/.test(key);
}

function assertSafeHtmlName(name: string, kind: "attribute" | "element"): void {
  if (/^[A-Za-z][A-Za-z0-9:-]*$/.test(name)) {
    return;
  }

  throw new TypeError(`Invalid SSR ${kind} name: ${name}`);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
```

Create `src/server/index.ts`:

```ts
export {
  renderToString,
  type RenderToStringOptions,
  type RenderToStringResult,
  type RenderToStringSource,
} from "./render-to-string";
```

- [ ] **Step 4: Run server renderer tests to verify GREEN**

Run:

```bash
pnpm vitest run tests/unit/server/render-to-string.test.ts
```

Expected: all server renderer tests pass.

- [ ] **Step 5: Commit server renderer**

Run:

```bash
git add src/server tests/unit/server
git commit -m "feat: add server render to string"
```

Expected: commit succeeds.

---

### Task 2: Hydration Core

**Files:**

- Create: `src/renderer/hydration.ts`
- Modify: `src/renderer/renderer.ts`
- Test: `tests/unit/renderer/hydration.test.ts`

- [ ] **Step 1: Write failing hydration core tests**

Create `tests/unit/renderer/hydration.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { h, nextTick, ref } from "../../../src";
import { hydrate, SolaceHydrationError } from "../../../src/renderer/renderer";

describe("hydrate", () => {
  it("attaches events to existing DOM and preserves the original element", () => {
    const container = document.createElement("div");
    container.innerHTML = "<button>count: 0</button>";
    const button = container.querySelector("button");
    const onClick = vi.fn();

    hydrate(h("button", { onClick }, "count: 0"), container);

    expect(container.querySelector("button")).toBe(button);
    button?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("throws on structural mismatches", () => {
    const container = document.createElement("div");
    container.innerHTML = "<span>server</span>";

    expect(() => hydrate(h("button", null, "server"), container)).toThrow(SolaceHydrationError);
  });

  it("patches normally after a hydrated reactive update", async () => {
    const count = ref(0);
    const container = document.createElement("div");
    container.innerHTML = "<button>count: 0</button>";
    const App = () => h("button", { onClick: () => count.value++ }, `count: ${count.value}`);

    hydrate(App, container);
    container.querySelector("button")?.click();
    await nextTick();

    expect(container.innerHTML).toBe("<button>count: 1</button>");
  });
});
```

- [ ] **Step 2: Run hydration tests to verify RED**

Run:

```bash
pnpm vitest run tests/unit/renderer/hydration.test.ts
```

Expected: fails because `hydrate` and `SolaceHydrationError` are not exported from `src/renderer/renderer.ts`.

- [ ] **Step 3: Implement hydration core**

Create `src/renderer/hydration.ts`:

```ts
import {
  createComponentInstance,
  setupComponent,
  type ComponentInstance,
} from "../component/component";
import type { Provides } from "../component/provide";
import { isEventProp } from "../event/event";
import { ShapeFlags } from "../shared/flags";
import type { ComponentType, VNode, VNodeProps } from "../vnode/vnode";
import { patchProp } from "./dom";

export class SolaceHydrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SolaceHydrationError";
  }
}

export function hydrateVNode(
  vnode: VNode,
  node: Node | null,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): Node | null {
  if (node === null) {
    throw new SolaceHydrationError(`Missing DOM node for ${describeVNode(vnode)}`);
  }

  if (vnode.shapeFlag & ShapeFlags.ELEMENT) {
    return hydrateElement(vnode, node, parentComponent, appProvides);
  }

  if (vnode.shapeFlag & ShapeFlags.COMPONENT) {
    return hydrateComponent(vnode, node, parentComponent, appProvides);
  }

  if (vnode.shapeFlag & ShapeFlags.FRAGMENT) {
    return hydrateFragment(vnode, node, parentComponent, appProvides);
  }

  return node.nextSibling;
}

function hydrateElement(
  vnode: VNode,
  node: Node,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): Node | null {
  if (!(node instanceof Element) || node.tagName.toLowerCase() !== String(vnode.type)) {
    throw new SolaceHydrationError(
      `Expected <${String(vnode.type)}> but found ${describeDomNode(node)}`,
    );
  }

  vnode.el = node;
  hydrateProps(node, vnode.props);

  if (vnode.shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    const expected = vnode.children as string;
    if (node.textContent !== expected) {
      throw new SolaceHydrationError(
        `Text mismatch in <${String(vnode.type)}>: expected "${expected}" but found "${node.textContent ?? ""}"`,
      );
    }
    return node.nextSibling;
  }

  if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    hydrateChildren(vnode.children as VNode[], node.firstChild, parentComponent, appProvides);
  }

  return node.nextSibling;
}

function hydrateComponent(
  vnode: VNode,
  node: Node,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): Node | null {
  const instance = createComponentInstance(vnode, parentComponent, appProvides);
  vnode.component = instance;
  setupComponent(instance);
  const subTree = instance.render();
  instance.subTree = subTree;
  const next = hydrateVNode(subTree, node, instance, instance.appProvides);
  vnode.el = subTree.el;
  instance.isMounted = true;

  return next;
}

function hydrateFragment(
  vnode: VNode,
  node: Node,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): Node | null {
  if (!(vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN)) {
    return node;
  }

  let current: Node | null = node;
  for (const child of vnode.children as VNode[]) {
    current = hydrateVNode(child, current, parentComponent, appProvides);
  }
  vnode.el = (vnode.children as VNode[])[0]?.el ?? null;

  return current;
}

function hydrateChildren(
  children: VNode[],
  firstNode: ChildNode | null,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): void {
  let current: Node | null = firstNode;
  for (const child of children) {
    current = hydrateVNode(child, current, parentComponent, appProvides);
  }
}

function hydrateProps(el: Element, props: VNodeProps | null): void {
  if (props === null) {
    return;
  }

  for (const [key, value] of Object.entries(props)) {
    if (key === "key" || !isEventProp(key)) {
      continue;
    }

    patchProp(el, key, null, value);
  }
}

function describeVNode(vnode: VNode): string {
  return typeof vnode.type === "string" ? `<${vnode.type}>` : "component";
}

function describeDomNode(node: Node): string {
  return node instanceof Element ? `<${node.tagName.toLowerCase()}>` : node.nodeName;
}
```

Modify `src/renderer/renderer.ts`:

```ts
import { h } from "../vnode/h";
import type { ComponentType } from "../vnode/vnode";
import { hydrateVNode, SolaceHydrationError } from "./hydration";
```

Keep the existing `RenderSource = VNode | (() => VNode)` behavior for `render()`. Add this separate
hydration source type so public `render(() => vnode)` calls continue to behave as reactive render
getters, while `hydrate(App, container)` treats a function as a root component:

```ts
export type HydrationSource = VNode | ComponentType;
```

Add this exported function after `render()`:

```ts
export function hydrate(
  source: HydrationSource,
  container: Element,
  appProvides: Provides | null = null,
): void {
  const renderContainer = container as RenderContainer;
  const getVNode = (): VNode => normalizeHydrationSource(source);

  stopReactiveRender(renderContainer);

  let hydrated = false;
  const update = (): void => {
    const vnode = getVNode();
    if (!hydrated) {
      hydrateVNode(vnode, renderContainer.firstChild, null, appProvides);
      renderContainer._solaceVNode = vnode;
      hydrated = true;
      return;
    }

    renderVNode(vnode, renderContainer, appProvides);
  };
  const reactiveEffect = new ReactiveEffect(update, () => {
    queueJob(job);
  });
  const runner = reactiveEffect.run.bind(reactiveEffect);
  const job = (): void => {
    if (renderContainer._solaceRenderEffect === reactiveEffect) {
      runner();
    }
  };

  renderContainer._solaceRenderEffect = reactiveEffect;
  runner();
}

export { SolaceHydrationError };
```

When `source` is a component function, wrap it with `h(source)` before hydrating. Keep this helper in
`renderer.ts` and use it only for `hydrate()`:

```ts
function normalizeHydrationSource(source: HydrationSource): VNode {
  return typeof source === "function" ? h(source) : source;
}
```

- [ ] **Step 4: Run hydration tests to verify GREEN**

Run:

```bash
pnpm vitest run tests/unit/renderer/hydration.test.ts
```

Expected: all hydration core tests pass.

- [ ] **Step 5: Commit hydration core**

Run:

```bash
git add src/renderer/renderer.ts src/renderer/hydration.ts tests/unit/renderer/hydration.test.ts
git commit -m "feat: add hydration core"
```

Expected: commit succeeds.

---

### Task 3: App Hydration API

**Files:**

- Modify: `src/app.ts`
- Test: `tests/unit/app/create-app.test.ts`

- [ ] **Step 1: Write failing app hydration tests**

Append this test to `tests/unit/app/create-app.test.ts`:

```ts
it("hydrates the root component into existing DOM", async () => {
  const count = ref(0);
  const container = document.createElement("div");
  container.innerHTML = "<button>count: 0</button>";
  const button = container.querySelector("button");
  const App = () => h("button", { onClick: () => count.value++ }, `count: ${count.value}`);

  createApp(App).hydrate(container);
  container.querySelector("button")?.click();
  await nextTick();

  expect(container.querySelector("button")).toBe(button);
  expect(container.innerHTML).toBe("<button>count: 1</button>");
});
```

Ensure the test file imports `nextTick` and `ref` from `../../../src` if they are not already imported.

- [ ] **Step 2: Run app tests to verify RED**

Run:

```bash
pnpm vitest run tests/unit/app/create-app.test.ts
```

Expected: fails because `App` does not have `hydrate`.

- [ ] **Step 3: Add `App.hydrate()`**

Modify `src/app.ts`:

```ts
import { hydrate, render } from "./renderer/renderer";
```

Add `hydrate(container: Element): void;` to `App`.

Add this method to the app object after `mount()`:

```ts
hydrate(container: Element): void {
  const vnode = typeof rootComponent === "function" ? h(rootComponent) : rootComponent;
  hydrate(vnode, container, appProvides);
},
```

- [ ] **Step 4: Run app tests to verify GREEN**

Run:

```bash
pnpm vitest run tests/unit/app/create-app.test.ts tests/unit/renderer/hydration.test.ts
```

Expected: app and hydration tests pass.

- [ ] **Step 5: Commit app hydration API**

Run:

```bash
git add src/app.ts tests/unit/app/create-app.test.ts
git commit -m "feat: add app hydration api"
```

Expected: commit succeeds.

---

### Task 4: SSR Hydration Integration

**Files:**

- Create: `tests/integration/ssr-hydration.test.ts`

- [ ] **Step 1: Write failing integration tests**

Create `tests/integration/ssr-hydration.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createApp, h, inject, nextTick, provide, ref } from "../../src";
import { renderToString } from "../../src/server";

describe("SSR hydration integration", () => {
  it("renders HTML on the server and hydrates browser behavior", async () => {
    const count = ref(0);
    const App = () => h("button", { onClick: () => count.value++ }, `count: ${count.value}`);
    const server = renderToString(h(App));
    const container = document.createElement("div");
    container.innerHTML = server.html;
    const button = container.querySelector("button");

    createApp(App).hydrate(container);
    container.querySelector("button")?.click();
    await nextTick();

    expect(server.styles).toEqual([]);
    expect(container.querySelector("button")).toBe(button);
    expect(container.innerHTML).toBe("<button>count: 1</button>");
  });

  it("preserves app provide and inject during hydration", () => {
    const ThemeKey = Symbol("theme");
    const Child = () => h("span", null, String(inject(ThemeKey, "light")));
    const App = () => {
      provide(ThemeKey, "dark");
      return h(Child);
    };
    const server = renderToString(h(App));
    const container = document.createElement("div");
    container.innerHTML = server.html;

    createApp(App).hydrate(container);

    expect(container.innerHTML).toBe("<span>dark</span>");
  });
});
```

- [ ] **Step 2: Run integration tests to verify behavior**

Run:

```bash
pnpm vitest run tests/integration/ssr-hydration.test.ts
```

Expected: tests pass after Tasks 1-3. If provide/inject fails in server rendering, fix server component instance parent/provides propagation so it matches DOM component setup behavior.

- [ ] **Step 3: Commit integration tests**

Run:

```bash
git add tests/integration/ssr-hydration.test.ts
git commit -m "test: cover ssr hydration integration"
```

Expected: commit succeeds.

---

### Task 5: Package Export And Build

**Files:**

- Modify: `package.json`
- Modify: `rollup.config.mjs`
- Modify: `tests/integration/package-exports.test.ts`

- [ ] **Step 1: Write failing package export tests**

In `tests/integration/package-exports.test.ts`, update the artifact test to assert:

```ts
expect(existsSync(resolve(root, "dist/server.js"))).toBe(true);
expect(existsSync(resolve(root, "dist/server.cjs"))).toBe(true);
expect(existsSync(resolve(root, "dist/server.d.ts"))).toBe(true);
```

Update the package export allowlist to include:

```ts
"./server",
```

Add this test before the CommonJS package export test:

```ts
it("exports the public server rendering subpath", async () => {
  const server = await import("@italone/solace/server");

  expect(Object.keys(server).sort()).toEqual(["renderToString"]);
  expect(server.renderToString).toEqual(expect.any(Function));
  expect(server).not.toHaveProperty("hydrate");
  expect(server).not.toHaveProperty("patch");
});
```

In the CommonJS package export test, add:

```ts
const server = require("@italone/solace/server") as Record<string, unknown>;
expect(Object.keys(server).sort()).toEqual(["renderToString"]);
expect(server.renderToString).toEqual(expect.any(Function));
```

- [ ] **Step 2: Run package export tests to verify RED**

Run:

```bash
pnpm build
pnpm vitest run --config vitest.package.config.ts tests/integration/package-exports.test.ts
```

Expected: fails because `./server` is not in package exports and build input.

- [ ] **Step 3: Add package export and Rollup input**

In `package.json`, add:

```json
"./server": {
  "types": "./dist/server.d.ts",
  "import": "./dist/server.js",
  "require": "./dist/server.cjs"
},
```

In both Rollup input maps in `rollup.config.mjs`, add:

```js
server: "src/server/index.ts",
```

- [ ] **Step 4: Run package export tests to verify GREEN**

Run:

```bash
pnpm build
pnpm vitest run --config vitest.package.config.ts tests/integration/package-exports.test.ts
```

Expected: build succeeds and package export tests pass.

- [ ] **Step 5: Commit package export**

Run:

```bash
git add package.json rollup.config.mjs tests/integration/package-exports.test.ts
git commit -m "feat: expose server rendering subpath"
```

Expected: commit succeeds.

---

### Task 6: Packed Consumer Smoke

**Files:**

- Modify: `scripts/package-consumer-smoke.mjs`

- [ ] **Step 1: Write failing packed consumer smoke checks**

In `scripts/package-consumer-smoke.mjs`, add this import to the generated `src/main.tsx`:

```ts
import { renderToString } from "@italone/solace/server";
```

Add this assertion after the Vite plugin shape assertion:

```ts
const serverRendered = renderToString(h("p", null, "server"));
if (serverRendered.html !== "<p>server</p>" || serverRendered.styles.length !== 0) {
  throw new Error("server rendering export mismatch");
}
```

Update the ESM import smoke command string to include:

```js
const server = await import("@italone/solace/server");
```

and fail when:

```js
!server.renderToString;
```

Update the CJS import smoke command string to include:

```js
const server = require("@italone/solace/server");
```

and fail when:

```js
!server.renderToString;
```

- [ ] **Step 2: Run package smoke**

Run:

```bash
pnpm package:smoke
```

Expected: packed consumer smoke passes after Task 5.

- [ ] **Step 3: Commit package smoke**

Run:

```bash
git add scripts/package-consumer-smoke.mjs
git commit -m "test: smoke server rendering package export"
```

Expected: commit succeeds.

---

### Task 7: Documentation

**Files:**

- Modify: `docs/api.md`
- Modify: `docs/api.zh-CN.md`
- Modify: `docs/package-usage.md`
- Modify: `docs/project-status.md`
- Modify: `docs/project-status.zh-CN.md`
- Modify: `docs/roadmap.md`
- Modify: `readme.md`
- Modify: `readme.zh-CN.md`

- [ ] **Step 1: Document the server subpath in API docs**

In `docs/api.md`, add `@italone/solace/server` to the public entries table and add a section:

````md
## Server Rendering Subpath

Import the first SSR API from `@italone/solace/server`:

```ts
import { renderToString } from "@italone/solace/server";
```

`renderToString(source)` returns `{ html, styles }`. The first server renderer supports synchronous
VNode and function component trees, escapes text and attributes, omits event props from HTML, and
does not run DOM lifecycle hooks. Streaming SSR, async component SSR, SSG CLI, production manifest
integration, and hydration mismatch recovery remain deferred.
````

Add equivalent Chinese content to `docs/api.zh-CN.md`.

- [ ] **Step 2: Document package usage**

In `docs/package-usage.md`, add:

````md
## Use Server Rendering

The first server rendering entry is `@italone/solace/server`:

```ts
import { h } from "@italone/solace";
import { renderToString } from "@italone/solace/server";

const result = renderToString(h("p", null, "server"));
result.html;
result.styles;
```

Use `createApp(App).hydrate(container)` in the browser to attach behavior to matching server HTML.
Hydration throws on structural mismatches instead of silently replacing incompatible DOM.
````

- [ ] **Step 3: Update status and roadmap**

Update `docs/project-status.md` and `docs/project-status.zh-CN.md`:

- SSR/hydration status becomes "Minimum loop implemented".
- Known gaps still include SSG, streaming SSR, async SSR, production manifest integration, hydration mismatch recovery, and DevTools extension UI.

Update `docs/roadmap.md`:

- Move SSR/hydration from "planned" to "minimum loop complete".
- Keep SSG and DevTools extension UI as next items.

- [ ] **Step 4: Update READMEs**

Add `@italone/solace/server` to package entries in both READMEs and mention the minimum SSR/hydration loop in the alpha scope paragraph.

- [ ] **Step 5: Format docs**

Run:

```bash
pnpm exec prettier --write docs/api.md docs/api.zh-CN.md docs/package-usage.md docs/project-status.md docs/project-status.zh-CN.md docs/roadmap.md readme.md readme.zh-CN.md
```

Expected: Prettier completes without errors.

- [ ] **Step 6: Commit docs**

Run:

```bash
git add docs/api.md docs/api.zh-CN.md docs/package-usage.md docs/project-status.md docs/project-status.zh-CN.md docs/roadmap.md readme.md readme.zh-CN.md
git commit -m "docs: document ssr hydration minimum loop"
```

Expected: commit succeeds.

---

### Task 8: Final Gates

**Files:**

- Validate all changed source, package, tests, and docs.

- [ ] **Step 1: Run targeted SSR/hydration checks**

Run:

```bash
pnpm vitest run tests/unit/server/render-to-string.test.ts tests/unit/renderer/hydration.test.ts tests/unit/app/create-app.test.ts tests/integration/ssr-hydration.test.ts
```

Expected: targeted SSR/hydration tests pass.

- [ ] **Step 2: Run package export checks**

Run:

```bash
pnpm build
pnpm vitest run --config vitest.package.config.ts tests/integration/package-exports.test.ts
```

Expected: build and package export tests pass.

- [ ] **Step 3: Run mandatory public API gates**

Run:

```bash
pnpm release:readiness
pnpm package:smoke
pnpm test:e2e
```

Expected: release readiness, packed consumer smoke, and browser e2e pass.

- [ ] **Step 4: Run quality and full release gate**

Run:

```bash
pnpm quality
pnpm release:check
```

Expected: all quality and release checks pass.

- [ ] **Step 5: Confirm final Git state and push**

Run:

```bash
git status --short --branch
git push origin main
git status --short --branch
```

Expected: push succeeds and final status is `main...origin/main` with a clean worktree. If GitHub
network access fails, report the exact `git push` error and the ahead count.
