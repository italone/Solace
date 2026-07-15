import { ShapeFlags } from "../shared/flags";
import type { ComponentSetupContext, Slot } from "../component/component";

export type ComponentProps = Record<string, unknown>;
export type ComponentRender = () => VNode;
export type ComponentType<Props extends object = ComponentProps> = (
  props: Props,
  context: ComponentSetupContext,
) => ComponentRender | VNode;
export const Fragment = Symbol("Solace.Fragment");
export type FragmentType = typeof Fragment;
export type VNodeType = string | ComponentType<never> | FragmentType;
export type VNodeProps = Record<string, unknown>;
export type VNodeChild = string | VNode;
export type VNodeChildren = string | VNode | VNode[] | null;
export type VNodeSlots = Record<string, Slot>;
export type ComponentVNodeChildren = VNodeChildren | VNodeSlots;

export interface VNode {
  type: VNodeType;
  props: VNodeProps | null;
  key: string | number | null;
  children: ComponentVNodeChildren;
  shapeFlag: ShapeFlags;
  el: Element | Text | null;
  component: unknown;
}

export function createVNode(
  type: string,
  props?: VNodeProps | null,
  children?: VNodeChildren,
): VNode;
export function createVNode(
  type: FragmentType,
  props?: VNodeProps | null,
  children?: VNodeChildren,
): VNode;
export function createVNode<Props extends object>(
  type: ComponentType<Props>,
  props?: Props | null,
  children?: ComponentVNodeChildren,
): VNode;
export function createVNode(
  type: VNodeType,
  props?: VNodeProps | null,
  children?: ComponentVNodeChildren,
): VNode;
export function createVNode(
  type: VNodeType,
  props: VNodeProps | null = null,
  children: ComponentVNodeChildren = null,
): VNode {
  let shapeFlag = getShapeFlag(type);

  if (typeof children === "string") {
    shapeFlag |= ShapeFlags.TEXT_CHILDREN;
  } else if (Array.isArray(children)) {
    shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
  } else if (children !== null && !isVNodeSlots(children)) {
    children = [children];
    shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
  }

  return {
    type,
    props,
    key: normalizeKey(props?.key),
    children,
    shapeFlag,
    el: null,
    component: null,
  };
}

function getShapeFlag(type: VNodeType): ShapeFlags {
  if (type === Fragment) {
    return ShapeFlags.FRAGMENT;
  }

  return typeof type === "string" ? ShapeFlags.ELEMENT : ShapeFlags.COMPONENT;
}

function normalizeKey(key: unknown): string | number | null {
  return typeof key === "string" || typeof key === "number" ? key : null;
}

function isVNodeSlots(children: ComponentVNodeChildren): children is VNodeSlots {
  return (
    children !== null &&
    typeof children === "object" &&
    !Array.isArray(children) &&
    !("type" in children)
  );
}
