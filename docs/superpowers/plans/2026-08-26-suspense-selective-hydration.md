# Suspense + Selective Hydration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `<Suspense>` built-in component (subtree-level async coordination, CSR + SSR) and event-driven selective hydration (`hydrateAsync(..., { selective: true })`) that buffers user interactions while async boundaries resolve, then hydrates/re-renders them incrementally.

**Architecture:** `src/component/suspense.ts` implements Suspense following the `defineAsyncComponent` component pattern (outer body collects subtree loaders once, inner render closure swaps fallback → children on resolution; loaders already resolved are detected synchronously via `metadata.peek()`). `render-to-stream.ts` routes Suspense through the existing `so:b` boundary protocol (`Promise.all` of subtree loaders as the boundary's readiness). `hydration.ts` gains comment-node tolerance; `renderer.ts` gains the `selective` option: unresolved async/Suspense components hydrate against their fallback DOM inside the marker range and re-render via the existing instance update machinery on resolution; `selective-events.ts` buffers and replays interactions.

**Tech Stack:** TypeScript, Vitest (jsdom), existing package-exports and docs-contract gates.

**Spec:** `docs/superpowers/specs/2026-08-25-suspense-selective-hydration-design.md`

---

## File Map

- `src/component/suspense.ts` (new): Suspense built-in component + `collectAsyncLoaders` VNode-tree walker + `isSuspense` marker.
- `src/index.ts`: export `Suspense` (and JSX type if the runtime exports intrinsic elements — verify what `src/jsx` expects; only add what the repo convention requires).
- `src/server/render-to-stream.ts`: Suspense routing in `streamComponent` (ordered: await subtree loaders; out-of-order: one boundary per Suspense).
- `src/server/stream-boundary.ts`: no changes expected (verify).
- `src/renderer/hydration.ts`: comment-node skipping at every walk dispatch point.
- `src/renderer/renderer.ts`: `selective` option on `HydrationOptions` (hydrateAsync only), selective hydration flow.
- `src/renderer/selective-events.ts` (new): `SelectiveEventBuffer` — attach/detach capture listeners, record/replay/drop.
- `tests/unit/component/suspense.test.ts` (new), `tests/unit/renderer/selective-hydration.test.ts` (new), `tests/unit/renderer/selective-events.test.ts` (new).
- `tests/integration/suspense-selective-hydration.test.ts` (new).
- Docs: `docs/api.md`, `docs/api.zh-CN.md`, `docs/project-status.md`, `docs/project-status.zh-CN.md`, `docs/roadmap.md`, `readme.md`, `readme.zh-CN.md`, `docs/package-usage.md`.

Adaptation note for executors (applies to every task): this repo's tests import from relative paths (`../../../src`, `../../../src/server`) and option-validation failures are asserted **synchronously** with `expect(() => ...).toThrow`. Mirror `tests/unit/server/render-to-stream-out-of-order.test.ts` and `tests/integration/out-of-order-hydration.test.ts` conventions exactly.

### Task 1: `Suspense` component (CSR + sync-resolved fast path)

**Files:**

- Create: `src/component/suspense.ts`
- Modify: `src/index.ts`
- Test: `tests/unit/component/suspense.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import { defineAsyncComponent, Fragment, h, Suspense } from "../../../src";
import { getAsyncComponentMetadata } from "../../../src/component/async-component";
import { render } from "../../../src/renderer/renderer";

function collectText(el: Element): string {
  return el.textContent ?? "";
}

describe("Suspense component", () => {
  it("renders fallback while subtree loaders are pending, then swaps", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const AsyncPart = defineAsyncComponent(() => gate.then(() => () => h("em", null, "late")));

    const container = document.createElement("div");
    render(
      h(Suspense, { fallback: h("p", null, "loading…") }, [h("b", null, "first"), h(AsyncPart)]),
      container,
    );

    expect(collectText(container)).toContain("first");
    expect(collectText(container)).toContain("loading…");
    expect(collectText(container)).not.toContain("late");

    release!();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(collectText(container)).toContain("late");
    expect(collectText(container)).not.toContain("loading…");
  });

  it("renders content synchronously when loaders are already resolved", async () => {
    const AsyncPart = defineAsyncComponent(async () => () => h("em", null, "ready"));
    const AsyncSibling = defineAsyncComponent(async () => () => h("i", null, "sib"));
    // Pre-resolve both loaders.
    await Promise.all([
      getAsyncComponentMetadata(AsyncPart)!.load(),
      getAsyncComponentMetadata(AsyncSibling)!.load(),
    ]);

    const container = document.createElement("div");
    render(
      h(Suspense, { fallback: h("p", null, "loading…") }, [h(AsyncPart), h(AsyncSibling)]),
      container,
    );

    expect(collectText(container)).toContain("ready");
    expect(collectText(container)).toContain("sib");
    expect(collectText(container)).not.toContain("loading…");
  });

  it("uses an empty fragment when no fallback is provided", () => {
    const container = document.createElement("div");
    render(h(Suspense, null, [h("b", null, "ok")]), container);
    expect(collectText(container)).toContain("ok");
  });

  it("keeps the fallback and logs when a subtree loader rejects", async () => {
    const Bad = defineAsyncComponent(() => Promise.reject(new Error("boom")));
    const errors: unknown[] = [];
    const originalError = console.error;
    console.error = (e: unknown) => errors.push(e);

    try {
      const container = document.createElement("div");
      render(h(Suspense, { fallback: h("p", null, "loading…") }, [h(Bad)]), container);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(collectText(container)).toContain("loading…");
      expect(errors.length).toBeGreaterThan(0);
    } finally {
      console.error = originalError;
    }
  });

  it("does not coordinate async components inside a nested Suspense", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const Inner = defineAsyncComponent(() => gate.then(() => () => h("i", null, "inner")));
    const Outer = defineAsyncComponent(async () => () => h("b", null, "outer"));

    const container = document.createElement("div");
    render(
      h(Suspense, { fallback: h("p", null, "outer…") }, [
        h(Outer),
        h(Suspense, { fallback: h("p", null, "inner…") }, [h(Inner)]),
      ]),
      container,
    );

    // Outer resolved: outer Suspense swaps even though Inner is still pending.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(collectText(container)).toContain("outer");
    expect(collectText(container)).toContain("inner…");
    expect(collectText(container)).not.toContain("outer…");

    release!();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(collectText(container)).toContain("inner");
    expect(collectText(container)).not.toContain("inner…");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/unit/component/suspense.test.ts`
Expected: FAIL — `Suspense` is not exported from `../../../src`.

- [ ] **Step 3: Implement `src/component/suspense.ts`**

```ts
import { getCurrentInstance } from "./lifecycle";
import { getAsyncComponentMetadata } from "./async-component";
import { h } from "../vnode/h";
import { Fragment, type ComponentType, type VNode, type VNodeChildren } from "../vnode/vnode";

export interface SuspenseProps {
  fallback?: VNode | (() => VNode);
}

const suspenseMarker = Symbol("solace.suspense");

export function isSuspense(type: unknown): boolean {
  return (
    (typeof type === "object" || typeof type === "function") &&
    type !== null &&
    (type as { [suspenseMarker]?: boolean })[suspenseMarker] === true
  );
}

function markSuspense<Props extends object>(component: ComponentType<Props>): void {
  (component as unknown as { [suspenseMarker]?: boolean })[suspenseMarker] = true;
}

interface CollectedLoaders {
  loaders: (() => Promise<unknown>)[];
  allResolved: boolean;
}

function collectAsyncLoaders(children: VNodeChildren | undefined): CollectedLoaders {
  const loaders: (() => Promise<unknown>)[] = [];
  let unresolved = false;
  walk(children);
  return { loaders, allResolved: !unresolved };

  function walk(value: VNodeChildren | VNode | null | undefined): void {
    if (value === null || value === undefined || typeof value === "string") {
      return;
    }

    if (Array.isArray(value)) {
      for (const child of value) {
        walk(child);
      }
      return;
    }

    if (!isVNodeValue(value)) {
      return;
    }

    const metadata = getAsyncComponentMetadata(value.type);
    if (metadata !== undefined) {
      if (metadata.peek() === null) {
        unresolved = true;
        loaders.push(() => metadata.load());
      }
      return;
    }

    if (isSuspense(value.type)) {
      // Nested Suspense coordinates its own subtree.
      return;
    }

    walk(value.children as VNodeChildren);
  }
}

function isVNodeValue(value: unknown): value is VNode {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "shapeFlag" in (value as object)
  );
}

export const Suspense: ComponentType<SuspenseProps> = (props, { slots }) => {
  const instance = getCurrentInstance();
  const update = instance?.update ?? null;
  const children = (slots.default?.() ?? null) as VNodeChildren;
  const { loaders, allResolved } = collectAsyncLoaders(children);

  let resolved = allResolved;

  if (!resolved) {
    void Promise.all(loaders.map((load) => load())).then(
      () => {
        resolved = true;
        update?.();
      },
      (error: unknown) => {
        resolved = true;
        console.error("Suspense subtree loader failed:", error);
        update?.();
      },
    );
  }

  return () => {
    if (resolved) {
      return h(Fragment, null, children);
    }

    const fallback = props.fallback;
    if (fallback === undefined) {
      return h(Fragment, null, []);
    }
    return typeof fallback === "function" ? fallback() : fallback;
  };
};

markSuspense(Suspense);
```

Note: this mirrors `defineAsyncComponent`'s structure (`src/component/async-component.ts:48-73`): outer body runs once, inner closure is the render. If `slots.default` is not the correct slot access for this repo's `ValidatedSlots` (check `src/component/component.ts:186-203`), use exactly what `async-component.ts` uses (`slots.default?.()`). `props.fallback` typing follows `AsyncComponentOptions.fallback` conventions (`VNode | (() => VNode)`; `VNode` is an object, a factory is a function — `typeof fallback === "function"` is the discriminator).

- [ ] **Step 4: Export from `src/index.ts`**

Add next to the `defineAsyncComponent` export (src/index.ts:12):

```ts
export { Suspense } from "./component/suspense";
export type { SuspenseProps } from "./component/suspense";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/unit/component/suspense.test.ts tests/unit/component`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/component/suspense.ts src/index.ts tests/unit/component/suspense.test.ts
git commit -m "feat: add Suspense component for async subtree coordination"
```

---

### Task 2: Suspense boundaries in `renderToStream`

Ordered mode awaits the subtree loaders inline; out-of-order mode emits one `so:b` boundary whose readiness is `Promise.all` of the subtree loaders. The replacement render reuses `collectBoundaryHtml` — by flush time the loaders are resolved, so `metadata.peek()` is non-null and the freshly-created Suspense instance takes the sync-resolved path (Task 1) and renders content, not fallback.

**Files:**

- Modify: `src/server/render-to-stream.ts`
- Test: `tests/unit/server/render-to-stream-out-of-order.test.ts` (append) + new ordered-mode assertions

- [ ] **Step 1: Write the failing tests (append to the out-of-order suite file)**

```ts
import { Suspense } from "../../../src";

describe("renderToStream Suspense boundaries", () => {
  it("emits one so:b boundary for the whole Suspense subtree in out-of-order mode", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const A = defineAsyncComponent(() => gate.then(() => () => h("i", null, "a")));
    const B = defineAsyncComponent(async () => () => h("b", null, "b"));

    const stream = renderToStream(
      h(Suspense, { fallback: h("p", null, "loading…") }, [h(A), h(B)]),
      { mode: "out-of-order" },
    );
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    const firstRead = await reader.read();
    const prefix = decoder.decode(firstRead.value ?? new Uint8Array());
    expect(prefix).toContain("<!--so:b:1-->");
    expect(prefix).toContain("<p>loading…</p>");
    expect(prefix).toContain("<!--/so:b:1-->");
    expect(prefix).not.toContain("so:b:2");

    release!();
    let streamed = prefix;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      streamed += decoder.decode(value, { stream: true });
    }
    expect(streamed).toContain("so:r:1");
    expect(streamed.slice(streamed.indexOf("so:r:1"))).toContain("<i>a</i>");
    expect(streamed.slice(streamed.indexOf("so:r:1"))).toContain("<b>b</b>");
  });

  it("awaits the subtree inline in ordered mode (no markers)", async () => {
    const A = defineAsyncComponent(async () => () => h("i", null, "a"));
    const streamed = await collectStream(
      renderToStream(h(Suspense, { fallback: h("p", null, "loading…") }, [h(A)])),
    );
    expect(streamed).toBe("<i>a</i>");
  });

  it("numbers nested Suspense boundaries independently", async () => {
    const Inner = defineAsyncComponent(async () => () => h("i", null, "inner"));
    const Outer = defineAsyncComponent(async () => () => h("b", null, "outer"));
    const streamed = await collectStream(
      renderToStream(
        h(Suspense, { fallback: h("p", null, "o…") }, [
          h(Outer),
          h(Suspense, { fallback: h("p", null, "i…") }, [h(Inner)]),
        ]),
        { mode: "out-of-order" },
      ),
    );
    expect(streamed).toContain("so:b:1");
    expect(streamed).toContain("so:b:2");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/unit/server/render-to-stream-out-of-order.test.ts`
Expected: new tests FAIL — Suspense renders fallback in ordered mode / no boundary in out-of-order mode.

- [ ] **Step 3: Implement**

In `src/server/render-to-stream.ts` add imports:

```ts
import { isSuspense, collectAsyncLoaders } from "../component/suspense";
```

Move `collectAsyncLoaders` out of `suspense.ts`'s local scope if needed — export it from `src/component/suspense.ts` (it already exists there; add `export` to the function declaration).

Extend `streamComponent` (currently at src/server/render-to-stream.ts:221-237):

```ts
async function* streamComponent(
  vnode: VNode,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  ctx: StreamContext,
): AsyncGenerator<string> {
  if (isSuspense(vnode.type)) {
    const { loaders, allResolved } = collectAsyncLoaders(vnode.children as never);
    if (ctx.mode === "out-of-order") {
      yield* streamSuspenseBoundary(vnode, loaders, allResolved, parentComponent, appProvides, ctx);
      return;
    }
    if (!allResolved) {
      await Promise.all(loaders.map((load) => load()));
    }
    yield* streamLoadedComponent(vnode, parentComponent, appProvides, ctx);
    return;
  }

  const metadata = getAsyncComponentMetadata(vnode.type);
  if (metadata !== undefined) {
    if (ctx.mode === "out-of-order") {
      yield* streamOutOfOrderBoundary(vnode, metadata, parentComponent, appProvides, ctx);
      return;
    }
    await metadata.load();
  }

  yield* streamLoadedComponent(vnode, parentComponent, appProvides, ctx);
}
```

Add the Suspense boundary emitter (next to `streamOutOfOrderBoundary`):

```ts
async function* streamSuspenseBoundary(
  vnode: VNode,
  loaders: (() => Promise<unknown>)[],
  allResolved: boolean,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  ctx: StreamContext,
): AsyncGenerator<string> {
  const id = ctx.nextBoundaryId();
  const load = allResolved ? Promise.resolve(null) : Promise.all(loaders.map((l) => l()));
  const boundary = createPendingBoundary(id, load, vnode.props, vnode.children);
  boundary.component = Suspense;
  ctx.pending.push(boundary);

  yield boundaryStartMarker(id);
  const fallback = resolveFallbackVNode(vnode);
  if (fallback !== null) {
    yield* streamVNode(fallback, parentComponent, appProvides, ctx);
  }
  yield boundaryEndMarker(id);
}

function resolveFallbackVNode(vnode: VNode): VNode | null {
  const fallback = (vnode.props as { fallback?: VNode | (() => VNode) } | null)?.fallback;
  if (fallback === undefined) return null;
  return typeof fallback === "function" ? fallback() : fallback;
}
```

`boundary.component = Suspense` makes the existing `collectBoundaryHtml` render `h(Suspense, props, children)`; because the subtree loaders are resolved by flush time, the fresh Suspense instance takes the sync-resolved path and streams the children. Import `Suspense` (type-only import of the value; it is a value) in render-to-stream.ts:

```ts
import { Suspense, collectAsyncLoaders, isSuspense } from "../component/suspense";
```

Server-side import note: `src/component/suspense.ts` imports only from `./lifecycle`, `./async-component`, `../vnode/*` — all SSR-safe (async-component.ts is already imported server-side). Do NOT import from `../renderer/*` or DOM-touching modules.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/unit/server/render-to-stream-out-of-order.test.ts tests/unit/server`
Expected: PASS — including the pre-existing out-of-order and ordered suites.

- [ ] **Step 5: Commit**

```bash
git add src/server/render-to-stream.ts src/component/suspense.ts tests/unit/server/render-to-stream-out-of-order.test.ts
git commit -m "feat: stream Suspense boundaries through the so:b protocol"
```

---

### Task 3: Hydration comment tolerance + `selective` option validation

**Files:**

- Modify: `src/renderer/hydration.ts`
- Modify: `src/renderer/renderer.ts`
- Test: `tests/unit/renderer/selective-hydration.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import { createApp } from "../../../src/app";

describe("hydration comment tolerance", () => {
  it("skips non-boundary comment nodes during the walk", async () => {
    const container = document.createElement("div");
    container.innerHTML = "<!--so:b:1--><p>x</p><!--/so:b:1-->";
    // The markers here are inert: no pending boundary, and the prepared tree
    // matches the enclosed <p>. The walk must tolerate the comments.
    const App = () => h("p", null, "x");
    await createApp(App).hydrateAsync(container);
    expect(container.querySelector("p")?.textContent).toBe("x");
  });

  it("rejects invalid selective values synchronously", () => {
    const container = document.createElement("div");
    expect(() =>
      createApp(() => h("p", null, "x")).hydrateAsync(container, {
        selective: "yes" as never,
      }),
    ).rejects.toThrow("Hydration selective option must be a boolean");
  });

  it("accepts selective: false explicitly", async () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>x</p>";
    const App = () => h("p", null, "x");
    await createApp(App).hydrateAsync(container, { selective: false });
    expect(container.querySelector("p")?.textContent).toBe("x");
  });

  it("throws on unknown hydration options (unchanged)", () => {
    const container = document.createElement("div");
    expect(() =>
      createApp(() => h("p", null, "x")).hydrateAsync(container, { teleport: true } as never),
    ).rejects.toThrow("Unknown hydration option: teleport");
  });
});
```

Adaptation: if sibling comment nodes trip the strict walk only when adjacent to children (e.g., a leading comment before the first child), extend the first test with a trailing-comment variant:

```ts
it("skips trailing comments before the extra-node assertion", async () => {
  const container = document.createElement("div");
  container.innerHTML = "<p>x</p><!--tail-->";
  const App = () => h("p", null, "x");
  await createApp(App).hydrateAsync(container);
  expect(container.querySelector("p")?.textContent).toBe("x");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/unit/renderer/selective-hydration.test.ts`
Expected: FAIL — comment nodes cause `SolaceHydrationError` (element-tag-mismatch / extra-node); `selective` throws "Unknown hydration option: selective".

- [ ] **Step 3: Implement comment skipping in `src/renderer/hydration.ts`**

Add a helper and apply it at every point where a DOM node is consumed as the next match — the tops of `hydrateVNode` and `hydratePreparedVNode`, and in the child-walk loops:

```ts
function skipComments(node: Node | null): Node | null {
  let current = node;
  while (current !== null && current.nodeType === Node.COMMENT_NODE) {
    current = current.nextSibling;
  }
  return current;
}
```

Mechanical edits:

1. In `hydrateVNode` (src/renderer/hydration.ts:52) and `hydratePreparedVNode` (:87), insert `node = skipComments(node);` before the `node === null` check.
2. In `hydratePreparedChildren` (:229) and `hydrateChildren` (:422), change the loop body to skip before each child: `current = skipComments(current);` at the top of each iteration, and skip once after the loop before returning (the trailing-comment case): `return skipComments(current);` — but careful: `assertNoExtraDomNode(next, ...)` is called by _callers_ with the returned node, so returning `skipComments(current)` makes the extra-node assertion ignore trailing comments. That is the intended contract.
3. In `hydratePreparedElement` (:121) and `hydrateElement` (:252), pass `skipComments(node.firstChild)` instead of `node.firstChild` to the children walkers.

The leading-comment skip in (1) plus per-child skips in (2) mean boundary start markers before any child are consumed; end markers are consumed by the trailing skip in (2).

- [ ] **Step 4: Implement the `selective` option in `src/renderer/renderer.ts`**

```ts
export interface HydrationOptions {
  recover?: boolean;
  selective?: boolean;
}
```

In `assertNoDeferredIntegrationOptions` (src/renderer/renderer.ts:238), after the `recover` check:

```ts
if (options.selective !== undefined && typeof options.selective !== "boolean") {
  throw new TypeError("Hydration selective option must be a boolean");
}
```

And extend the unknown-key allowlist (renderer.ts:265):

```ts
const unknownKey = Reflect.ownKeys(options).find((key) => key !== "recover" && key !== "selective");
```

In sync `hydrate()` (renderer.ts:46), reject `selective` explicitly (option exists only on `hydrateAsync`): add after `assertNoDeferredIntegrationOptions(options);`:

```ts
if (options.selective === true) {
  throw new TypeError("Selective hydration requires hydrateAsync(); hydrate() is synchronous.");
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/unit/renderer tests/unit/server tests/integration`
Expected: PASS — the existing hydration suites confirm the comment tolerance is a strict widening, not a behavior change for comment-free DOM.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/hydration.ts src/renderer/renderer.ts tests/unit/renderer/selective-hydration.test.ts
git commit -m "feat: tolerate boundary comments and validate selective hydration option"
```

---

### Task 4: Selective hydration flow (skip pending ranges, re-render on resolution)

With `selective: true`, `hydrateAsync` does NOT pre-resolve the whole tree. Unresolved async/Suspense components hydrate against their current (fallback) render output inside the marker range; when their loaders resolve, the existing `instance.update()` machinery patches the fallback DOM into the real content, and the enclosing `so:b` marker comments are removed.

**Files:**

- Modify: `src/renderer/renderer.ts`
- Modify: `src/component/async-component.ts` (only if the CSR fallback render path does not already match the SSR fallback bytes — verify first)
- Test: `tests/unit/renderer/selective-hydration.test.ts` (append)

- [ ] **Step 1: Write the failing tests (append)**

```ts
import { defineAsyncComponent, Suspense } from "../../../src";

describe("selective hydration", () => {
  it("hydrates ready parts immediately and patches pending boundaries on resolution", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const AsyncPart = defineAsyncComponent({
      loader: () => gate.then(() => () => h("em", { id: "late" }, "late")),
      fallback: h("p", null, "loading…"),
    });
    const App = () => h("Fragment", null, [h("b", null, "ok"), h(AsyncPart)]);

    const container = document.createElement("div");
    container.innerHTML = "<b>ok</b><!--so:b:1--><p>loading…</p><!--/so:b:1-->";
    document.body.appendChild(container);

    const hydration = createApp(App).hydrateAsync(container, { selective: true });
    await Promise.resolve();
    // The ready part is live (hydration finished) while the gate is closed.
    release!();
    await hydration;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.querySelector("#late")?.textContent).toBe("late");
    expect(container.textContent).not.toContain("loading…");
    expect(container.innerHTML).not.toContain("so:b:1");
  });

  it("hydrates Suspense fallback and swaps content on resolution", async () => {
    const Inner = defineAsyncComponent(async () => () => h("i", null, "inner"));
    const App = () => h(Suspense, { fallback: h("p", null, "loading…") }, [h(Inner)]);
    const container = document.createElement("div");
    container.innerHTML = "<!--so:b:1--><p>loading…</p><!--/so:b:1-->";
    document.body.appendChild(container);
    await createApp(App).hydrateAsync(container, { selective: true });
    expect(container.querySelector("i")?.textContent).toBe("inner");
    expect(container.innerHTML).not.toContain("so:b:1");
  });

  it("keeps the fallback and does not reject when a boundary loader fails", async () => {
    const Bad = defineAsyncComponent({
      loader: () => Promise.reject(new Error("boom")),
      fallback: h("p", null, "loading…"),
    });
    const App = () => h(Bad);
    const container = document.createElement("div");
    container.innerHTML = "<!--so:b:1--><p>loading…</p><!--/so:b:1-->";
    document.body.appendChild(container);
    const errors: unknown[] = [];
    const originalError = console.error;
    console.error = (e: unknown) => errors.push(e);
    try {
      await createApp(App).hydrateAsync(container, { selective: true });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(container.textContent).toContain("loading…");
      expect(errors.length).toBeGreaterThan(0);
    } finally {
      console.error = originalError;
    }
  });
});
```

Note: `h("Fragment", ...)` — check whether the string form is valid in this repo; if the convention is the imported `Fragment` symbol (`h(Fragment, null, [...])` as used in the out-of-order tests), use that.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/unit/renderer/selective-hydration.test.ts`
Expected: FAIL — `selective: true` either throws or the walk mismatches: today `prepareAsyncSource` awaits all loaders before hydrating, so `hydrateAsync` does not settle until the gate releases, and the prepared tree (real content) does not match the fallback DOM (`<p>loading…</p>`), throwing `SolaceHydrationError`.

- [ ] **Step 3: Implement the selective flow in `src/renderer/renderer.ts`**

Replace the body of `hydrateAsync` (renderer.ts:96-137) with a mode switch:

```ts
export async function hydrateAsync(
  source: AsyncHydrationSource,
  container: Element,
  appProvides: Provides | null = null,
  options: HydrationOptions = {},
): Promise<void> {
  assertHydrationContainer(container);
  assertNoDeferredIntegrationOptions(options);
  const renderContainer = container as RenderContainer;

  if (options.selective === true) {
    await hydrateSelectively(source, renderContainer, appProvides, options);
    return;
  }

  const prepared = await prepareAsyncSource(source, {
    appProvides,
    collectStyles: true,
  });
  const context: HydrationContext = { hydratedInstances: [] };
  const styleSink = createDocumentStyleSink(container.ownerDocument);

  stopReactiveRender(renderContainer);
  for (const registration of prepared.registrations) {
    styleSink.register(registration.scopeId, registration.css);
  }

  try {
    const next = hydratePreparedVNode(
      prepared.root,
      renderContainer.firstChild,
      null,
      appProvides,
      context,
    );
    assertNoExtraDomNode(next, "root[1]");
    renderContainer._solaceVNode = prepared.root.vnode;
  } catch (error) {
    stopHydratedComponentUpdates(context);

    if (shouldRecoverHydrationMismatch(error, options)) {
      recoverPreparedHydration(prepared.root, renderContainer, appProvides);
      return;
    }

    throw error;
  }
}
```

Add the selective flow:

```ts
async function hydrateSelectively(
  source: AsyncHydrationSource,
  renderContainer: RenderContainer,
  appProvides: Provides | null,
  options: HydrationOptions,
): Promise<void> {
  const vnode = typeof source === "function" ? h(source as ComponentTransport) : source;
  const styleSink = createDocumentStyleSink(renderContainer.ownerDocument);
  const context: HydrationContext = { hydratedInstances: [] };
  const pendingMarkers: Comment[] = [];

  stopReactiveRender(renderContainer);

  withStyleSink(styleSink, () => {
    const next = hydrateVNode(
      vnode,
      renderContainer.firstChild,
      null,
      appProvides,
      context,
      "root",
      {
        onBoundaryComment(comment) {
          pendingMarkers.push(comment);
        },
      },
    );
    assertNoExtraDomNode(next, "root[1]");
  });

  renderContainer._solaceVNode = vnode;
  await replayPendingBoundaries(pendingMarkers, renderContainer);
}

async function replayPendingBoundaries(
  markers: Comment[],
  renderContainer: RenderContainer,
): Promise<void> {
  if (markers.length === 0) {
    return;
  }

  // The hydrated async/Suspense instances re-render through their own update
  // machinery when loaders resolve. The boundary comments are removed once no
  // so:b markers remain; wait for loader microtasks to settle first.
  await new Promise((resolve) => setTimeout(resolve, 0));
  removeBoundaryMarkers(renderContainer);
}

function removeBoundaryMarkers(container: Element): void {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_COMMENT, null, false);
  const removals: Comment[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Comment;
    if (/^\/?so:b:\d+$/.test(node.nodeValue ?? "")) {
      removals.push(node);
    }
  }
  for (const node of removals) {
    node.parentNode?.removeChild(node);
  }
}
```

Supporting changes:

1. **Marker-aware walk.** Extend `HydrationContext` (hydration.ts:19) with an optional boundary hook:

```ts
export interface HydrationContext {
  hydratedInstances: ComponentInstance[];
  onBoundaryComment?: (comment: Comment) => void;
}
```

In `skipComments` (Task 3), when skipping a comment whose `nodeValue` matches `/^so:b:\d+$/` and `context.onBoundaryComment` is defined, call it. This requires `skipComments` to receive the context — thread `context` through as an extra parameter at the call sites added in Task 3 (it is already available at every call site).

2. **Unresolved async components must hydrate instead of pre-loading.** In selective mode we bypass `prepareAsyncSource`, so `hydrateVNode` reaches async components unresolved. In `hydrateComponent` (hydration.ts:304), the current body calls `instance.render()`. The async component's render (async-component.ts:52-72) returns the SSR fallback only when `options.loadingComponent`/`fallback` produce it — verify: the render path returns `options.loadingComponent && isLoadingVisible ? ... : Fragment([])`. To match SSR fallback bytes, extend the unresolved branch to return the SSR `fallback` when provided:

In `async-component.ts`, change the unresolved return (line 69-71):

```ts
const fallback = options.fallback;
if (fallback !== undefined) {
  return typeof fallback === "function" ? fallback() : fallback;
}
return options.loadingComponent && isLoadingVisible
  ? renderComponent(options.loadingComponent, props, children)
  : h(Fragment, null, []);
```

This changes CSR rendering of unresolved async components from empty/loading to the SSR fallback — consistent with out-of-order SSR semantics and required for fallback-DOM matching. Existing CSR tests that rely on the empty fragment with a `fallback`-less component are unaffected; run the full component suite to confirm.

3. **Async components hydrating unresolved need load-triggered updates.** `startLoad(update)` (async-component.ts:154) already re-renders via `instance.update` — the update machinery set up by `setupHydratedComponentUpdate` (hydration.ts:342) patches the fallback DOM into real content. No change expected; the Task 4 tests lock it.

4. **Marker removal after patch.** `removeBoundaryMarkers` strips `so:b` comments once boundary content has been patched in. Note the markers are inert for patch (diff anchors use `vnode.el` references, and stray comment siblings are ignored by the sibling-pointer walk).

If `withStyleSink` is not exported from `../component/style`, check its actual export name in renderer.ts imports (it is imported at renderer.ts:4 — reuse that import).

If `hydrateVNode`'s signature does not accept a 7th options-like parameter, put `onBoundaryComment` on `HydrationContext` only and pass it via the existing `context` argument — the context is already threaded everywhere.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/unit/renderer tests/unit/component tests/unit/server tests/integration`
Expected: PASS. If the fallback-vs-loadingComponent CSR change breaks an existing test, read the assertion: tests that pass `fallback` AND expect an empty unresolved render did not exist before (fallback was SSR-only); adjust only if the test documents intended CSR behavior, and record the decision in the commit message.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/renderer.ts src/renderer/hydration.ts src/component/async-component.ts tests/unit/renderer/selective-hydration.test.ts
git commit -m "feat: hydrate async boundaries selectively with fallback matching"
```

---

### Task 5: Event buffering and replay (`selective-events.ts`)

**Files:**

- Create: `src/renderer/selective-events.ts`
- Modify: `src/renderer/renderer.ts`
- Test: `tests/unit/renderer/selective-events.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from "vitest";

import { attachSelectiveEventBuffer } from "../../../src/renderer/selective-events";

describe("SelectiveEventBuffer", () => {
  it("buffers and replays a click on the original target", () => {
    const container = document.createElement("div");
    container.innerHTML = "<button id="btn">go</button>";
    document.body.appendChild(container);
    const onClick = vi.fn();
    const button = container.querySelector("#btn") as HTMLButtonElement;
    button.addEventListener("click", onClick);

    const detach = attachSelectiveEventBuffer(container);
    button.click();
    expect(onClick).not.toHaveBeenCalled();

    detach.replay();
    expect(onClick).toHaveBeenCalledTimes(1);
    detach.detach();
    document.body.removeChild(container);
  });

  it("drops events whose target left the DOM", () => {
    const container = document.createElement("div");
    container.innerHTML = "<button id="gone">go</button>";
    document.body.appendChild(container);
    const onClick = vi.fn();
    const button = container.querySelector("#gone") as HTMLButtonElement;
    button.addEventListener("click", onClick);

    const detach = attachSelectiveEventBuffer(container);
    button.click();
    button.remove();
    detach.replay();
    expect(onClick).not.toHaveBeenCalled();
    detach.detach();
    document.body.removeChild(container);
  });

  it("stops buffering after replay+detach", () => {
    const container = document.createElement("div");
    container.innerHTML = "<button id="btn2">go</button>";
    document.body.appendChild(container);
    const onClick = vi.fn();
    const button = container.querySelector("#btn2") as HTMLButtonElement;
    button.addEventListener("click", onClick);

    const detach = attachSelectiveEventBuffer(container);
    button.click();
    detach.replay();
    button.click();
    expect(onClick).toHaveBeenCalledTimes(2);
    detach.detach();
    document.body.removeChild(container);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/unit/renderer/selective-events.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/renderer/selective-events.ts`**

```ts
const BUFFERED_EVENT_TYPES = ["click", "pointerdown", "keydown", "input", "change"] as const;

interface BufferedEvent {
  target: EventTarget;
  type: string;
}

export interface SelectiveEventBufferHandle {
  replay(): void;
  detach(): void;
}

export function attachSelectiveEventBuffer(container: Element): SelectiveEventBufferHandle {
  const buffer: BufferedEvent[] = [];

  const listener = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    buffer.push({ target: event.target as EventTarget, type: event.type });
  };

  for (const type of BUFFERED_EVENT_TYPES) {
    container.addEventListener(type, listener, { capture: true });
  }

  return {
    replay(): void {
      for (const entry of buffer) {
        if (!entry.target.isConnected) {
          continue;
        }
        entry.target.dispatchEvent(new Event(entry.type, { bubbles: true, cancelable: true }));
      }
      buffer.length = 0;
    },
    detach(): void {
      for (const type of BUFFERED_EVENT_TYPES) {
        container.removeEventListener(type, listener, { capture: true });
      }
      buffer.length = 0;
    },
  };
}
```

jsdom note: `button.click()` dispatches a bubbling cancelable click, so the capture listener on the container sees it. `Event.target.isConnected` covers the drop case. If jsdom's `preventDefault` on `click()`-dispatched events interferes, assert buffering via the handler not being called (already the case).

- [ ] **Step 4: Wire into the selective flow (`src/renderer/renderer.ts`)**

In `hydrateSelectively`, attach the buffer before the walk and replay/detach after boundaries settle:

```ts
const eventBuffer = attachSelectiveEventBuffer(renderContainer);
```

(before the `withStyleSink` block), and in `replayPendingBoundaries` replace the final `removeBoundaryMarkers` sequence with:

```ts
await new Promise((resolve) => setTimeout(resolve, 0));
removeBoundaryMarkers(renderContainer);
eventBuffer.replay();
eventBuffer.detach();
```

Thread `eventBuffer` into `replayPendingBoundaries` as a parameter. If `hydrateSelectively` throws before replay, detach without replaying in a `finally`:

```ts
try {
  // ... existing walk + replayPendingBoundaries
} finally {
  eventBuffer.detach();
}
```

(keep the explicit `replay()` call inside the success path before `detach()` — replaying after a failed hydration could double-fire into recovered DOM).

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/unit/renderer`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/selective-events.ts src/renderer/renderer.ts tests/unit/renderer/selective-events.test.ts
git commit -m "feat: buffer and replay interactions during selective hydration"
```

---

### Task 6: Integration test — out-of-order stream + selective hydration round-trip

**Files:**

- Test: `tests/integration/suspense-selective-hydration.test.ts`

- [ ] **Step 1: Read `tests/integration/out-of-order-hydration.test.ts` first** and mirror its imports, `collectStream`, and jsdom setup conventions exactly.

- [ ] **Step 2: Write the integration test**

```ts
import { describe, expect, it } from "vitest";

import { defineAsyncComponent, Fragment, h, ref } from "@italone/solace";
import { hydrateAsync, renderToStream } from "@italone/solace/server";
// Mirror the existing integration test's import style if it uses relative
// paths instead of the package name.

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

describe("selective hydration round-trip", () => {
  it("buffers a click before boundary readiness and replays it after", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const AsyncPart = defineAsyncComponent({
      loader: () => gate.then(() => () => h(AsyncBody)),
      fallback: h("p", null, "loading…"),
    });
    const count = ref(0);
    const AsyncBody = () =>
      h("button", { id: "inc", onClick: () => (count.value += 1) }, `count: ${count.value}`);
    const App = () => h(Fragment, null, [h("b", null, "ok"), h(AsyncPart)]);

    const html = await collectStream(renderToStream(h(App), { mode: "out-of-order" }));
    // Keep the stream pending: strip the replacement scripts so the fallback
    // stays in the DOM (simulates hydrating while boundaries are unresolved).
    const container = document.createElement("div");
    container.innerHTML = html.replace(/<!--so:r:\d+-->|<script>[\s\S]*?<\/script>/gu, "");
    document.body.appendChild(container);

    const hydration = createApp(App).hydrateAsync(container, { selective: true });
    await Promise.resolve();

    // Click lands on the not-yet-hydrated button: buffered, not counted.
    const button = container.querySelector("#inc") as HTMLButtonElement;
    expect(button).not.toBeNull();
    button.click();

    release!();
    await hydration;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.textContent).not.toContain("loading…");
    expect(container.querySelector("#inc")?.textContent).toContain("count: 1");
  });
});
```

Adaptation notes:

- Import `createApp` from the same source the existing integration tests use (`@italone/solace` root).
- If `hydrateAsync` is invoked as a standalone function in the existing tests (rather than `createApp(App).hydrateAsync(container)`), mirror that call shape with the `selective` option added.
- The click-while-pending assertion (`count` still 0 at that point) is implicit: after replay the count is exactly 1 — a double-fire would show 2.
- If the button is not present before `release` (fallback DOM only), the test as written fails — that means the fallback DOM replaced the boundary content because the replacement script ran. The script-stripping regex above is what prevents that; verify the regex leaves `<!--so:b:1-->` markers and `<p>loading…</p>` intact but removes scripts.

- [ ] **Step 3: Run the test**

Run: `pnpm exec vitest run tests/integration/suspense-selective-hydration.test.ts`
Expected: PASS. Debug failures in the selective flow (Task 4/5 wiring), not by weakening assertions.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/suspense-selective-hydration.test.ts
git commit -m "test: cover selective hydration with buffered interaction replay"
```

---

### Task 7: Documentation and docs-contract gates

**Files:**

- Modify: `docs/api.md`, `docs/api.zh-CN.md`, `docs/package-usage.md`, `docs/project-status.md`, `docs/project-status.zh-CN.md`, `docs/roadmap.md`, `readme.md`, `readme.zh-CN.md`

- [ ] **Step 1: Add Suspense + selective hydration sections to `docs/api.md` and `docs/api.zh-CN.md`**

Content must state: the `Suspense` component (`fallback` prop, subtree coordination, nested boundaries independent, CSR works without SSR, loader failure keeps fallback + `console.error`); SSR behavior (ordered mode awaits inline; out-of-order mode emits one `so:b` boundary per Suspense reusing the existing protocol); the `hydrateAsync` `selective` option (default `false` preserves the whole-tree contract; `true` hydrates ready parts immediately, matches fallback DOM inside marker ranges, patches on resolution, buffers `click/pointerdown/keydown/input/change` at the container root and replays them once boundaries settle, drops events whose targets left the DOM); `hydrate()` rejects `selective`; non-goals (no SuspenseList, no scheduler priorities, no transition hooks).

- [ ] **Step 2: Update status/roadmap/README (en + zh)**

- `docs/project-status.md` + `.zh-CN.md`: SSR row gains Suspense/selective hydration (beta); Known Gaps keeps only what remains deferred.
- `docs/roadmap.md`: record the implemented slice; remove Suspense/selective hydration from the Out of Scope list (the entry at docs/roadmap.md:85-87 referencing the revisit-after-1.0 note must be updated).
- `readme.md` + `readme.zh-CN.md`: update any sentence claiming Suspense/selective hydration is unsupported/deferred.
- `docs/package-usage.md`: extend the server/hydration snippet with `selective`.

- [ ] **Step 3: Run docs-contract gates**

Run: `pnpm exec vitest run tests/unit/docs`
Expected: PASS. On failure, read the assertion output — it names the file and expected string; satisfy exactly what it asks for.

- [ ] **Step 4: Commit**

```bash
git add docs readme.md readme.zh-CN.md
git commit -m "docs: document Suspense and selective hydration"
```

---

### Task 8: Full quality gate

- [ ] **Step 1: Run the full validation chain**

Run: `pnpm format:check && pnpm typecheck && pnpm typecheck:jsxdev && pnpm lint && pnpm test`
Expected: all PASS.

- [ ] **Step 2: Fix drift with `pnpm format` and targeted edits, then re-run**

- [ ] **Step 3: Run the package gates**

Run: `pnpm build && pnpm test:package && pnpm package:smoke`
Expected: PASS.

- [ ] **Step 4: Final commit if fixes were needed**

```bash
git add -A && git commit -m "chore: format and lint suspense selective hydration slice"
```

---

## Self-Review Notes

- Spec coverage: Suspense component (Task 1), SSR boundary reuse (Task 2), comment tolerance + `selective` validation (Task 3), selective flow + fallback matching + failure semantics (Task 4), event buffering/replay/drop (Tasks 5-6), docs/gates (Tasks 7-8). Client loader failure → fallback kept + `console.error` is locked in Tasks 1 and 4.
- Known risk areas flagged for executors: the CSR unresolved-render change in `async-component.ts` (fallback now renders client-side too — run the full component suite); the `setTimeout(0)` settle window in `replayPendingBoundaries` (loader microtasks + scheduler queue flush); the integration-test script-stripping regex (keeps markers, drops replacement scripts).
- Default-path regression is asserted everywhere: `selective: false`/omitted keeps `prepareAsyncSource` whole-tree behavior (Task 3 test), ordered SSR unchanged (Task 2 test), existing 199 server/integration tests must stay green after every task.
