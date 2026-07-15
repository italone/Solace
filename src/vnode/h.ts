import {
  createVNode,
  type ComponentVNodeChildren,
  Fragment,
  type VNode,
  type VNodeChildren,
  type VNodeProps,
  type VNodeType,
} from "./vnode";
import type { ComponentType } from "./vnode";

export function h(type: string, props?: VNodeProps | null, children?: VNodeChildren): VNode;
export function h(
  type: typeof Fragment,
  props?: VNodeProps | null,
  children?: VNodeChildren,
): VNode;
export function h<Props extends object>(
  type: ComponentType<Props>,
  props?: Props | null,
  children?: ComponentVNodeChildren,
): VNode;
export function h(
  type: VNodeType,
  props?: VNodeProps | null,
  children?: ComponentVNodeChildren,
): VNode;
export function h(
  type: VNodeType,
  props: VNodeProps | null = null,
  children: ComponentVNodeChildren = null,
): VNode {
  return createVNode(type, props, children);
}
