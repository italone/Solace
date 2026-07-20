import type {
  ComponentProps,
  ComponentRender,
  ComponentType,
  ComponentVNodeChildren,
  VNode,
  VNodeChildren,
  VNodeSlots,
} from "../vnode/vnode";
import { emitDevtoolsEvent, hasDevtoolsListeners } from "../devtools/events";
import type { ReactiveEffect } from "../reactivity/effect";
import { setCurrentInstance, type LifecycleHook } from "./lifecycle";
import { initProps, updateProps } from "./props";
import type { Provides } from "./provide";

export type EmitFn = (event: string, ...args: unknown[]) => void;
export type SlotProps = Record<string, unknown>;
export type Slot = (props?: SlotProps) => VNodeChildren;

export interface Slots {
  default?: Slot;
  [name: string]: Slot | undefined;
}

export interface ComponentSetupContext {
  emit: EmitFn;
  slots: Slots;
}

export interface ComponentInstance {
  vnode: VNode;
  type: ComponentType<never>;
  parent: ComponentInstance | null;
  appProvides: Provides | null;
  props: ComponentProps;
  provides: Provides;
  slots: Slots;
  setupState: Record<string, unknown>;
  subTree: VNode | null;
  devtoolsId: number;
  isMounted: boolean;
  isUnmounted: boolean;
  isUpdateQueued: boolean;
  render: ComponentRender;
  effect: ReactiveEffect<void> | null;
  update: (() => void) | null;
  emit: EmitFn;
  mounted: LifecycleHook[];
  updated: LifecycleHook[];
  unmounted: LifecycleHook[];
}

let nextComponentDevtoolsId = 1;

export function createComponentInstance(
  vnode: VNode,
  parent: ComponentInstance | null = null,
  appProvides: Provides | null = parent?.appProvides ?? null,
): ComponentInstance {
  const instance: ComponentInstance = {
    vnode,
    type: vnode.type as ComponentType,
    parent,
    appProvides,
    props: {},
    provides: new Map(),
    slots: {},
    setupState: {},
    subTree: null,
    devtoolsId: nextComponentDevtoolsId,
    isMounted: false,
    isUnmounted: false,
    isUpdateQueued: false,
    render: () => {
      throw new Error("Component render function called before setup");
    },
    effect: null,
    update: null,
    emit: () => undefined,
    mounted: [],
    updated: [],
    unmounted: [],
  };

  nextComponentDevtoolsId += 1;
  instance.emit = emit.bind(null, instance);
  return instance;
}

export function getComponentDevtoolsName(instance: ComponentInstance): string {
  return instance.type.name || "AnonymousComponent";
}

export function setupComponent(instance: ComponentInstance): void {
  initProps(instance, instance.vnode.props);
  initSlots(instance, instance.vnode.children);

  let resolvedRender: ComponentRender | null = null;
  let hasResolvedSetup = false;
  const setupContext: ComponentSetupContext = {
    emit: instance.emit,
    slots: instance.slots,
  };

  instance.render = () => {
    if (resolvedRender !== null) {
      return resolvedRender();
    }

    const setupResult = runComponentSetup(instance, setupContext, hasResolvedSetup);
    hasResolvedSetup = true;
    if (typeof setupResult === "function") {
      resolvedRender = setupResult;
      return resolvedRender();
    }

    return setupResult;
  };
}

export function updateComponentProps(instance: ComponentInstance, nextVNode: VNode): void {
  instance.vnode = nextVNode;
  updateProps(instance, nextVNode.props);
  initSlots(instance, nextVNode.children);
}

function runComponentSetup(
  instance: ComponentInstance,
  setupContext: ComponentSetupContext,
  hasResolvedSetup: boolean,
): ComponentRender | VNode {
  if (hasResolvedSetup) {
    return instance.type(instance.props as never, setupContext);
  }

  setCurrentInstance(instance);
  try {
    return instance.type(instance.props as never, setupContext);
  } finally {
    setCurrentInstance(null);
  }
}

function initSlots(instance: ComponentInstance, children: ComponentVNodeChildren): void {
  for (const key of Object.keys(instance.slots)) {
    delete instance.slots[key];
  }

  if (children === null) {
    return;
  }

  if (isVNodeSlots(children)) {
    for (const [name, slot] of Object.entries(children)) {
      if (typeof slot === "function") {
        instance.slots[name] = slot;
      }
    }
    return;
  }

  instance.slots.default = () => children;
}

function emit(instance: ComponentInstance, event: string, ...args: unknown[]): void {
  const handler = resolveEmitHandler(instance.vnode.props, event);
  emitComponentEmitDevtoolsEvent(instance, event, handler);

  if (typeof handler === "function") {
    handler(...args);
    return;
  }

  if (Array.isArray(handler)) {
    for (const item of handler) {
      if (typeof item === "function") {
        item(...args);
      }
    }
  }
}

function emitComponentEmitDevtoolsEvent(
  instance: ComponentInstance,
  event: string,
  handler: unknown,
): void {
  if (!hasDevtoolsListeners()) {
    return;
  }

  emitDevtoolsEvent({
    type: "component:emit",
    id: instance.devtoolsId,
    name: getComponentDevtoolsName(instance),
    event,
    handlerCount: countEmitHandlers(handler),
  });
}

function countEmitHandlers(handler: unknown): number {
  if (typeof handler === "function") {
    return 1;
  }

  if (Array.isArray(handler)) {
    return handler.filter((item) => typeof item === "function").length;
  }

  return 0;
}

function resolveEmitHandler(props: ComponentProps | null, event: string): unknown {
  if (props === null) {
    return undefined;
  }

  return props[toHandlerKey(camelize(event))] ?? props[toHandlerKey(event)];
}

function toHandlerKey(event: string): string {
  return `on${event.charAt(0).toUpperCase()}${event.slice(1)}`;
}

function camelize(value: string): string {
  return value.replace(/-(\w)/g, (_, character: string) => character.toUpperCase());
}

function isVNodeSlots(children: ComponentVNodeChildren): children is VNodeSlots {
  return (
    children !== null &&
    typeof children === "object" &&
    !Array.isArray(children) &&
    !("type" in children)
  );
}
