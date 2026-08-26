import {
  createComponentInstance,
  setupComponent,
  type ComponentInstance,
} from "../component/component";
import { getAsyncComponentMetadata } from "../component/async-component";
import {
  Suspense,
  collectAsyncLoaders,
  isSuspense,
  resolveSuspenseFallback,
  type SuspenseProps,
} from "../component/suspense";
import type { Provides } from "../component/provide";
import { h } from "../vnode/h";
import { createServerStyleSink, withStyleSink, type ServerStyleSink } from "../component/style";
import { runWithInstance } from "../shared/async-tree";
import {
  boundaryEndMarker,
  boundaryFailureMarker,
  boundaryStartMarker,
  buildReplacementScript,
  createPendingBoundary,
  type PendingBoundary,
  replacementScriptMarker,
} from "./stream-boundary";
import { ShapeFlags } from "../shared/flags";
import { escapeHtml } from "../shared/html";
import { isThenable } from "../shared/utils";
import type { ComponentType, VNode, VNodeChildren } from "../vnode/vnode";
import type { RenderToStringAsyncSource } from "./render-to-string";
import {
  assertRouterSSROption,
  buildSnapshotScript,
  resolveRouterSSR,
  type RouterSSROptions,
} from "./router-ssr";
import {
  assertSafeHtmlName,
  hasOwn,
  isPlainObject,
  isVNode,
  normalizeSource,
  renderAttributes,
} from "./render-shared";

// Synchronous chunks are given this many microtask turns to arrive before the
// buffer is flushed; sync chains longer than this are treated as suspended and
// flushed early. This only affects chunk granularity, never byte order or
// correctness.
const MAX_SYNCHRONOUS_MICROTASK_ROUNDS = 10;

export interface RenderToStreamOptions {
  context?: Record<string, unknown>;
  provides?: Provides;
  mode?: "ordered" | "out-of-order";
  router?: RouterSSROptions;
}

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

export function renderToStream(
  source: RenderToStringAsyncSource,
  options: RenderToStreamOptions = {},
): ReadableStream<Uint8Array> {
  assertStreamOptions(options);
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const routerSSR =
          options.router !== undefined ? await resolveRouterSSR(options.router) : null;
        const ctx = createStreamContext(
          options.mode ?? "ordered",
          routerSSR !== null ? routerSSR.provides : (options.provides ?? null),
        );
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

          // Give synchronously-produced chunks a few microtask turns to arrive;
          // a generator suspended on a real await will not settle within them.
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

        if (buffer !== "") {
          controller.enqueue(encoder.encode(buffer));
          buffer = "";
        }

        for await (const chunk of flushPendingBoundaries(ctx)) {
          buffer += chunk;
          controller.enqueue(encoder.encode(buffer));
          buffer = "";
        }

        if (routerSSR !== null) {
          buffer += buildSnapshotScript(routerSSR.snapshot);
        }

        if (buffer !== "") {
          controller.enqueue(encoder.encode(buffer));
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
  ctx: StreamContext,
): AsyncGenerator<string> {
  const resolved = isThenable(source) ? await source : source;
  const vnode = isVNode(resolved) ? resolved : normalizeSync(resolved);
  yield* streamVNode(vnode, null, ctx.appProvides, ctx);
}

function normalizeSync(source: unknown): VNode {
  if (typeof source === "function") {
    return normalizeSource(source as never);
  }
  throw new TypeError("SSR source must be a VNode or component function");
}

const PROMISED_CHILDREN_ERROR =
  "renderToStream() does not accept promised children; wrap async content in async components or use a promised root source.";

async function* streamVNode(
  vnode: VNode,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  ctx: StreamContext,
): AsyncGenerator<string> {
  if (isThenable(vnode as unknown)) {
    throw new TypeError(PROMISED_CHILDREN_ERROR);
  }

  if (vnode.shapeFlag & ShapeFlags.ELEMENT) {
    const tag = String(vnode.type);
    assertSafeHtmlName(tag, "element");
    yield `<${tag}${renderAttributes(vnode.props)}>`;
    yield* streamChildren(vnode.children, parentComponent, appProvides, ctx);
    yield `</${tag}>`;
    return;
  }

  if (vnode.shapeFlag & ShapeFlags.FRAGMENT) {
    yield* streamChildren(vnode.children, parentComponent, appProvides, ctx);
    return;
  }

  if (vnode.shapeFlag & ShapeFlags.COMPONENT) {
    yield* streamComponent(vnode, parentComponent, appProvides, ctx);
    return;
  }
}

async function* streamChildren(
  children: VNode["children"],
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  ctx: StreamContext,
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
      yield* streamVNode(child, parentComponent, appProvides, ctx);
    }
    return;
  }

  if (isVNode(children)) {
    yield* streamVNode(children, parentComponent, appProvides, ctx);
    return;
  }

  if (isThenable(children)) {
    throw new TypeError(PROMISED_CHILDREN_ERROR);
  }

  return;
}

async function* streamComponent(
  vnode: VNode,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  ctx: StreamContext,
): AsyncGenerator<string> {
  if (isSuspense(vnode.type)) {
    const { loaders, allResolved } = collectAsyncLoaders(vnode.children as VNodeChildren);
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

async function* streamOutOfOrderBoundary(
  vnode: VNode,
  metadata: NonNullable<ReturnType<typeof getAsyncComponentMetadata>>,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  ctx: StreamContext,
): AsyncGenerator<string> {
  const id = ctx.nextBoundaryId();
  const boundary = createPendingBoundary(id, metadata.load(), vnode.props, vnode.children);
  ctx.pending.push(boundary);

  yield boundaryStartMarker(id);
  const fallback = metadata.getFallback();
  if (fallback !== null) {
    yield* streamVNode(fallback, parentComponent, appProvides, ctx);
  }
  yield boundaryEndMarker(id);
}

async function* streamSuspenseBoundary(
  vnode: VNode,
  loaders: (() => Promise<unknown>)[],
  allResolved: boolean,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  ctx: StreamContext,
): AsyncGenerator<string> {
  const id = ctx.nextBoundaryId();
  // The boundary readiness is the whole subtree: resolve to the Suspense
  // component itself so the flush path renders h(Suspense, props, children)
  // with every loader already settled (collectAsyncLoaders sees peek() hit).
  const load = allResolved
    ? Promise.resolve(Suspense)
    : Promise.all(loaders.map((l) => l())).then(() => Suspense);
  const boundary = createPendingBoundary(id, load, vnode.props, vnode.children);
  ctx.pending.push(boundary);

  yield boundaryStartMarker(id);
  const fallback = resolveSuspenseFallback(vnode.props as SuspenseProps);
  if (fallback !== null) {
    yield* streamVNode(fallback, parentComponent, appProvides, ctx);
  }
  yield boundaryEndMarker(id);
}

async function* streamLoadedComponent(
  vnode: VNode,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  ctx: StreamContext,
): AsyncGenerator<string> {
  const instance = createComponentInstance(vnode, parentComponent, appProvides);
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

async function* flushPendingBoundaries(ctx: StreamContext): AsyncGenerator<string> {
  // Boundaries can register while an earlier winner's subtree renders (nested
  // async components), so re-sync the unflushed set with ctx.pending every
  // iteration. Resolution order among concurrent boundaries is preserved by
  // always racing the full remaining set.
  const flushed = new Set<PendingBoundary>();

  while (flushed.size < ctx.pending.length) {
    const remaining = new Set(ctx.pending.filter((boundary) => !flushed.has(boundary)));
    const winner = await racePending(remaining);
    flushed.add(winner);

    if (winner.error !== null) {
      yield boundaryFailureMarker(
        winner.id,
        escapeHtml(winner.error instanceof Error ? winner.error.message : String(winner.error)),
      );
      continue;
    }

    yield replacementScriptMarker(winner.id);
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
  // Render the loaded component through the standard component pipeline so the
  // shared style sink is active (useStyle) and new styles drain into the html.
  const vnode = h(boundary.component as ComponentType, boundary.props, boundary.children as never);
  let html = "";
  for await (const chunk of streamLoadedComponent(vnode, null, ctx.appProvides, ctx)) {
    html += chunk;
  }
  return html;
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

  if (options.mode !== undefined && options.mode !== "ordered" && options.mode !== "out-of-order") {
    throw new TypeError('SSR streaming mode must be "ordered" or "out-of-order"');
  }

  if (hasOwn(options, "manifest") || hasOwn(options, "clientEntry")) {
    throw new TypeError(
      "SSR manifest integration is deferred; compose assets in an app-local shell or adapter.",
    );
  }

  if (options.router !== undefined) {
    assertRouterSSROption(options.router);
    if (options.provides !== undefined) {
      throw new TypeError("SSR router option cannot be combined with provides");
    }
  }

  const unknownKey = Reflect.ownKeys(options).find(
    (key) => key !== "context" && key !== "provides" && key !== "mode" && key !== "router",
  );
  if (unknownKey !== undefined) {
    throw new TypeError(`Unknown SSR streaming option: ${String(unknownKey)}`);
  }
}
