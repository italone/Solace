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
import type { StaticAssetManifest } from "./static-assets";
import { assertSSRAssetOptions, buildSSRAssetTags } from "./ssr-assets";
import {
  assertRouterSSROption,
  buildSnapshotScript,
  resolveRouterSSR,
  resolveRouterSSRSync,
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

export interface RenderToStringOptions {
  context?: Record<string, unknown>;
  provides?: Provides;
  router?: RouterSSROptions;
  manifest?: StaticAssetManifest;
  clientEntry?: string;
}

export type RenderToStringAsyncOptions = RenderToStringOptions;

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
  options: RenderToStringAsyncOptions = {},
): RenderToStringResult {
  assertRouterAwareSSROptions(options);
  assertNoAsyncSSRSource(source);
  const routerSSR = options.router !== undefined ? resolveRouterSSRSync(options.router) : null;
  const vnode = normalizeSource(source);
  const sink = createServerStyleSink();
  const rendered = withStyleSink(sink, () =>
    renderVNodeToString(
      vnode,
      null,
      routerSSR !== null ? routerSSR.provides : (options.provides ?? null),
    ),
  );
  let html = rendered;
  if (options.manifest !== undefined && options.clientEntry !== undefined) {
    html += buildSSRAssetTags(options.manifest, options.clientEntry);
  }
  if (routerSSR !== null) {
    html += buildSnapshotScript(routerSSR.snapshot);
  }

  return {
    html,
    styles: sink.styles,
  };
}

export async function renderToStringAsync(
  source: RenderToStringAsyncSource,
  options: RenderToStringAsyncOptions = {},
): Promise<RenderToStringResult> {
  assertRouterAwareSSROptions(options);
  const routerSSR = options.router !== undefined ? await resolveRouterSSR(options.router) : null;
  const prepared = await prepareAsyncSource(source, {
    appProvides: routerSSR !== null ? routerSSR.provides : (options.provides ?? null),
    collectStyles: true,
  });

  let html = renderPreparedVNodeToString(prepared.root);
  if (options.manifest !== undefined && options.clientEntry !== undefined) {
    html += buildSSRAssetTags(options.manifest, options.clientEntry);
  }
  if (routerSSR !== null) {
    html += buildSnapshotScript(routerSSR.snapshot);
  }

  return {
    html,
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

function assertRouterAwareSSROptions(options: RenderToStringAsyncOptions): void {
  assertBaseSSROptions(options);

  if (options.router !== undefined) {
    assertRouterSSROption(options.router);
    if (options.provides !== undefined) {
      throw new TypeError("SSR router option cannot be combined with provides");
    }
  }

  if (hasOwn(options, "stream")) {
    throw new TypeError(
      "Streaming SSR is deferred; renderToString() currently returns a complete string result.",
    );
  }

  const unknownKey = Reflect.ownKeys(options).find(
    (key) =>
      key !== "context" &&
      key !== "provides" &&
      key !== "router" &&
      key !== "manifest" &&
      key !== "clientEntry",
  );
  if (unknownKey !== undefined) {
    throw new TypeError(`Unknown SSR option: ${String(unknownKey)}`);
  }
}

function assertBaseSSROptions(options: RenderToStringOptions): void {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("SSR options must be an object");
  }

  if (options.context !== undefined && !isPlainObject(options.context)) {
    throw new TypeError("SSR context must be a plain object");
  }

  if (options.provides !== undefined && !(options.provides instanceof Map)) {
    throw new TypeError("SSR provides must be a Map");
  }

  assertSSRAssetOptions(options);
}
