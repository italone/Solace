import { h } from "./vnode/h";
import {
  Fragment,
  type VNode,
  type VNodeChild,
  type VNodeChildren,
  type VNodeProps,
  type VNodeType,
} from "./vnode/vnode";

type JSXChild = VNodeChild | number | boolean | null | undefined;
type JSXChildren = JSXChild | JSXChild[];
type JSXProps = VNodeProps & {
  children?: JSXChildren;
};

export { Fragment };

export function jsx(type: VNodeType, props: JSXProps | null = null, key?: string): VNode {
  return createJsxVNode(type, props, key);
}

export function jsxs(type: VNodeType, props: JSXProps | null = null, key?: string): VNode {
  return createJsxVNode(type, props, key);
}

function createJsxVNode(type: VNodeType, props: JSXProps | null, key?: string): VNode {
  const { children, ...restProps } = props ?? {};
  const vnodeProps = {
    ...restProps,
    ...(key !== undefined ? { key } : {}),
  };

  return h(type, vnodeProps, normalizeChildren(children));
}

function normalizeChildren(children: JSXChildren): VNodeChildren {
  if (Array.isArray(children)) {
    const normalized = children
      .filter((child) => child !== null && child !== undefined && typeof child !== "boolean")
      .map((child) => (typeof child === "number" ? String(child) : child));

    if (normalized.every((child) => typeof child === "string")) {
      return normalized.join("");
    }

    return normalized.map((child) =>
      typeof child === "string" ? h("span", null, child) : child,
    ) as VNode[];
  }

  if (children === null || children === undefined || typeof children === "boolean") {
    return null;
  }

  if (typeof children === "number") {
    return String(children);
  }

  return typeof children === "string" ? children : [children];
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JSX {
  export type Element = VNode;
  export interface IntrinsicElements {
    [name: string]: VNodeProps & {
      children?: JSXChildren;
    };
  }
  export interface ElementChildrenAttribute {
    children: unknown;
  }
}
