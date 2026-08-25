# Out-of-Order Streaming SSR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `mode: "out-of-order"` to `renderToStream()`: async components with an optional `fallback` render their placeholder inline, keep streaming, and are replaced in the browser by inline scripts as they resolve.

**Architecture:** `defineAsyncComponent` gains a `fallback` option exposed through its internal metadata. `render-to-stream.ts` threads a `StreamContext` through the existing generator traversal; in out-of-order mode async boundaries emit `<!--so:b:N-->fallback<!--/so:b:N-->` without awaiting, register a `PendingBoundary`, and after the main traversal a race loop emits one inline `<script>` per boundary in resolution order (a failed boundary emits a failure comment instead and does not reject the stream). Replacement scripts walk comment nodes, swap the enclosed range, and remove the markers, so the DOM is final before `hydrateAsync` runs.

**Tech Stack:** TypeScript, Web `ReadableStream`/`TextEncoder`, Vitest (jsdom), existing package-exports and docs-contract gates.

**Spec:** `docs/superpowers/specs/2026-08-25-out-of-order-streaming-design.md`

---

## File Map

- `src/component/async-component.ts`: add `fallback` to `AsyncComponentOptions`; expose it via `AsyncComponentMetadata`.
- `src/server/render-to-stream.ts`: `mode` option; `StreamContext`; boundary deferral; race-loop flush.
- `src/server/stream-boundary.ts` (new): marker and replacement-script string builders — pure functions, unit-testable in isolation.
- `tests/unit/server/render-to-stream-out-of-order.test.ts` (new): out-of-order suite.
- `tests/unit/server/stream-test-utils.ts`: reuse `collectStream`/`readFirstChunk`.
- `tests/integration/out-of-order-hydration.test.ts` (new): stream → execute scripts → hydrateAsync.
- `tests/integration/package-exports.test.ts`: mode option stays internal (no new export needed; assertion unchanged unless the suite lists option types — verify only).
- `docs/api.md`, `docs/api.zh-CN.md`, `docs/project-status.md`, `docs/project-status.zh-CN.md`, `docs/roadmap.md`, `readme.md`, `readme.zh-CN.md`: document/adjust boundary wording.

### Task 1: `fallback` option on `defineAsyncComponent`

**Files:**

- Modify: `src/component/async-component.ts`
- Test: `tests/unit/component/async-component-fallback.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { defineAsyncComponent } from "../../../src/component/async-component";
import { getAsyncComponentMetadata } from "../../../src/component/async-component";
import { h } from "../../../src";

describe("defineAsyncComponent fallback option", () => {
  it("exposes the fallback VNode through metadata", () => {
    const fallback = h("p", null, "loading…");
    const AsyncPart = defineAsyncComponent({
      loader: async () => () => h("em", null, "late"),
      fallback,
    });
    expect(getAsyncComponentMetadata(AsyncPart)?.getFallback?.()).toBe(fallback);
  });

  it("supports fallback factory functions and defaults to null", () => {
    const fallback = h("p", null, "loading…");
    const WithFactory = defineAsyncComponent({
      loader: async () => () => h("em", null, "late"),
      fallback: () => fallback,
    });
    expect(getAsyncComponentMetadata(WithFactory)?.getFallback?.()).toBe(fallback);

    const Without = defineAsyncComponent(async () => () => h("em", null, "late"));
    expect(getAsyncComponentMetadata(Without)?.getFallback?.()).toBeNull();
  });

  it("keeps the loader-only shorthand unchanged", () => {
    const AsyncPart = defineAsyncComponent(async () => () => h("em", null, "late"));
    expect(typeof AsyncPart).toBe("function");
    expect(getAsyncComponentMetadata(AsyncPart)?.getFallback?.()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/unit/component/async-component-fallback.test.ts`
Expected: FAIL — `getFallback` is not a function on metadata.

- [ ] **Step 3: Implement**

In `src/component/async-component.ts`:

Add to `AsyncComponentOptions` (after `retryDelay?: number;`):

```ts
  fallback?: VNode | (() => VNode);
```

Extend the `AsyncComponentOptions` import chain: `import { Fragment, type ComponentType, type VNode, type VNodeChildren } from "../vnode/vnode";` (add `type VNode`).

Extend `AsyncComponentMetadata`:

```ts
export interface AsyncComponentMetadata {
  load(): Promise<ComponentType<never>>;
  peek(): ComponentType<never> | null;
  getFallback(): VNode | null;
}
```

Replace the `asyncComponentMetadata.set(component, { ... })` block with:

```ts
asyncComponentMetadata.set(component, {
  load: loadForPreparation as () => Promise<ComponentType<never>>,
  peek: () => resolvedComponent as ComponentType<never> | null,
  getFallback: () => {
    const fallback = options.fallback;
    if (fallback === undefined) return null;
    return typeof fallback === "function" ? fallback() : fallback;
  },
});
```

Note: the fallback factory branch cannot distinguish "factory function" from "VNode" — `VNode` is an object, `() => VNode` is a function, so `typeof fallback === "function"` is the correct discriminator. Do not touch the render path (`component` body) — buffered/CSR behavior is unchanged in this task.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/unit/component/async-component-fallback.test.ts tests/unit/component`
Expected: PASS (new file and the whole existing component suite).

- [ ] **Step 5: Commit**

```bash
git add src/component/async-component.ts tests/unit/component/async-component-fallback.test.ts
git commit -m "feat: add fallback option to defineAsyncComponent"
```

---

### Task 2: `mode` option validation on `renderToStream`

**Files:**

- Modify: `src/server/render-to-stream.ts`
- Test: `tests/unit/server/render-to-stream-out-of-order.test.ts`

- [ ] **Step 1: Write the failing tests (create the suite file)**

```ts
import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import { renderToStream } from "../../../src/server";
import { collectStream } from "./stream-test-utils";

describe("renderToStream mode option", () => {
  it("defaults to ordered behavior when mode is omitted", async () => {
    const streamed = await collectStream(renderToStream(h("p", null, "x")));
    expect(streamed).toBe("<p>x</p>");
  });

  it('accepts mode: "ordered" explicitly', async () => {
    const streamed = await collectStream(renderToStream(h("p", null, "x"), { mode: "ordered" }));
    expect(streamed).toBe("<p>x</p>");
  });

  it('accepts mode: "out-of-order"', async () => {
    const streamed = await collectStream(
      renderToStream(h("p", null, "x"), { mode: "out-of-order" }),
    );
    expect(streamed).toBe("<p>x</p>");
  });

  it("rejects invalid mode values", async () => {
    await expect(
      collectStream(renderToStream(h("p", null, "x"), { mode: "concurrent" as never })),
    ).rejects.toThrow('SSR streaming mode must be "ordered" or "out-of-order"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/unit/server/render-to-stream-out-of-order.test.ts`
Expected: FAIL — `Unknown SSR streaming option: mode`.

- [ ] **Step 3: Implement**

In `src/server/render-to-stream.ts`:

Extend the options interface:

```ts
export interface RenderToStreamOptions {
  context?: Record<string, unknown>;
  provides?: Provides;
  mode?: "ordered" | "out-of-order";
}
```

In `assertStreamOptions`, after the `provides` check and before the `manifest` check, add:

```ts
if (options.mode !== undefined && options.mode !== "ordered" && options.mode !== "out-of-order") {
  throw new TypeError('SSR streaming mode must be "ordered" or "out-of-order"');
}
```

Update the unknown-key filter (`fallback` lives on async components, not on stream options, so it stays unknown here):

```ts
const unknownKey = Reflect.ownKeys(options).find(
  (key) => key !== "context" && key !== "provides" && key !== "mode",
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/unit/server/render-to-stream-out-of-order.test.ts tests/unit/server/render-to-stream.test.ts`
Expected: PASS (both files; ordered suite unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/server/render-to-stream.ts tests/unit/server/render-to-stream-out-of-order.test.ts
git commit -m "feat: validate renderToStream mode option"
```

---

### Task 3: Boundary markers, fallback emission, and deferral

In this task out-of-order boundaries emit `<!--so:b:N-->fallback<!--/so:b:N-->` and defer loading; the flush loop exists but emits nothing for resolved boundaries yet (replacement scripts are Task 4). The stream still closes after all pending boundaries settle.

**Files:**

- Create: `src/server/stream-boundary.ts`
- Modify: `src/server/render-to-stream.ts`
- Test: `tests/unit/server/render-to-stream-out-of-order.test.ts`

- [ ] **Step 1: Write the failing tests (append)**

```ts
import { defineAsyncComponent } from "../../../src";
import { Fragment } from "../../../src";

describe("renderToStream out-of-order boundaries", () => {
  it("emits fallback markers without waiting for the loader", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const AsyncPart = defineAsyncComponent({
      loader: () => gate.then(() => Promise.resolve(() => h("em", null, "late"))),
      fallback: h("p", null, "loading…"),
    });

    const stream = renderToStream(h(Fragment, null, [h("b", null, "first"), h(AsyncPart)]), {
      mode: "out-of-order",
    });
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    const firstRead = await reader.read();
    const prefix = decoder.decode(firstRead.value ?? new Uint8Array());
    expect(prefix).toContain("<b>first</b>");
    expect(prefix).toContain("<!--so:b:1-->");
    expect(prefix).toContain("<p>loading…</p>");
    expect(prefix).toContain("<!--/so:b:1-->");
    expect(prefix).not.toContain("<em>");

    release!();
    // Drain the rest; Task 3 asserts only that the stream closes.
    for (;;) {
      const { done } = await reader.read();
      if (done) break;
    }
  });

  it("uses an empty placeholder when no fallback is provided", async () => {
    const AsyncPart = defineAsyncComponent(async () => () => h("em", null, "late"));
    const streamed = await collectStream(
      renderToStream(h(Fragment, null, [h("b", null, "first"), h(AsyncPart)]), {
        mode: "out-of-order",
      }),
    );
    expect(streamed).toContain("<!--so:b:1--><!--/so:b:1-->");
  });

  it("numbers boundary ids monotonically across the tree", async () => {
    const A = defineAsyncComponent(async () => () => h("i", null, "a"));
    const B = defineAsyncComponent(async () => () => h("i", null, "b"));
    const streamed = await collectStream(
      renderToStream(h(Fragment, null, [h(A), h(B)]), { mode: "out-of-order" }),
    );
    expect(streamed).toContain("so:b:1");
    expect(streamed).toContain("so:b:2");
  });

  it("still awaits async components inline in ordered mode (no markers)", async () => {
    const AsyncPart = defineAsyncComponent({
      loader: async () => () => h("em", null, "late"),
      fallback: h("p", null, "loading…"),
    });
    const streamed = await collectStream(renderToStream(h(AsyncPart)));
    expect(streamed).toBe("<em>late</em>");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/unit/server/render-to-stream-out-of-order.test.ts`
Expected: FAIL — no markers are emitted; the first test hangs or times out because ordered mode awaits the gate.

- [ ] **Step 3: Create `src/server/stream-boundary.ts`**

```ts
export function boundaryStartMarker(id: number): string {
  return `<!--so:b:${id}-->`;
}

export function boundaryEndMarker(id: number): string {
  return `<!--/so:b:${id}-->`;
}

export function boundaryFailureMarker(id: number, message: string): string {
  return `<!--so:b:${id} failed:${message}-->`;
}

export interface PendingBoundary {
  id: number;
  ready: Promise<void>;
  error: unknown;
  component: unknown;
}

export function createPendingBoundary(id: number, load: Promise<unknown>): PendingBoundary {
  const boundary: PendingBoundary = {
    id,
    error: null,
    component: null,
    ready: null as never,
  };
  boundary.ready = load.then(
    (component) => {
      boundary.component = component;
    },
    (error) => {
      boundary.error = error;
    },
  );
  return boundary;
}
```

- [ ] **Step 4: Thread `StreamContext` and defer boundaries in `render-to-stream.ts`**

Add imports:

```ts
import {
  boundaryEndMarker,
  boundaryStartMarker,
  createPendingBoundary,
  type PendingBoundary,
} from "./stream-boundary";
```

Add the context type after `RenderToStreamOptions`:

```ts
type StreamMode = "ordered" | "out-of-order";

interface StreamContext {
  mode: StreamMode;
  appProvides: Provides | null;
  sink: ServerStyleSink;
  styles: StyleDrain;
  pending: PendingBoundary[];
  nextBoundaryId(): number;
}

function createStreamContext(mode: StreamMode, appProvides: Provides | null): StreamContext {
  let nextId = 0;
  return {
    mode,
    appProvides,
    sink: createServerStyleSink(),
    styles: createStyleDrain(),
    pending: [],
    nextBoundaryId: () => {
      nextId += 1;
      return nextId;
    },
  };
}
```

Mechanical refactor (no behavior change in ordered mode): replace the parameter lists `(vnode, parentComponent, appProvides, sink, styles)` / `(source, appProvides, sink, styles)` / `(children, parentComponent, appProvides, sink, styles)` on `streamSource`, `streamVNode`, `streamChildren`, `streamComponent` with a single trailing `ctx: StreamContext`. Inside each function substitute `ctx.appProvides` for `appProvides`, `ctx.sink` for `sink`, and `ctx.styles` for `styles`. Every recursive call site updates accordingly, e.g. `streamChildren(vnode.children, parentComponent, ctx)`.

Update `renderToStream`'s `start` to build the context and flush pending boundaries after the main loop:

```ts
try {
  const ctx = createStreamContext(options.mode ?? "ordered", options.provides ?? null);
  const iterator = streamSource(source, ctx)[Symbol.asyncIterator]();
  let buffer = "";

  for (;;) {
    const nextPromise = iterator.next();
    let settled = false;
    void nextPromise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    for (let turn = 0; turn < MAX_SYNCHRONOUS_MICROTASK_ROUNDS && !settled; turn += 1) {
      await null;
    }

    if (!settled && buffer !== "") {
      controller.enqueue(encoder.encode(buffer));
      buffer = "";
    }

    const result = await nextPromise;
    if (result.done) {
      break;
    }
    buffer += result.value;
  }

  for await (const chunk of flushPendingBoundaries(ctx)) {
    buffer += chunk;
    controller.enqueue(encoder.encode(buffer));
    buffer = "";
  }

  if (buffer !== "") {
    controller.enqueue(encoder.encode(buffer));
  }
  controller.close();
} catch (error) {
  controller.error(error);
}
```

`streamSource` becomes:

```ts
async function* streamSource(
  source: RenderToStringAsyncSource,
  ctx: StreamContext,
): AsyncGenerator<string> {
  const resolved = isThenable(source) ? await source : source;
  const vnode = isVNode(resolved) ? resolved : normalizeSync(resolved);
  yield* streamVNode(vnode, null, ctx);
}
```

Replace the async branch at the top of `streamComponent`:

```ts
async function* streamComponent(
  vnode: VNode,
  parentComponent: ComponentInstance | null,
  ctx: StreamContext,
): AsyncGenerator<string> {
  const metadata = getAsyncComponentMetadata(vnode.type);
  if (metadata !== undefined) {
    if (ctx.mode === "out-of-order") {
      yield* streamOutOfOrderBoundary(vnode, metadata, parentComponent, ctx);
      return;
    }
    await metadata.load();
  }

  yield* streamLoadedComponent(vnode, parentComponent, ctx);
}
```

Add the boundary emitter and the shared post-load renderer (extracted from the old `streamComponent` body after `await metadata.load()`):

```ts
async function* streamOutOfOrderBoundary(
  vnode: VNode,
  metadata: NonNullable<ReturnType<typeof getAsyncComponentMetadata>>,
  parentComponent: ComponentInstance | null,
  ctx: StreamContext,
): AsyncGenerator<string> {
  const id = ctx.nextBoundaryId();
  const boundary = createPendingBoundary(id, metadata.load());
  ctx.pending.push(boundary);

  yield boundaryStartMarker(id);
  const fallback = metadata.getFallback();
  if (fallback !== null) {
    yield* streamVNode(fallback, parentComponent, ctx);
  }
  yield boundaryEndMarker(id);
}

async function* streamLoadedComponent(
  vnode: VNode,
  parentComponent: ComponentInstance | null,
  ctx: StreamContext,
): AsyncGenerator<string> {
  const instance = createComponentInstance(vnode, parentComponent, ctx.appProvides);
  vnode.component = instance;
  setupComponent(instance);

  let rendered = withStyleSink(ctx.sink, () => instance.render()) as unknown;

  if (isThenable(rendered)) {
    const resolved = await rendered;
    if (typeof resolved === "function") {
      const renderWithInstance = () => runWithInstance(instance, resolved as () => VNode);
      instance.render = renderWithInstance;
      rendered = withStyleSink(ctx.sink, renderWithInstance);
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

  yield* ctx.styles.drain(ctx.sink);

  instance.subTree = rendered;
  yield* streamVNode(rendered, instance, instance.appProvides, ctx);
}
```

Add the flush loop (Task 3 form — it only awaits settlement; Task 4 replaces it with the resolution-order emitter):

```ts
async function* flushPendingBoundaries(ctx: StreamContext): AsyncGenerator<string> {
  await Promise.all(ctx.pending.map((boundary) => boundary.ready));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/unit/server/render-to-stream-out-of-order.test.ts tests/unit/server/render-to-stream.test.ts tests/unit/server`
Expected: PASS — all three (existing suites confirm the ordered path is byte-identical after the refactor).

- [ ] **Step 6: Commit**

```bash
git add src/server/stream-boundary.ts src/server/render-to-stream.ts tests/unit/server/render-to-stream-out-of-order.test.ts
git commit -m "feat: defer out-of-order stream boundaries with fallback markers"
```

---

### Task 4: Replacement scripts in resolution order + failure markers

**Files:**

- Modify: `src/server/stream-boundary.ts`
- Modify: `src/server/render-to-stream.ts`
- Test: `tests/unit/server/render-to-stream-out-of-order.test.ts`

- [ ] **Step 1: Write the failing tests (append)**

```ts
import { useStyle } from "../../../src";

describe("renderToStream out-of-order replacement", () => {
  it("emits an inline replacement script after the document, in resolution order", async () => {
    const order: string[] = [];
    const first = new Promise<void>((resolve) => setTimeout(resolve, 20));
    const Slow = defineAsyncComponent({
      loader: () => first.then(() => Promise.resolve(() => h("em", null, "slow"))),
      fallback: h("p", null, "slow…"),
    });
    const Fast = defineAsyncComponent(async () => () => h("strong", null, "fast"));

    const streamed = await collectStream(
      renderToStream(h(Fragment, null, [h(Slow), h(Fast)]), { mode: "out-of-order" }),
    );

    expect(streamed).toContain("so:b:1");
    expect(streamed).toContain("so:b:2");
    const fastScriptIndex = streamed.indexOf("so:r:2");
    const slowScriptIndex = streamed.indexOf("so:r:1");
    expect(fastScriptIndex).toBeGreaterThan(-1);
    expect(slowScriptIndex).toBeGreaterThan(fastScriptIndex);
    expect(streamed.slice(slowScriptIndex)).toContain("<em>slow</em>");
  });

  it("keeps fallback and emits a failure comment when a boundary rejects", async () => {
    const Bad = defineAsyncComponent({
      loader: () => Promise.reject(new Error("load failed")),
      fallback: h("p", null, "loading…"),
    });
    const streamed = await collectStream(
      renderToStream(h(Fragment, null, [h("b", null, "ok"), h(Bad)]), { mode: "out-of-order" }),
    );
    expect(streamed).toContain("<b>ok</b>");
    expect(streamed).toContain("<p>loading…</p>");
    expect(streamed).toContain("failed:load failed");
    expect(streamed).not.toContain("so:r:1");
  });

  it("does not reject the stream when a boundary rejects", async () => {
    const Bad = defineAsyncComponent(() => Promise.reject(new Error("boom")));
    const streamed = await collectStream(renderToStream(h(Bad), { mode: "out-of-order" }));
    expect(typeof streamed).toBe("string");
  });

  it("embeds style tags registered inside the boundary subtree", async () => {
    const Styled = defineAsyncComponent(async () => {
      return () => {
        useStyle("card", ".card{color:red}");
        return h("div", { class: "card" }, "x");
      };
    });
    const streamed = await collectStream(
      renderToStream(h(Fragment, null, [h(Styled), h("p", null, "tail")]), {
        mode: "out-of-order",
      }),
    );
    expect(streamed).toContain("so:r:1");
    expect(streamed).toContain('data-s-id="card"');
  });

  it("neutralizes closing script sequences in embedded content", async () => {
    const Tricky = defineAsyncComponent(async () => () => h("p", null, "</script>"));
    const streamed = await collectStream(renderToStream(h(Tricky), { mode: "out-of-order" }));
    expect(streamed).not.toContain("</script></script>");
    expect(streamed).toContain("<\\/script>");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/unit/server/render-to-stream-out-of-order.test.ts`
Expected: new tests FAIL — no `so:r:` scripts, no failure markers, no style embedding.

- [ ] **Step 3: Implement the script builder in `stream-boundary.ts`**

```ts
export function replacementScriptMarker(id: number): string {
  return `so:r:${id}`;
}

export function buildReplacementScript(id: number, html: string): string {
  const payload = JSON.stringify(html).replace(/<\//gu, "<\\/");
  return (
    `<script>(function(){var s=null,e=null;` +
    `var w=document.createTreeWalker(document,NodeFilter.SHOW_COMMENT,null,false);` +
    `while(w.nextNode()){var n=w.currentNode;` +
    `if(n.nodeValue==="so:b:${id}"){s=n}else if(n.nodeValue==="/so:b:${id}"){e=n}}` +
    `if(!s||!e){return}` +
    `var r=document.createRange();r.setStartAfter(s);r.setEndBefore(e);` +
    `var t=document.createElement("template");t.innerHTML=${payload};` +
    `r.deleteContents();r.insertNode(t.content);` +
    `if(s.parentNode){s.parentNode.removeChild(s)}` +
    `if(e.parentNode){e.parentNode.removeChild(e)}})();` +
    `</script>`
  );
}
```

- [ ] **Step 4: Implement the resolution-order flush in `render-to-stream.ts`**

Import `boundaryFailureMarker`, `buildReplacementScript`, `replacementScriptMarker`, and `escapeHtml` (already imported). Replace `flushPendingBoundaries` with:

```ts
async function* flushPendingBoundaries(ctx: StreamContext): AsyncGenerator<string> {
  const remaining = new Set(ctx.pending);

  while (remaining.size > 0) {
    const winner = await racePending(remaining);
    remaining.delete(winner);
    yield replacementScriptMarker(winner.id);

    if (winner.error !== null) {
      yield boundaryFailureMarker(
        winner.id,
        escapeHtml(winner.error instanceof Error ? winner.error.message : String(winner.error)),
      );
      continue;
    }

    const html = await collectBoundaryHtml(winner, ctx);
    yield buildReplacementScript(winner.id, html);
  }
}

function racePending(remaining: Set<PendingBoundary>): Promise<PendingBoundary> {
  return new Promise((resolve) => {
    for (const boundary of remaining) {
      void boundary.ready.then(() => resolve(boundary));
    }
  });
}

async function collectBoundaryHtml(boundary: PendingBoundary, ctx: StreamContext): Promise<string> {
  const loader = boundary.component as () => VNode;
  const subtree = loader();
  let html = "";
  for await (const chunk of streamVNode(subtree, null, ctx)) {
    html += chunk;
  }
  return html;
}
```

Style handling: `streamVNode` on a component subtree drains new sink styles into the yielded stream automatically (the sink is shared, the drain cursor only moves forward, so styles already flushed with the prefix are not re-emitted). No extra style code is needed; the Task-4 style test locks this.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/unit/server/render-to-stream-out-of-order.test.ts tests/unit/server/render-to-stream.test.ts tests/unit/server`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/stream-boundary.ts src/server/render-to-stream.ts tests/unit/server/render-to-stream-out-of-order.test.ts
git commit -m "feat: emit out-of-order replacement scripts in resolution order"
```

---

### Task 5: Hydration round-trip integration test

**Files:**

- Test: `tests/integration/out-of-order-hydration.test.ts`

- [ ] **Step 1: Read `tests/integration/router-ssr-streaming.test.ts` first**

Copy its import style and hydration invocation pattern (`hydrateAsync` usage and any `createSSRTestContainer`-style helper it uses). Do not invent new composition APIs; use exactly what that file uses to load streamed HTML into jsdom and hydrate.

- [ ] **Step 2: Write the integration test**

```ts
import { describe, expect, it } from "vitest";

import { defineAsyncComponent, Fragment, h, ref } from "@italone/solace";
import { hydrateAsync, renderToStream } from "@italone/solace/server";
// If the repo convention imports from relative paths instead of the package
// name, mirror tests/integration/router-ssr-streaming.test.ts exactly.

function collectStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let out = "";
  return stream
    .getReader()
    .read()
    .then(function read({ done, value }): Promise<string> {
      if (done) return Promise.resolve(out + decoder.decode());
      out += decoder.decode(value, { stream: true });
      return stream.getReader().read().then(read);
    });
}

// jsdom does not execute scripts inserted via innerHTML; run them explicitly.
function executeInlineScripts(html: string): void {
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/gu)) {
    new Function(match[1])();
  }
}

describe("out-of-order streaming hydration", () => {
  it("replaces boundaries in the DOM and hydrates the final markup", async () => {
    const AsyncPart = defineAsyncComponent({
      loader: async () => () => h("em", { id: "late" }, "resolved"),
      fallback: h("p", null, "loading…"),
    });
    const count = ref(0);
    const App = () =>
      h(Fragment, null, [
        h("button", { id: "inc", onClick: () => (count.value += 1) }, `count: ${count.value}`),
        h(AsyncPart),
      ]);

    const html = await collectStream(renderToStream(h(App), { mode: "out-of-order" }));

    // The replacement scripts must come after the markers.
    expect(html).toContain("so:b:1");
    expect(html).toContain("so:r:1");
    expect(html.indexOf("so:r:1")).toBeGreaterThan(html.indexOf("so:b:1"));

    const container = document.createElement("div");
    // Strip script tags: jsdom will not execute them from innerHTML; we run
    // them explicitly below with the container already attached to the document.
    container.innerHTML = html.replace(/<script>[\s\S]*?<\/script>/gu, "");
    document.body.appendChild(container);

    executeInlineScripts(html);

    expect(container.querySelector("#late")?.textContent).toBe("resolved");
    expect(container.textContent).not.toContain("loading…");

    await hydrateAsync(App, { container, recover: true });
    (container.querySelector("#inc") as HTMLButtonElement).click();
    await Promise.resolve();
    expect(container.querySelector("#inc")?.textContent).toContain("count: 1");
  });
});
```

Adaptation notes for the executor:

- If `hydrateAsync`'s real signature differs (check `src/renderer/hydration.ts` and how `router-ssr-streaming.test.ts` calls it), use the real signature. The assertions (marker replaced, fallback gone, hydrated interaction works) are the contract; the setup code adapts.
- If `ref` is not exported from the package root in this repo's convention, mirror the integration test's existing reactive imports.
- If the jsdom environment does not provide `createTreeWalker` with the `null` filter argument signature used by the script, keep the script exactly as generated — it must work in real browsers and jsdom alike; if jsdom fails on the walker, that is a bug in the script builder, not the test.

- [ ] **Step 3: Run the test**

Run: `pnpm exec vitest run tests/integration/out-of-order-hydration.test.ts`
Expected: PASS. If the replacement does not happen in jsdom, debug the script builder (likely marker lookup), not the test.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/out-of-order-hydration.test.ts
git commit -m "test: cover out-of-order stream hydration round-trip"
```

---

### Task 6: Documentation and docs-contract gates

**Files:**

- Modify: `docs/api.md`, `docs/api.zh-CN.md`, `docs/package-usage.md`, `docs/project-status.md`, `docs/project-status.zh-CN.md`, `docs/roadmap.md`, `readme.md`, `readme.zh-CN.md`

- [ ] **Step 1: Add an out-of-order subsection to the `renderToStream` section in `docs/api.md` and `docs/api.zh-CN.md`**

Content must state: the `mode: "out-of-order"` option; `defineAsyncComponent({ loader, fallback })`; marker/script protocol summary; resolution-order flushing; failure semantics (fallback kept, stream not rejected, failure comment emitted — differs from ordered mode which rejects); hydration compatibility (DOM is final before client code runs); non-goals (no Suspense, no selective hydration, no backpressure).

- [ ] **Step 2: Update status/roadmap/README (en + zh)**

- `docs/project-status.md` + `.zh-CN.md`: SSR row gains out-of-order streaming (beta); Known Gaps drops "Out-of-order streaming SSR" from the deferred list while keeping Suspense/selective hydration deferred.
- `docs/roadmap.md`: record the implemented out-of-order slice.
- `readme.md` + `readme.zh-CN.md`: update any sentence claiming out-of-order streaming is unsupported/deferred.
- `docs/package-usage.md`: extend the server subpath snippet with the `mode` option.

- [ ] **Step 3: Run docs-contract gates**

Run: `pnpm exec vitest run tests/unit/docs`
Expected: PASS. On failure, read the assertion output — it names the file and expected string; satisfy exactly what it asks for.

- [ ] **Step 4: Commit**

```bash
git add docs readme.md readme.zh-CN.md
git commit -m "docs: document out-of-order streaming SSR"
```

---

### Task 7: Full quality gate

- [ ] **Step 1: Run the full validation chain**

Run: `pnpm format:check && pnpm typecheck && pnpm typecheck:jsxdev && pnpm lint && pnpm test`
Expected: all PASS.

- [ ] **Step 2: Fix drift with `pnpm format` and targeted edits, then re-run**

- [ ] **Step 3: Run the package gates**

Run: `pnpm build && pnpm test:package && pnpm package:smoke`
Expected: PASS.

- [ ] **Step 4: Final commit if fixes were needed**

```bash
git add -A && git commit -m "chore: format and lint out-of-order streaming slice"
```

---

## Self-Review Notes

- Spec coverage: API (`fallback` Task 1, `mode` Task 2), wire protocol (Task 3 markers, Task 4 scripts/failure markers/escaping), scheduling (Task 3 deferral, Task 4 race loop), hydration compatibility (Task 5), docs/gates (Tasks 6-7). Styles: covered by Task 4's style test via shared sink drain.
- The Task 3 flush loop is deliberately minimal (`Promise.all`) and is fully replaced in Task 4 — no dead intermediate contract is asserted on ordering.
- `escapeHtml` reuse for failure messages and `JSON.stringify` + `<\/` escaping for script payloads are pinned by tests.
- Ordered-mode byte equality is asserted by the pre-existing `render-to-stream.test.ts` suite after every refactor step in Tasks 2-4.
