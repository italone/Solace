import {
  createVNode,
  type AsyncComponentVNodeChildren,
  type ComponentVNodeChildren,
  Fragment,
  type VNode,
  type VNodeChildren,
  type VNodeProps,
  type VNodeType,
} from "./vnode";
import type { AsyncComponentType, ComponentType } from "./vnode";
import type { ComponentEventMap } from "../component/component";

export function h(type: string, props?: VNodeProps | null, children?: VNodeChildren): VNode;
export function h(
  type: typeof Fragment,
  props?: VNodeProps | null,
  children?: VNodeChildren,
): VNode;
export function h<Props extends object, Events extends ComponentEventMap>(
  type: ComponentType<Props, Events>,
  props?: Props | null,
  children?: ComponentVNodeChildren,
): VNode;
export function h<Props extends object>(
  type: AsyncComponentType<Props>,
  props?: Props | null,
  children?: AsyncComponentVNodeChildren,
): VNode;
export function h(
  type: VNodeType,
  props?: VNodeProps | null,
  children?: AsyncComponentVNodeChildren,
): VNode;
export function h(
  type: VNodeType,
  props: VNodeProps | null = null,
  children: AsyncComponentVNodeChildren = null,
): VNode {
  return createVNode(type, props, children);
}
