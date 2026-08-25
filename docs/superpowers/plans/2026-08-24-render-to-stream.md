# renderToStream Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ordered streaming SSR via `renderToStream()` on `@italone/solace/server`, returning a Web-standard `ReadableStream<Uint8Array>`.

**Architecture:** A new `src/server/render-to-stream.ts` walks the VNode tree with an async generator, yielding HTML string chunks; async components are awaited inline so completed prefixes flush before resolution. Shared attribute/name/source-normalization helpers are extracted from `render-to-string.ts` into `src/server/render-shared.ts` so both modules stay byte-consistent. Styles are emitted inline at first registration using the existing dedupe-safe `ServerStyleSink`.

**Tech Stack:** TypeScript, Web `ReadableStream`/`TextEncoder` (no Node-specific imports), Vitest (jsdom unit), existing package-exports and docs-contract gates.

**Spec:** `docs/superpowers/specs/2026-08-21-render-to-stream-design.md`

**Documented deviations from spec (accepted):** rendering starts when `renderToStream()` is called (`start()` runs eagerly; no lazy start) and consumer backpressure is not honored in this slice. Both facts are recorded in `docs/api.md`.

---

### Task 1: Extract shared SSR helpers into `src/server/render-shared.ts`

Pure refactor, no behavior change. Existing suites must stay green before any new code.

**Files:**

- Create: `src/server/render-shared.ts`
- Modify: `src/server/render-to-string.ts`

- [x] **Step 1: Create `src/server/render-shared.ts` with the helpers currently private in `render-to-string.ts`**

```ts
import { escapeAttribute } from "../shared/html";
import { h } from "../vnode/h";
import type { ComponentTransport, VNode, VNodeProps } from "../vnode/vnode";

export function isVNode(value: unknown): value is VNode {
  return value !== null && typeof value === "object" && "shapeFlag" in value && "type" in value;
}

export function normalizeSource(source: VNode | ComponentTransport | (() => VNode)): VNode {
  if (isVNode(source)) {
    return source;
  }

  if (typeof source === "function") {
    return h(source as ComponentTransport);
  }

  throw new TypeError("SSR source must be a VNode or component function");
}

export function renderAttributes(props: VNodeProps | null): string {
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

export function isEventProp(key: string): boolean {
  return /^on[A-Z]/.test(key);
}

export function assertSafeHtmlName(name: string, kind: "attribute" | "element"): void {
  if (/^[A-Za-z][A-Za-z0-9:-]*$/.test(name)) {
    return;
  }

  throw new TypeError(`Invalid SSR ${kind} name: ${name}`);
}

export function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
```

- [x] **Step 2: In `src/server/render-to-string.ts`, delete the local copies of `isVNode`, `normalizeSource`, `renderAttributes`, `isEventProp`, `assertSafeHtmlName`, `hasOwn`, `isPlainObject` and import them instead**

Replace the local definitions with:

```ts
import {
  assertSafeHtmlName,
  hasOwn,
  isPlainObject,
  isVNode,
  normalizeSource,
  renderAttributes,
} from "./render-shared";
```

Keep `isThenable` local in `render-to-string.ts` (it also exists in `src/shared/utils.ts`; the local copy can be replaced by `import { isThenable } from "../shared/utils";` — do that too and delete the local copy).

- [x] **Step 3: Run unit tests to verify no behavior change**

Run: `pnpm vitest run tests/unit/server`
Expected: PASS (all existing server tests)

- [x] **Step 4: Commit**

```bash
git add src/server/render-shared.ts src/server/render-to-string.ts
git commit -m "refactor: extract shared SSR render helpers"
```

---

### Task 2: `renderToStream` skeleton with option validation (TDD)

**Files:**

- Create: `src/server/render-to-stream.ts`
- Modify: `src/server/index.ts`
- Test: `tests/unit/server/render-to-stream.test.ts`

- [x] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import { renderToStream } from "../../../src/server";
import { collectStream } from "./stream-test-utils";

describe("renderToStream options", () => {
  it("rejects non-object options", async () => {
    await expect(collectStream(renderToStream(h("p", null, "x"), null as never))).rejects.toThrow(
      TypeError,
    );
  });

  it("rejects unknown fields with a field-specific TypeError", async () => {
    await expect(
      collectStream(renderToStream(h("p", null, "x"), { stream: true } as never)),
    ).rejects.toThrow("Unknown SSR streaming option: stream");
  });

  it("rejects deferred router and manifest options", async () => {
    await expect(
      collectStream(renderToStream(h("p", null, "x"), { router: {} } as never)),
    ).rejects.toThrow("Router-aware SSR integration is deferred");
    await expect(
      collectStream(renderToStream(h("p", null, "x"), { manifest: {} } as never)),
    ).rejects.toThrow("SSR manifest integration is deferred");
  });

  it("rejects invalid context and provides values", async () => {
    await expect(
      collectStream(renderToStream(h("p", null, "x"), { context: [] } as never)),
    ).rejects.toThrow("SSR context must be a plain object");
    await expect(
      collectStream(renderToStream(h("p", null, "x"), { provides: {} } as never)),
    ).rejects.toThrow("SSR provides must be a Map");
  });
});
```

Create `tests/unit/server/stream-test-utils.ts`:

```ts
export async function collectStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let out = "";
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

export async function readFirstChunk(stream: ReadableStream<Uint8Array>): Promise<string> {
  const { value } = await stream.getReader().read();
  return new TextDecoder().decode(value ?? new Uint8Array());
}

export function stripStyleTags(html: string): string {
  return html.replace(/<style [^>]*>[\s\S]*?<\/style>/g, "");
}
```

Note: because rendering runs eagerly in `start()`, validation errors surface as a rejected stream read — that is why tests use `collectStream(...)`.rejects.

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/server/render-to-stream.test.ts`
Expected: FAIL — `renderToStream` is not exported from `src/server`.

- [x] **Step 3: Implement `src/server/render-to-stream.ts`**

```ts
import type { Provides } from "../component/provide";
import { isThenable } from "../shared/utils";
import type { VNode } from "../vnode/vnode";
import { hasOwn, isPlainObject } from "./render-shared";
import type { RenderToStringAsyncSource } from "./render-to-string";

export interface RenderToStreamOptions {
  context?: Record<string, unknown>;
  provides?: Provides;
}

export function renderToStream(
  source: RenderToStringAsyncSource,
  options: RenderToStreamOptions = {},
): ReadableStream<Uint8Array> {
  assertStreamOptions(options);
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamSource(source, options.provides ?? null)) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

async function* streamSource(
  source: RenderToStringAsyncSource,
  appProvides: Provides | null,
): AsyncGenerator<string> {
  yield ""; // placeholder; replaced in Task 3
  void source;
  void appProvides;
}

function assertStreamOptions(options: RenderToStreamOptions): void {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("SSR streaming options must be an object");
  }

  if (options.context !== undefined && !isPlainObject(options.context)) {
    throw new TypeError("SSR context must be a plain object");
  }

  if (options.provides !== undefined && !(options.provides instanceof Map)) {
    throw new TypeError("SSR provides must be a Map");
  }

  if (hasOwn(options, "manifest") || hasOwn(options, "clientEntry")) {
    throw new TypeError(
      "SSR manifest integration is deferred; compose assets in an app-local shell or adapter.",
    );
  }

  if (hasOwn(options, "router")) {
    throw new TypeError(
      "Router-aware SSR integration is deferred; pass explicit render sources instead.",
    );
  }

  const unknownKey = Reflect.ownKeys(options).find(
    (key) => key !== "context" && key !== "provides",
  );
  if (unknownKey !== undefined) {
    throw new TypeError(`Unknown SSR streaming option: ${String(unknownKey)}`);
  }
}
```

Wait — `isThenable` and `VNode` are unused in this skeleton; do not import them yet (lint would fail). Only import what is used:

```ts
import type { Provides } from "../component/provide";
import { hasOwn, isPlainObject } from "./render-shared";
import type { RenderToStringAsyncSource } from "./render-to-string";
```

- [x] **Step 4: Export from `src/server/index.ts`**

Add to the render-to-string export block:

```ts
export { renderToStream, type RenderToStreamOptions } from "./render-to-stream";
```

- [x] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/server/render-to-stream.test.ts`
Expected: PASS (4 option tests; the placeholder generator yields one empty chunk)

- [x] **Step 6: Commit**

```bash
git add src/server/render-to-stream.ts src/server/index.ts tests/unit/server/render-to-stream.test.ts tests/unit/server/stream-test-utils.ts
git commit -m "feat: add renderToStream option validation skeleton"
```

---

### Task 3: Synchronous tree streaming with byte equality (TDD)

**Files:**

- Modify: `src/server/render-to-stream.ts`
- Test: `tests/unit/server/render-to-stream.test.ts`

- [x] **Step 1: Write the failing tests (append to the file)**

```ts
import { Fragment, renderToString, renderToStringAsync } from "../../../src"; // extend existing import
// renderToString/renderToStringAsync come from "../../../src/server" in this repo — extend that import instead.

describe("renderToStream synchronous trees", () => {
  it("emits bytes identical to renderToString().html for elements, text, fragments, and components", async () => {
    const Label = () => h("strong", { class: "label" }, "hello");
    const tree = h(Fragment, null, [
      h("p", { id: "intro", "data-active": true }, "count < 1"),
      h(Label),
    ]);

    const streamed = await collectStream(renderToStream(tree));
    expect(streamed).toBe(
      '<p id="intro" data-active="true">count &lt; 1</p><strong class="label">hello</strong>',
    );
    expect(streamed).toBe(renderToString(tree).html);
  });

  it("escapes attributes and omits event props", async () => {
    const streamed = await collectStream(
      renderToStream(
        h("button", { title: '5 > "4"', onClick: () => undefined }, "Save & continue"),
      ),
    );
    expect(streamed).toBe('<button title="5 &gt; &quot;4&quot;">Save &amp; continue</button>');
  });

  it("rejects unsafe element and attribute names through stream errors", async () => {
    await expect(
      collectStream(renderToStream(h("div onclick=alert(1)", null, "bad"))),
    ).rejects.toThrow(TypeError);
  });

  it("matches renderToStringAsync for sync trees", async () => {
    const tree = h("ul", null, [h("li", null, "a"), h("li", null, "b")]);
    const streamed = await collectStream(renderToStream(tree));
    expect(streamed).toBe((await renderToStringAsync(tree)).html);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/server/render-to-stream.test.ts`
Expected: new tests FAIL (stream currently yields only `""`)

- [x] **Step 3: Implement the sync traversal generator in `render-to-stream.ts`**

Replace the placeholder `streamSource` and add:

```ts
import {
  createComponentInstance,
  setupComponent,
  type ComponentInstance,
} from "../component/component";
import { createServerStyleSink, withStyleSink, type ServerStyleSink } from "../component/style";
import { ShapeFlags } from "../shared/flags";
import { escapeHtml } from "../shared/html";
import { isThenable } from "../shared/utils";
import type { VNode, VNodeChild } from "../vnode/vnode";
import { assertSafeHtmlName, isVNode, normalizeSource, renderAttributes } from "./render-shared";

async function* streamSource(
  source: RenderToStringAsyncSource,
  appProvides: Provides | null,
  sink: ServerStyleSink,
  styles: StyleDrain,
): AsyncGenerator<string> {
  const resolved = isThenable(source) ? await source : source;
  const vnode = isVNode(resolved) ? resolved : normalizeSync(resolved);
  yield* streamVNode(vnode, null, appProvides, sink, styles);
}

function normalizeSync(source: unknown): VNode {
  if (typeof source === "function") {
    return normalizeSource(source as never);
  }
  throw new TypeError("SSR source must be a VNode or component function");
}

async function* streamVNode(
  vnode: VNode,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  sink: ServerStyleSink,
  styles: StyleDrain,
): AsyncGenerator<string> {
  if (vnode.shapeFlag & ShapeFlags.ELEMENT) {
    const tag = String(vnode.type);
    assertSafeHtmlName(tag, "element");
    yield `<${tag}${renderAttributes(vnode.props)}>`;
    yield* streamChildren(vnode.children, parentComponent, appProvides, sink, styles);
    yield `</${tag}>`;
    return;
  }

  if (vnode.shapeFlag & ShapeFlags.FRAGMENT) {
    yield* streamChildren(vnode.children, parentComponent, appProvides, sink, styles);
    return;
  }

  if (vnode.shapeFlag & ShapeFlags.COMPONENT) {
    yield* streamComponent(vnode, parentComponent, appProvides, sink, styles);
    return;
  }
}

async function* streamChildren(
  children: VNode["children"],
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  sink: ServerStyleSink,
  styles: StyleDrain,
): AsyncGenerator<string> {
  if (children === null) {
    return;
  }

  if (typeof children === "string") {
    yield escapeHtml(children);
    return;
  }

  if (Array.isArray(children)) {
    for (const child of children) {
      yield* streamVNode(child, parentComponent, appProvides, sink, styles);
    }
    return;
  }

  if (isVNode(children)) {
    yield* streamVNode(children, parentComponent, appProvides, sink, styles);
    return;
  }

  throw new TypeError(
    "Async SSR is deferred; renderToStream() accepts trees whose async components resolve synchronously or via async components only.",
  );
}

async function* streamComponent(
  vnode: VNode,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  sink: ServerStyleSink,
  styles: StyleDrain,
): AsyncGenerator<string> {
  const instance = createComponentInstance(vnode, parentComponent, appProvides);
  vnode.component = instance;
  setupComponent(instance);

  const rendered = withStyleSink(sink, () => instance.render()) as unknown;
  yield* styles.drain(sink);

  if (isThenable(rendered)) {
    throw new TypeError("Async component render functions must return a synchronous VNode");
  }

  if (!isVNode(rendered)) {
    throw new TypeError("Component render must return a VNode");
  }

  instance.subTree = rendered;
  yield* streamVNode(rendered, instance, instance.appProvides, sink, styles);
}

interface StyleDrain {
  drain(sink: ServerStyleSink): Generator<string>;
}

function createStyleDrain(): StyleDrain {
  let cursor = 0;
  return {
    *drain(sink: ServerStyleSink) {
      while (cursor < sink.styles.length) {
        yield sink.styles[cursor];
        cursor += 1;
      }
    },
  };
}
```

Update `renderToStream`'s `start` to wire the sink and drain:

```ts
    async start(controller) {
      try {
        const sink = createServerStyleSink();
        const styles = createStyleDrain();
        for await (const chunk of streamSource(source, options.provides ?? null, sink, styles)) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
```

Note: in this task, async components are NOT yet loaded (`streamComponent` throws on thenable renders). Task 4 adds async support. The `styles.drain` yields are empty until Task 5 wires `useStyle` (styles already flow through `withStyleSink`, so drain output appears naturally if a component calls `useStyle`; full style coverage is Task 5).

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/server/render-to-stream.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/server/render-to-stream.ts tests/unit/server/render-to-stream.test.ts
git commit -m "feat: stream synchronous SSR trees with byte-equality to renderToString"
```

---

### Task 4: Ordered async streaming (TDD)

**Files:**

- Modify: `src/server/render-to-stream.ts`
- Test: `tests/unit/server/render-to-stream.test.ts`

- [x] **Step 1: Write the failing tests**

```ts
import { defineAsyncComponent } from "../../../src"; // extend existing import

describe("renderToStream async trees", () => {
  it("flushes the completed prefix before an async component resolves", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const AsyncPart = defineAsyncComponent(async () => () => h("em", null, "late"));

    const stream = renderToStream(h(Fragment, null, [h("p", null, "first"), h(AsyncPart)]));
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    const firstRead = await reader.read();
    const prefix = decoder.decode(firstRead.value ?? new Uint8Array());
    expect(prefix).toContain("<p>first</p>");
    expect(prefix).not.toContain("<em>");

    release!();
    let rest = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      rest += decoder.decode(value, { stream: true });
    }
    expect(rest + decoder.decode()).toContain("<em>late</em>");
  });

  it("matches renderToStringAsync html for async trees (styles stripped from the stream)", async () => {
    const AsyncPart = defineAsyncComponent(async () => () => h("em", null, "late"));
    const tree = h(Fragment, null, [h("p", null, "first"), h(AsyncPart)]);

    const streamed = stripStyleTags(await collectStream(renderToStream(tree)));
    const buffered = (await renderToStringAsync(tree)).html;
    expect(streamed).toBe(buffered);
  });

  it("accepts a promise-wrapped source", async () => {
    const streamed = await collectStream(renderToStream(Promise.resolve(h("p", null, "lazy src"))));
    expect(streamed).toBe("<p>lazy src</p>");
  });

  it("rejects the stream when an async component fails to load", async () => {
    const Bad = defineAsyncComponent(() => Promise.reject(new Error("load failed")));
    await expect(collectStream(renderToStream(h(Bad)))).rejects.toThrow("load failed");
  });
});
```

Check the actual `defineAsyncComponent` signature in `src/component/async-component.ts` before writing the tests; adapt the loader/promise shapes to the real API (the existing `render-to-string.test.ts` async tests show the exact usage pattern — copy their construction style).

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/server/render-to-stream.test.ts`
Expected: new tests FAIL (async components currently throw or never resolve)

- [x] **Step 3: Implement async support**

In `render-to-stream.ts`, extend imports:

```ts
import { getAsyncComponentMetadata } from "../component/async-component";
```

Replace `streamComponent` with the async-aware version, mirroring `prepareComponent` in `src/shared/async-tree.ts` (load metadata, await thenable render, resolve to render function or fixed VNode):

```ts
async function* streamComponent(
  vnode: VNode,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  sink: ServerStyleSink,
  styles: StyleDrain,
): AsyncGenerator<string> {
  const metadata = getAsyncComponentMetadata(vnode.type);
  if (metadata !== undefined) {
    await metadata.load();
  }

  const instance = createComponentInstance(vnode, parentComponent, appProvides);
  vnode.component = instance;
  setupComponent(instance);

  let rendered = withStyleSink(sink, () => instance.render()) as unknown;
  yield* styles.drain(sink);

  if (isThenable(rendered)) {
    const resolved = await rendered;
    if (typeof resolved === "function") {
      const renderWithInstance = () => instance.render();
      instance.render = renderWithInstance;
      rendered = withStyleSink(sink, renderWithInstance);
      yield* styles.drain(sink);
    } else if (isVNode(resolved)) {
      instance.render = () => resolved;
      rendered = resolved;
    } else {
      throw new TypeError("Async component must resolve to a VNode or render function");
    }
  }

  if (isThenable(rendered)) {
    throw new TypeError("Async component render functions must return a synchronous VNode");
  }

  if (!isVNode(rendered)) {
    throw new TypeError("Component render must return a VNode");
  }

  instance.subTree = rendered;
  yield* streamVNode(rendered, instance, instance.appProvides, sink, styles);
}
```

(Compare against `prepareComponent` in `src/shared/async-tree.ts` — it uses `runWithInstance(instance, resolvedRender)` from that module; replicate the same semantics with the instance-bound wrapper shown above. If `runWithInstance` is exported, import and use it instead of the inline wrapper.)

Also relax the `streamChildren` thenable error to only reject thenable children (children that are raw promises remain invalid, same as buffered mode).

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/server/render-to-stream.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/server/render-to-stream.ts tests/unit/server/render-to-stream.test.ts
git commit -m "feat: stream async SSR trees with ordered prefix flushing"
```

---

### Task 5: Inline style emission with dedupe (TDD)

**Files:**

- Test: `tests/unit/server/render-to-stream.test.ts`

No new production code expected — `withStyleSink` + `styles.drain` already emit inline at first registration; this task locks the contract with tests.

- [x] **Step 1: Write the failing-or-passing tests**

```ts
import { useStyle } from "../../../src"; // extend existing import

describe("renderToStream styles", () => {
  it("emits each style tag inline exactly once, before the component subtree", async () => {
    const Styled = () => {
      useStyle("card", ".card{color:red}");
      return h("div", { class: "card" }, "x");
    };
    const streamed = await collectStream(renderToStream(h(Styled)));
    const tags = streamed.match(/<style [^>]*>[\s\S]*?<\/style>/g) ?? [];
    expect(tags).toHaveLength(1);
    expect(tags[0]).toContain('data-s-id="card"');
    expect(streamed.indexOf("<style")).toBeLessThan(streamed.indexOf("<div"));
  });

  it("dedupes repeated style registrations across sibling components", async () => {
    const Styled = () => {
      useStyle("card", ".card{color:red}");
      return h("div", null, "x");
    };
    const streamed = await collectStream(renderToStream(h(Fragment, null, [h(Styled), h(Styled)])));
    expect(streamed.match(/<style /g)).toHaveLength(1);
  });

  it("rejects conflicting style registrations for the same scope id", async () => {
    const A = () => {
      useStyle("card", ".a{}");
      return h("i", null, "a");
    };
    const B = () => {
      useStyle("card", ".b{}");
      return h("i", null, "b");
    };
    await expect(collectStream(renderToStream(h(Fragment, null, [h(A), h(B)])))).rejects.toThrow(
      "Style conflict for card",
    );
  });

  it("keeps non-style bytes identical to renderToStringAsync html", async () => {
    const Styled = () => {
      useStyle("card", ".card{color:red}");
      return h("div", null, "x");
    };
    const tree = h(Fragment, null, [h(Styled), h("p", null, "tail")]);
    const streamed = stripStyleTags(await collectStream(renderToStream(tree)));
    expect(streamed).toBe((await renderToStringAsync(tree)).html);
  });
});
```

- [x] **Step 2: Run tests**

Run: `pnpm vitest run tests/unit/server/render-to-stream.test.ts`
Expected: PASS. If the "before subtree" ordering fails, move `yield* styles.drain(sink)` so it fires immediately after each `withStyleSink` call (it already does in Task 4's code).

- [x] **Step 3: Commit**

```bash
git add tests/unit/server/render-to-stream.test.ts
git commit -m "test: lock inline style emission contract for renderToStream"
```

---

### Task 6: Package export gate

**Files:**

- Modify: `tests/integration/package-exports.test.ts:217-246`

- [x] **Step 1: Update the server subpath export assertion**

Add `renderToStream` to the expected `Object.keys(server).sort()` array (alphabetical position) and add:

```ts
expect(server.renderToStream).toEqual(expect.any(Function));
```

- [x] **Step 2: Build and run the gate**

Run: `pnpm build && pnpm vitest run tests/integration/package-exports.test.ts`
Expected: PASS

- [x] **Step 3: Run the packed-consumer smoke**

Run: `pnpm test:package` (or the repo's exact script name from `package.json` — check with `pnpm run` and use the package smoke entry)
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add tests/integration/package-exports.test.ts
git commit -m "test: gate renderToStream in server package exports"
```

---

### Task 7: Router-aware streaming integration test

**Files:**

- Test: `tests/integration/router-ssr-streaming.test.ts`

- [x] **Step 1: Write the integration test, following the composition pattern in `tests/integration/router-ssr-hydration.test.ts`**

```ts
import { describe, expect, it } from "vitest";

// Copy the imports and helpers (createRouterServerContext, router.isReady, hydrateAsync usage)
// from tests/integration/router-ssr-hydration.test.ts, then:

describe("router-aware streaming SSR", () => {
  it("streams a document that hydrates through hydrateAsync", async () => {
    // 1. Build a memory router with one route rendering h("p", null, "streamed route").
    // 2. const context = createRouterServerContext(router) — mirror the existing test's setup.
    // 3. await router.isReady().
    // 4. const html = await collectStream(renderToStream(source, { provides: context.provides })).
    // 5. Assert html contains "streamed route".
    // 6. Load into jsdom, run hydrateAsync exactly as the existing hydration test does,
    //    assert the hydrated app renders and the router view is intact.
  });
});
```

Fill in the real setup code by copying from `tests/integration/router-ssr-hydration.test.ts` — do not invent new composition APIs; use only what that file already uses.

- [x] **Step 2: Run**

Run: `pnpm vitest run tests/integration/router-ssr-streaming.test.ts`
Expected: PASS

- [x] **Step 3: Commit**

```bash
git add tests/integration/router-ssr-streaming.test.ts
git commit -m "test: cover router-aware streaming SSR with hydration"
```

---

### Task 8: Documentation and docs-contract gates

**Files:**

- Modify: `docs/api.md`, `docs/api.zh-CN.md`, `docs/package-usage.md`, `docs/project-status.md`, `docs/project-status.zh-CN.md`, `docs/roadmap.md`, `readme.md`, `readme.zh-CN.md`, `docs/compatibility.md` (only if it enumerates server exports)

- [x] **Step 1: Add a `renderToStream` section to `docs/api.md` and `docs/api.zh-CN.md`**

Content must state: signature, `ReadableStream<Uint8Array>` return, ordered streaming semantics (byte order equals `renderToStringAsync().html`), inline style emission at first registration with dedupe, eager start + no backpressure, error behavior via stream rejection, option validation, and the non-goals (no Suspense, no out-of-order, no renderer-owned router).

- [x] **Step 2: Add a usage snippet to `docs/package-usage.md`** (server subpath section):

```ts
import { renderToStream } from "@italone/solace/server";

const stream = renderToStream(App);
return new Response(stream, { headers: { "content-type": "text/html; charset=utf-8" } });
```

- [x] **Step 3: Update status/roadmap/README (en + zh)**

- `docs/project-status.md` + zh-CN: move streaming SSR from "deferred" to "implemented (beta)" in the SSR row and the weaknesses paragraph; keep remaining SSR gaps (Suspense/selective hydration, post-hydration async scheduling, renderer-owned router) listed as deferred.
- `docs/roadmap.md`: update the SSR next-phase item to record the implemented ordered-streaming slice.
- `readme.md` + `readme.zh-CN.md`: update the sentences that say streaming SSR is outside the contract.

- [x] **Step 4: Run docs-contract gates**

Run: `pnpm vitest run tests/unit/docs`
Expected: PASS — if `public-contract-docs.test.ts` requires `renderToStream()` mentions in specific docs, satisfy exactly what the assertions ask for (read the failure output; it names the file and expected string).

- [x] **Step 5: Commit**

```bash
git add docs readme.md readme.zh-CN.md
git commit -m "docs: document renderToStream streaming SSR"
```

---

### Task 9: Full quality gate

- [x] **Step 1: Run the full validation chain**

Run: `pnpm format:check && pnpm typecheck && pnpm typecheck:jsxdev && pnpm lint && pnpm test && pnpm test:package`
Expected: all PASS

- [x] **Step 2: Fix any formatting/lint drift with `pnpm format` and re-run**

- [x] **Step 3: Final commit if fixes were needed**

```bash
git add -A && git commit -m "chore: format and lint renderToStream slice"
```

---

## Self-Review Notes

- Spec coverage: API shape (Task 2), ordered streaming (3–4), inline styles (5), errors (2/4), contract gates (6), integration hydration (7), docs (8), validation chain (9). Lazy start from the spec is replaced by eager start — documented deviation, stated in docs (Task 8).
- Type consistency: `RenderToStreamOptions`, `streamSource`/`streamVNode`/`streamChildren`/`streamComponent`, `StyleDrain`/`createStyleDrain` are used consistently across tasks.
- No placeholders: every code step includes full code; Task 7's integration test deliberately defers to copying the existing router-ssr-hydration test's real composition code rather than inventing it in the plan.
