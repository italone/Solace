import { jsx } from "./jsx-runtime";
import type { ComponentEventMap } from "./component/component";
import type {
  JSXChildren,
  JSXComponentProps,
  JSXElementProps,
  JSXKey,
  JSXProps,
} from "./jsx-types";
import { Fragment, type ComponentType, type VNode, type VNodeType } from "./vnode/vnode";

export { Fragment, jsx, jsxs } from "./jsx-runtime";
export type { JSX } from "./jsx-runtime";

export function jsxDEV(type: string, props?: JSXElementProps | null, key?: JSXKey): VNode;
export function jsxDEV<Props extends object, Events extends ComponentEventMap>(
  type: ComponentType<Props, Events>,
  props?: JSXComponentProps<Props, Events> | null,
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
