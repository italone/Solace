# SSR Style Collection And Hydration Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared `useStyle()` runtime path so any Solace render tree can register styles, `renderToString()` collects them for SSR/SSG, and client `mount()`/`hydrate()` reuse existing `style[data-s-id]` tags without duplicates.

**Architecture:** Put style registration behind one runtime sink module, then connect that sink to both the server renderer and the client renderer. The SFC compiler stops emitting direct DOM style insertion and instead calls the shared runtime helper, which keeps `.solace` within the current alpha syntax surface. Public exports stay narrow: root runtime gains `useStyle()`, server rendering still hangs off `@italone/solace/server`, and routing stays untouched.

**Tech Stack:** TypeScript, Vitest, jsdom, Playwright, existing Solace runtime/compiler, pnpm.

---

## File Structure

- Create `src/shared/html.ts`: small HTML escaping helpers shared by server serialization and style-tag serialization.
- Create `src/component/style.ts`: shared style sink, `useStyle()`, server collector, and document-backed client sink.
- Modify `src/server/render-to-string.ts`: wrap server rendering in a request-scoped style sink and return collected style tags.
- Modify `src/renderer/renderer.ts`: wrap `render()` and `hydrate()` updates in a document-backed style sink so mount/hydrate and later reactive updates dedupe by `data-s-id`.
- Modify `src/index.ts`: export `useStyle` from the root package.
- Modify `src/compiler/index.ts`: replace direct `<style>` DOM insertion with `_Solace.useStyle(scopeId, scopedCss)`.
- Modify `tests/integration/package-exports.test.ts`: root API allowlist should include `useStyle`.
- Modify `scripts/package-consumer-smoke.mjs`: packed consumer should import `useStyle` and prove a server-rendered component can register styles.
- Create `tests/unit/style/runtime-style.test.ts`: server collection, dedupe, conflict, and client mount/hydrate dedupe tests.
- Modify `tests/unit/compiler/compile.test.ts`: expect `useStyle()` in generated code instead of direct DOM style insertion.
- Modify `tests/integration/sfc-compiler.test.ts`: verify an SFC mounts with exactly one injected style tag.
- Modify docs: `docs/api.md`, `docs/api.zh-CN.md`, `docs/package-usage.md`, `docs/project-status.md`, `docs/project-status.zh-CN.md`, `docs/roadmap.md`, `readme.md`, `readme.zh-CN.md`.

---

### Task 1: Add failing style runtime coverage and public export checks

**Files:**

- Create: `tests/unit/style/runtime-style.test.ts`
- Modify: `tests/integration/package-exports.test.ts`
- Modify: `scripts/package-consumer-smoke.mjs`

- [x] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, beforeEach } from "vitest";

import { createApp, h, nextTick, ref, useStyle } from "../../../src";
import { renderToString } from "../../../src/server";

describe("useStyle", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("throws when called outside an active render context", () => {
    expect(() => useStyle("abc123", ".counter { color: blue; }")).toThrow(/rendering a component/i);
  });

  it("collects styles during server rendering as serialized style tags", () => {
    const App = () => {
      useStyle("abc123", ".counter { color: blue; }");
      return h("button", { class: "counter" }, "count: 0");
    };

    expect(renderToString(h(App))).toEqual({
      html: '<button class="counter">count: 0</button>',
      styles: ['<style data-s-id="abc123">.counter { color: blue; }</style>'],
    });
  });

  it("dedupes identical registrations and rejects conflicting registrations on the server", () => {
    const StableApp = () => {
      useStyle("abc123", ".counter { color: blue; }");
      useStyle("abc123", ".counter { color: blue; }");
      return h("p", null, "stable");
    };
    const ConflictApp = () => {
      useStyle("abc123", ".counter { color: blue; }");
      useStyle("abc123", ".counter { color: red; }");
      return h("p", null, "conflict");
    };

    expect(renderToString(h(StableApp)).styles).toEqual([
      '<style data-s-id="abc123">.counter { color: blue; }</style>',
    ]);
    expect(() => renderToString(h(ConflictApp))).toThrow(/style conflict/i);
  });

  it("does not duplicate preexisting style tags during hydrate and later updates", async () => {
    document.head.innerHTML = '<style data-s-id="abc123">.counter { color: blue; }</style>';
    const count = ref(0);
    const App = () => {
      useStyle("abc123", ".counter { color: blue; }");
      return h(
        "button",
        { class: "counter", onClick: () => count.value++ },
        `count: ${count.value}`,
      );
    };
    const container = document.createElement("div");
    container.innerHTML = '<button class="counter">count: 0</button>';

    createApp(App).hydrate(container);
    container.querySelector("button")?.click();
    await nextTick();

    expect(container.innerHTML).toBe('<button class="counter">count: 1</button>');
    expect(document.head.querySelectorAll('style[data-s-id="abc123"]')).toHaveLength(1);
  });

  it("does not duplicate preexisting style tags during client-only mount", () => {
    document.head.innerHTML = '<style data-s-id="abc123">.counter { color: blue; }</style>';
    const App = () => {
      useStyle("abc123", ".counter { color: blue; }");
      return h("button", { class: "counter" }, "count: 0");
    };
    const container = document.createElement("div");

    createApp(App).mount(container);

    expect(container.innerHTML).toBe('<button class="counter">count: 0</button>');
    expect(document.head.querySelectorAll('style[data-s-id="abc123"]')).toHaveLength(1);
  });
});
```

```ts
expect(api).toMatchObject({
  createApp: expect.any(Function),
  createRouter: expect.any(Function),
  createStore: expect.any(Function),
  createWebHashHistory: expect.any(Function),
  createWebHistory: expect.any(Function),
  defineAsyncComponent: expect.any(Function),
  defineComponent: expect.any(Function),
  effect: expect.any(Function),
  Fragment: expect.any(Symbol),
  h: expect.any(Function),
  inject: expect.any(Function),
  nextTick: expect.any(Function),
  onMounted: expect.any(Function),
  onUnmounted: expect.any(Function),
  onUpdated: expect.any(Function),
  provide: expect.any(Function),
  reactive: expect.any(Function),
  ref: expect.any(Function),
  render: expect.any(Function),
  RouterLink: expect.any(Function),
  RouterView: expect.any(Function),
  useRoute: expect.any(Function),
  useRouter: expect.any(Function),
  useStyle: expect.any(Function),
  watch: expect.any(Function),
  watchEffect: expect.any(Function),
});
expect(Object.keys(api).sort()).toEqual([
  "Fragment",
  "RouterLink",
  "RouterView",
  "computed",
  "createApp",
  "createRouter",
  "createStore",
  "createWebHashHistory",
  "createWebHistory",
  "defineAsyncComponent",
  "defineComponent",
  "effect",
  "h",
  "inject",
  "nextTick",
  "onMounted",
  "onUnmounted",
  "onUpdated",
  "provide",
  "reactive",
  "ref",
  "render",
  "useRoute",
  "useRouter",
  "useStyle",
  "watch",
  "watchEffect",
]);
```

```ts
import { createApp, h, useStyle } from "@italone/solace";
import { renderToString } from "@italone/solace/server";

const Styled = () => {
  useStyle("smoke", ".smoke { color: red; }");
  return h("p", { class: "smoke" }, "server");
};

const serverRendered = renderToString(h(Styled));
if (
  serverRendered.html !== '<p class="smoke">server</p>' ||
  serverRendered.styles.length !== 1 ||
  !serverRendered.styles[0].includes('data-s-id="smoke"')
) {
  throw new Error("style runtime export mismatch");
}
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/unit/style/runtime-style.test.ts tests/integration/package-exports.test.ts`

Run: `pnpm package:smoke`

Expected: fail because `useStyle` is not exported and style collection/dedupe is not implemented yet.

- [x] **Step 3: Commit the red checkpoint**

```bash
git add tests/unit/style/runtime-style.test.ts tests/integration/package-exports.test.ts scripts/package-consumer-smoke.mjs
git commit -m "test: cover runtime style collection contract"
```

### Task 2: Implement the shared style sink and server collection

**Files:**

- Create: `src/shared/html.ts`
- Create: `src/component/style.ts`
- Modify: `src/server/render-to-string.ts`
- Modify: `src/renderer/renderer.ts`
- Modify: `src/index.ts`

- [x] **Step 1: Write the minimal implementation**

```ts
// src/shared/html.ts
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
```

```ts
// src/component/style.ts
import { getCurrentInstance } from "./lifecycle";
import { escapeAttribute, escapeHtml } from "../shared/html";

interface StyleSink {
  register(scopeId: string, css: string): void;
}

const sinkStack: StyleSink[] = [];

export function useStyle(scopeId: string, css: string): void {
  if (getCurrentInstance() === null) {
    throw new Error("useStyle() must be called while rendering a component");
  }

  const sink = sinkStack[sinkStack.length - 1];
  if (sink === undefined) {
    throw new Error("No active style sink");
  }

  sink.register(scopeId, css);
}

export function withStyleSink<T>(sink: StyleSink, run: () => T): T {
  sinkStack.push(sink);
  try {
    return run();
  } finally {
    sinkStack.pop();
  }
}

export function createServerStyleSink(): {
  styles: string[];
  register(scopeId: string, css: string): void;
} {
  const styles: string[] = [];
  const registry = new Map<string, string>();

  return {
    styles,
    register(scopeId, css) {
      registerStyle(registry, scopeId, css, (tag) => styles.push(tag));
    },
  };
}

export function createDocumentStyleSink(document: Document): StyleSink {
  const registry = new Map<string, string>();

  for (const styleElement of Array.from(document.querySelectorAll("style[data-s-id]"))) {
    const scopeId = styleElement.getAttribute("data-s-id");
    if (scopeId === null) {
      continue;
    }

    const css = styleElement.textContent ?? "";
    const existing = registry.get(scopeId);
    if (existing !== undefined && existing !== css) {
      throw new Error(`Conflicting style registration for ${scopeId}`);
    }

    registry.set(scopeId, css);
  }

  return {
    register(scopeId, css) {
      registerStyle(registry, scopeId, css, (tag) => {
        const styleElement = document.createElement("style");
        styleElement.setAttribute("data-s-id", scopeId);
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
        return tag;
      });
    },
  };
}

function registerStyle(
  registry: Map<string, string>,
  scopeId: string,
  css: string,
  onRegister: (serializedTag: string) => void,
): void {
  const existing = registry.get(scopeId);
  if (existing !== undefined) {
    if (existing !== css) {
      throw new Error(`Conflicting style registration for ${scopeId}`);
    }

    return;
  }

  registry.set(scopeId, css);
  onRegister(serializeStyleTag(scopeId, css));
}

function serializeStyleTag(scopeId: string, css: string): string {
  return `<style data-s-id="${escapeAttribute(scopeId)}">${escapeHtml(css)}</style>`;
}
```

```ts
// src/server/render-to-string.ts
import {
  createComponentInstance,
  setupComponent,
  type ComponentInstance,
} from "../component/component";
import type { Provides } from "../component/provide";
import { createServerStyleSink, withStyleSink } from "../component/style";
import { ShapeFlags } from "../shared/flags";
import { h } from "../vnode/h";
import type { ComponentType, VNode, VNodeProps } from "../vnode/vnode";

export function renderToString(
  source: RenderToStringSource,
  options: RenderToStringOptions = {},
): RenderToStringResult {
  const vnode = normalizeSource(source);
  const sink = createServerStyleSink();
  const html = withStyleSink(sink, () =>
    renderVNodeToString(vnode, null, options.provides ?? null),
  );

  return {
    html,
    styles: sink.styles,
  };
}
```

```ts
// src/renderer/renderer.ts
import { ReactiveEffect } from "../reactivity/effect";
import { queueJob } from "../scheduler/scheduler";
import type { Provides } from "../component/provide";
import { createDocumentStyleSink, withStyleSink } from "../component/style";
import { h } from "../vnode/h";
import type { ComponentType, VNode } from "../vnode/vnode";
import { patch } from "./diff";
import { hydrateVNode, SolaceHydrationError } from "./hydration";

export type RenderSource = VNode | (() => VNode);
export type HydrationSource = VNode | ComponentType;
type RenderContainer = Element & {
  _solaceRenderEffect?: ReactiveEffect<void>;
  _solaceVNode?: VNode | null;
};

export function render(
  source: RenderSource,
  container: Element,
  appProvides: Provides | null = null,
): void {
  const renderContainer = container as RenderContainer;
  const styleSink = createDocumentStyleSink(container.ownerDocument);

  if (typeof source === "function") {
    renderReactiveSource(source, renderContainer, appProvides, styleSink);
    return;
  }

  stopReactiveRender(renderContainer);
  withStyleSink(styleSink, () => renderVNode(source, renderContainer, appProvides));
}

export function hydrate(
  source: HydrationSource,
  container: Element,
  appProvides: Provides | null = null,
): void {
  const renderContainer = container as RenderContainer;
  const styleSink = createDocumentStyleSink(container.ownerDocument);
  const getVNode = (): VNode => normalizeHydrationSource(source);

  stopReactiveRender(renderContainer);

  let hydrated = false;
  const update = (): void => {
    withStyleSink(styleSink, () => {
      const vnode = getVNode();
      if (!hydrated) {
        hydrateVNode(vnode, renderContainer.firstChild, null, appProvides);
        renderContainer._solaceVNode = vnode;
        hydrated = true;
        return;
      }

      renderVNode(vnode, renderContainer, appProvides);
    });
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

function renderReactiveSource(
  source: () => VNode,
  container: RenderContainer,
  appProvides: Provides | null,
  styleSink: ReturnType<typeof createDocumentStyleSink>,
): void {
  stopReactiveRender(container);

  const update = (): void => {
    withStyleSink(styleSink, () => renderVNode(source(), container, appProvides));
  };
  const reactiveEffect = new ReactiveEffect(update, () => {
    queueJob(job);
  });
  const runner = reactiveEffect.run.bind(reactiveEffect);
  const job = (): void => {
    if (container._solaceRenderEffect === reactiveEffect) {
      runner();
    }
  };

  container._solaceRenderEffect = reactiveEffect;
  runner();
}

function stopReactiveRender(container: RenderContainer): void {
  container._solaceRenderEffect?.stop();
  container._solaceRenderEffect = undefined;
}

function renderVNode(vnode: VNode, container: RenderContainer, appProvides: Provides | null): void {
  patch(container._solaceVNode ?? null, vnode, container, null, null, appProvides);
  container._solaceVNode = vnode;
}

function normalizeHydrationSource(source: HydrationSource): VNode {
  return typeof source === "function" ? h(source) : source;
}
```

```ts
// src/index.ts
export { useStyle } from "./component/style";
```

- [x] **Step 2: Run the focused style/runtime tests**

Run: `pnpm vitest run tests/unit/style/runtime-style.test.ts tests/unit/server/render-to-string.test.ts tests/unit/renderer/hydration.test.ts tests/unit/app/create-app.test.ts`

Run: `pnpm package:smoke`

Expected: pass with server-side style collection and client dedupe working through the shared sink.

- [x] **Step 3: Commit the implementation**

```bash
git add src/shared/html.ts src/component/style.ts src/server/render-to-string.ts src/renderer/renderer.ts src/index.ts
git commit -m "feat: add shared style runtime sink"
```

### Task 3: Switch SFC compiler output to the shared runtime helper

**Files:**

- Modify: `src/compiler/index.ts`
- Modify: `tests/unit/compiler/compile.test.ts`
- Modify: `tests/integration/sfc-compiler.test.ts`

- [x] **Step 1: Write the failing compiler tests**

```ts
expect(result.code).toContain("_Solace.useStyle(");
expect(result.code).toContain('[data-s-id="');
expect(result.code).not.toContain('document.createElement("style")');
expect(result.code).not.toContain("appendChild");
```

```ts
import { createApp, nextTick } from "../../src/index";
import App from "../fixtures/SfcCounter.solace";

describe("SFC compiler integration", () => {
  it("mounts a counter SFC and injects exactly one scoped style tag", async () => {
    document.head.innerHTML = "";
    const container = document.createElement("div");

    createApp(App).mount(container);

    const styleTags = document.head.querySelectorAll("style[data-s-id]");
    expect(styleTags).toHaveLength(1);
    expect(styleTags[0]?.textContent).toContain(".counter");

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.textContent?.trim()).toContain("count: 0");

    button?.click();
    await nextTick();

    expect(button?.textContent?.trim()).toContain("count: 1");
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/unit/compiler/compile.test.ts tests/integration/sfc-compiler.test.ts`

Expected: fail because compiler output still uses direct DOM style insertion.

- [x] **Step 3: Update the compiler output**

```ts
let styleInjection = "";
if (descriptor.style && scopeId !== undefined) {
  const scoped = scopeStyle(descriptor.style, scopeId);
  styleInjection = `
  _Solace.useStyle(${JSON.stringify(scopeId)}, ${JSON.stringify(scoped)});
`;
}
```

The compiler should still scope the CSS at compile time, but the generated JavaScript must call the shared runtime helper instead of creating a `<style>` element directly.

- [x] **Step 4: Run the focused compiler tests**

Run: `pnpm vitest run tests/unit/compiler/compile.test.ts tests/integration/sfc-compiler.test.ts`

Expected: pass with generated SFC code using `useStyle()` and the browser mount path injecting exactly one scoped style tag.

- [x] **Step 5: Commit the compiler change**

```bash
git add src/compiler/index.ts tests/unit/compiler/compile.test.ts tests/integration/sfc-compiler.test.ts
git commit -m "feat: route sfc styles through runtime helper"
```

### Task 4: Refresh docs and run the repo gates

**Files:**

- Modify: `docs/api.md`
- Modify: `docs/api.zh-CN.md`
- Modify: `docs/package-usage.md`
- Modify: `docs/project-status.md`
- Modify: `docs/project-status.zh-CN.md`
- Modify: `docs/roadmap.md`
- Modify: `readme.md`
- Modify: `readme.zh-CN.md`

- [x] **Step 1: Update the public docs**

```md
import { createApp, h, useStyle } from "@italone/solace";
import { renderToString } from "@italone/solace/server";

const App = () => {
useStyle("counter", ".counter { color: blue; }");
return h("button", { class: "counter" }, "server");
};

const result = renderToString(h(App));
result.styles; // ['<style data-s-id="counter">.counter { color: blue; }</style>']
```

```md
- `useStyle(scopeId, css)`: register a scoped style block during component setup/render. Server
  rendering collects the block into `renderToString().styles` as serialized `<style>` tags; client
  mount and hydrate dedupe existing `style[data-s-id]` tags by `scopeId`.
```

```md
- SSR/hydration: `renderToString()` now collects registered styles, `hydrate()` reuses existing
  `style[data-s-id]` tags, and `useStyle()` is the shared runtime registration path.
```

```md
- SSR / hydration minimum loop — implemented through `@italone/solace/server` and
  `createApp(App).hydrate(container)` for synchronous VNode/component trees; style collection and
  hydration-safe dedupe are now included, while mismatch recovery and async boundaries remain to be
  hardened.
```

```md
- Streaming SSR, async component SSR, production asset manifest integration, and hydration mismatch
  recovery.
```

- [x] **Step 2: Run a formatting pass on the docs**

Run: `pnpm exec prettier --write docs/api.md docs/api.zh-CN.md docs/package-usage.md docs/project-status.md docs/project-status.zh-CN.md docs/roadmap.md readme.md readme.zh-CN.md`

Expected: docs remain semantically aligned, with only markdown formatting normalization if needed.

- [x] **Step 3: Run the repo gates**

Run: `pnpm release:readiness`

Run: `pnpm package:smoke`

Run: `pnpm test:e2e`

Run: `pnpm quality`

Run: `pnpm release:check`

Expected: all gates pass with the new shared style runtime, SFC compiler output, and docs in place.

- [x] **Step 4: Commit the docs and gate results**

```bash
git add docs/api.md docs/api.zh-CN.md docs/package-usage.md docs/project-status.md docs/project-status.zh-CN.md docs/roadmap.md readme.md readme.zh-CN.md
git commit -m "docs: refresh style collection status"
```
