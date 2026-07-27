import {
  createComponentInstance,
  setupComponent,
  type ComponentInstance,
} from "../component/component";
import type { Provides } from "../component/provide";
import { ShapeFlags } from "../shared/flags";
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
