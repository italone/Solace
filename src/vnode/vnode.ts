import { ShapeFlags } from "../shared/flags";
import { isThenable } from "../shared/utils";
import type { ComponentEventMap, ComponentSetupContext, Slot, Slots } from "../component/component";

export type ComponentProps = Record<string, unknown>;
export type ComponentRender = () => VNode;
export type ComponentType<
  Props extends object = ComponentProps,
  Events extends ComponentEventMap = ComponentEventMap,
  SlotMap extends object = Slots,
> = (props: Props, context: ComponentSetupContext<Events, SlotMap>) => ComponentRender | VNode;
// Runtime containers preserve the callable shape while erasing authoring-only metadata maps.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentTransport = ComponentType<never, any, any>;
export type AsyncComponentSetupResult = PromiseLike<ComponentRender | VNode>;
export type AsyncComponentType<Props extends object = ComponentProps> = (
  props: Props,
  context: ComponentSetupContext,
) => AsyncComponentSetupResult;
export const Fragment = Symbol("Solace.Fragment");
export type FragmentType = typeof Fragment;
// The VNode boundary intentionally erases a component's concrete metadata maps.
export type VNodeType = ComponentTransport | string | AsyncComponentType<never> | FragmentType;
export type VNodeProps = Record<string, unknown>;
export type VNodeChild = string | VNode;
export type AsyncVNodeChild = PromiseLike<VNodeChild>;
export type VNodeChildren = string | VNode | VNode[] | null;
export type AsyncVNodeChildren =
  VNodeChild | AsyncVNodeChild | readonly (VNodeChild | AsyncVNodeChild)[] | null;
export type VNodeSlots = Record<string, Slot>;
export type ComponentVNodeChildren = VNodeChildren | VNodeSlots;
type RequiredKeys<Value extends object> = {
  [Key in keyof Value]-?: object extends Pick<Value, Key> ? never : Key;
}[keyof Value];
type StrictComponentSlotChildren<SlotMap extends object> =
  Exclude<RequiredKeys<SlotMap>, "default"> extends never
    ? "default" extends keyof SlotMap
      ? VNodeChildren | SlotMap
      : SlotMap
    : SlotMap;
export type ComponentSlotChildren<SlotMap extends object> = string extends keyof SlotMap
  ? ComponentVNodeChildren
  : StrictComponentSlotChildren<SlotMap>;
export type ComponentSlotChildrenArguments<SlotMap extends object> = string extends keyof SlotMap
  ? [children?: ComponentVNodeChildren]
  : RequiredKeys<SlotMap> extends never
    ? [children?: ComponentSlotChildren<SlotMap>]
    : [children: ComponentSlotChildren<SlotMap>];
export type AsyncComponentVNodeChildren = ComponentVNodeChildren | AsyncVNodeChildren;

export interface VNode {
  type: VNodeType;
  props: VNodeProps | null;
  key: string | number | null;
  children: AsyncComponentVNodeChildren;
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
export function createVNode<
  Props extends object,
  Events extends ComponentEventMap,
  SlotMap extends object,
>(
  type: ComponentType<Props, Events, SlotMap>,
  props?: Props | null,
  children?: ComponentVNodeChildren,
): VNode;
export function createVNode<Props extends object>(
  type: AsyncComponentType<Props>,
  props?: Props | null,
  children?: AsyncComponentVNodeChildren,
): VNode;
export function createVNode(
  type: VNodeType,
  props?: VNodeProps | null,
  children?: AsyncComponentVNodeChildren,
): VNode;
export function createVNode(
  type: VNodeType,
  props: VNodeProps | null = null,
  children: AsyncComponentVNodeChildren = null,
): VNode {
  let shapeFlag = getShapeFlag(type);

  if (typeof children === "string") {
    shapeFlag |= ShapeFlags.TEXT_CHILDREN;
  } else if (Array.isArray(children)) {
    children = flattenChildren(children);
    shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
  } else if (children !== null && !isVNodeSlots(children)) {
    children = [children as VNodeChild | AsyncVNodeChild];
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

// JSX children mapping can interleave mapped arrays with standalone children,
// producing nested arrays like [[li, li], li]. The renderer only walks flat
// VNode arrays, so flatten before flagging ARRAY_CHILDREN.
function flattenChildren(
  children: readonly (VNodeChild | AsyncVNodeChild)[],
): (VNodeChild | AsyncVNodeChild)[] {
  const flattened: (VNodeChild | AsyncVNodeChild)[] = [];
  for (const child of children) {
    if (Array.isArray(child)) {
      flattened.push(...flattenChildren(child));
    } else {
      flattened.push(child);
    }
  }
  return flattened;
}

function isVNodeSlots(children: AsyncComponentVNodeChildren): children is VNodeSlots {
  return (
    children !== null &&
    typeof children === "object" &&
    !Array.isArray(children) &&
    !("type" in children) &&
    !isThenable(children)
  );
}
