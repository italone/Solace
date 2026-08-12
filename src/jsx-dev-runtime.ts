import { jsx } from "./jsx-runtime";
import type { ComponentEventMap } from "./component/component";
import {
  Fragment,
  type ComponentType,
  type VNode,
  type VNodeChild,
  type VNodeProps,
  type VNodeType,
} from "./vnode/vnode";

export { Fragment, jsx, jsxs } from "./jsx-runtime";
export type { JSX } from "./jsx-runtime";

type JSXChild = VNodeChild | number | boolean | null | undefined;
type JSXChildren = JSXChild | JSXChild[];
type JSXKey = string | number;
type JSXEventHandler = (...args: never[]) => unknown;
type JSXEventHandlerValue = JSXEventHandler | JSXEventHandler[];
type JSXDomEventHandler = (...args: never[]) => unknown;
type JSXElementProps = VNodeProps & {
  children?: JSXChildren;
} & {
  [eventHandler in `on${string}`]?: JSXDomEventHandler;
};
type JSXComponentProps<Props extends object> = Props & {
  children?: JSXChildren;
} & {
  [eventHandler in `on${string}`]?: JSXEventHandlerValue;
};

type JSXProps = JSXElementProps | JSXComponentProps<object> | { children?: JSXChildren };

export function jsxDEV(type: string, props?: JSXElementProps | null, key?: JSXKey): VNode;
export function jsxDEV<Props extends object, Events extends ComponentEventMap>(
  type: ComponentType<Props, Events>,
  props?: JSXComponentProps<Props> | null,
  key?: JSXKey,
): VNode;
export function jsxDEV(
  type: typeof Fragment,
  props?: { children?: JSXChildren } | null,
  key?: JSXKey,
): VNode;

export function jsxDEV(type: VNodeType, props: JSXProps | null = null, key?: JSXKey): VNode {
  return jsx(type as never, props as never, key as never);
}
