import {
  createComponentInstance,
  setupComponent,
  type ComponentInstance,
} from "../component/component";
import type { Provides } from "../component/provide";
import { createServerStyleSink, withStyleSink } from "../component/style";
import { ShapeFlags } from "../shared/flags";
import { prepareAsyncSource, type PreparedVNode } from "../shared/async-tree";
import { escapeHtml } from "../shared/html";
import { isThenable } from "../shared/utils";
import type { AsyncComponentType, ComponentTransport, VNode } from "../vnode/vnode";
import {
  assertSafeHtmlName,
  hasOwn,
  isPlainObject,
  isVNode,
  normalizeSource,
  renderAttributes,
} from "./render-shared";

export interface RenderToStringOptions {
  context?: Record<string, unknown>;
  provides?: Provides;
}

export interface RenderToStringResult {
  html: string;
  styles: string[];
}

export type RenderToStringSource = VNode | ComponentTransport | (() => VNode);
export type RenderToStringAsyncSource =
  | RenderToStringSource
  | AsyncComponentType
  | PromiseLike<RenderToStringSource | AsyncComponentType>;

export function renderToString(
  source: RenderToStringSource,
  options: RenderToStringOptions = {},
): RenderToStringResult {
  assertNoDeferredIntegrationOptions(options);
  assertNoAsyncSSRSource(source);
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

export async function renderToStringAsync(
  source: RenderToStringAsyncSource,
  options: RenderToStringOptions = {},
): Promise<RenderToStringResult> {
  assertNoDeferredIntegrationOptions(options);
  const prepared = await prepareAsyncSource(source, {
    appProvides: options.provides ?? null,
    collectStyles: true,
  });

  return {
    html: renderPreparedVNodeToString(prepared.root),
    styles: prepared.styles,
  };
}

function renderVNodeToString(
  vnode: VNode,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): string {
  assertNoAsyncSSRSource(vnode);

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

function renderPreparedVNodeToString(prepared: PreparedVNode): string {
  if (prepared.component !== null) {
    return renderPreparedVNodeToString(prepared.component.subtree);
  }

  const { vnode } = prepared;
  if (vnode.shapeFlag & ShapeFlags.ELEMENT) {
    const tag = String(vnode.type);
    assertSafeHtmlName(tag, "element");
    return `<${tag}${renderAttributes(vnode.props)}>${renderPreparedChildrenToString(prepared.children)}</${tag}>`;
  }

  if (vnode.shapeFlag & ShapeFlags.FRAGMENT) {
    return renderPreparedChildrenToString(prepared.children);
  }

  return "";
}

function renderPreparedChildrenToString(children: PreparedVNode["children"]): string {
  if (children === null) {
    return "";
  }

  if (typeof children === "string") {
    return escapeHtml(children);
  }

  return children.map(renderPreparedVNodeToString).join("");
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
  assertNoAsyncSSRSource(children);

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

function assertNoAsyncSSRSource(value: unknown): void {
  if (isThenable(value)) {
    throw new TypeError(
      "Async SSR is deferred; renderToString() currently accepts synchronous render trees only.",
    );
  }
}

function assertNoDeferredIntegrationOptions(options: RenderToStringOptions): void {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("SSR options must be an object");
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

  if (hasOwn(options, "stream")) {
    throw new TypeError(
      "Streaming SSR is deferred; renderToString() currently returns a complete string result.",
    );
  }

  const unknownKey = Reflect.ownKeys(options).find(
    (key) => key !== "context" && key !== "provides",
  );
  if (unknownKey !== undefined) {
    throw new TypeError(`Unknown SSR option: ${String(unknownKey)}`);
  }
}
