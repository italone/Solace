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
