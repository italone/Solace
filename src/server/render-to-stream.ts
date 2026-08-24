import {
  createComponentInstance,
  setupComponent,
  type ComponentInstance,
} from "../component/component";
import type { Provides } from "../component/provide";
import { createServerStyleSink, withStyleSink, type ServerStyleSink } from "../component/style";
import { ShapeFlags } from "../shared/flags";
import { escapeHtml } from "../shared/html";
import { isThenable } from "../shared/utils";
import type { VNode } from "../vnode/vnode";
import type { RenderToStringAsyncSource } from "./render-to-string";
import { assertSafeHtmlName, hasOwn, isPlainObject, isVNode, normalizeSource, renderAttributes } from "./render-shared";

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
  });
}

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
    "Async children must be modeled as async components; renderToStream() does not accept raw promise children.",
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
