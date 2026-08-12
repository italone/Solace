import { h } from "./vnode/h";
import type { ComponentEventMap } from "./component/component";
import type {
  JSXChildren,
  JSXComponentProps,
  JSXElementProps,
  JSXKey,
  JSXManagedComponentProps,
  JSXProps,
} from "./jsx-types";
import {
  Fragment,
  type ComponentType,
  type ComponentRender,
  type VNode,
  type VNodeChild,
  type VNodeChildren,
  type VNodeType,
} from "./vnode/vnode";

export { Fragment };

export function jsx(type: string, props?: JSXElementProps | null, key?: JSXKey): VNode;
export function jsx<Props extends object, Events extends ComponentEventMap>(
  type: ComponentType<Props, Events>,
  props?: JSXComponentProps<Props, Events> | null,
  key?: JSXKey,
): VNode;
export function jsx(
  type: typeof Fragment,
  props?: { children?: JSXChildren } | null,
  key?: JSXKey,
): VNode;
export function jsx(type: VNodeType, props: JSXProps | null = null, key?: JSXKey): VNode {
  return createJsxVNode(type, props, key);
}

export function jsxs(type: string, props?: JSXElementProps | null, key?: JSXKey): VNode;
export function jsxs<Props extends object, Events extends ComponentEventMap>(
  type: ComponentType<Props, Events>,
  props?: JSXComponentProps<Props, Events> | null,
  key?: JSXKey,
): VNode;
export function jsxs(
  type: typeof Fragment,
  props?: { children?: JSXChildren } | null,
  key?: JSXKey,
): VNode;
export function jsxs(type: VNodeType, props: JSXProps | null = null, key?: JSXKey): VNode {
  return createJsxVNode(type, props, key);
}

function createJsxVNode(type: VNodeType, props: JSXProps | null, key?: JSXKey): VNode {
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
      .filter(
        (child): child is VNodeChild | number =>
          child !== null && child !== undefined && typeof child !== "boolean",
      )
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
  export type ElementType = VNodeType | ((props: never) => VNode | ComponentRender);
  export type IntrinsicElementProps = JSXElementProps;
  export type LibraryManagedAttributes<Component, Props> = JSXManagedComponentProps<
    Component,
    Props
  >;
  export interface IntrinsicElements {
    [name: string]: IntrinsicElementProps;
  }
  export interface IntrinsicAttributes {
    children?: JSXChildren;
    key?: JSXKey;
  }
  export interface ElementChildrenAttribute {
    children: unknown;
  }
}
