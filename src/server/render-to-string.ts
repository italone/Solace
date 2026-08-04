import {
  createComponentInstance,
  setupComponent,
  type ComponentInstance,
} from "../component/component";
import type { Provides } from "../component/provide";
import { createServerStyleSink, withStyleSink } from "../component/style";
import { ShapeFlags } from "../shared/flags";
import { escapeAttribute, escapeHtml } from "../shared/html";
import { h } from "../vnode/h";
import type { ComponentType, VNode, VNodeProps } from "../vnode/vnode";

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
  assertNoDeferredIntegrationOptions(options);
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

function normalizeSource(source: RenderToStringSource): VNode {
  if (isVNode(source)) {
    return source;
  }

  if (typeof source === "function") {
    return h(source as ComponentType);
  }

  throw new TypeError("SSR source must be a VNode or component function");
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

function assertNoAsyncSSRSource(value: unknown): void {
  if (isThenable(value)) {
    throw new TypeError(
      "Async SSR is deferred; renderToString() currently accepts synchronous render trees only.",
    );
  }
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
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

function assertNoDeferredIntegrationOptions(options: RenderToStringOptions): void {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("SSR options must be an object");
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
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
