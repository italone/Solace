import { callHooks } from "../component/lifecycle";
import { ShapeFlags } from "../shared/flags";
import type { VNode } from "../vnode/vnode";
import type { ComponentInstance } from "../component/component";
import { remove } from "./dom";
import { emitComponentDevtoolsEvent, emitRendererElementDevtoolsEvent } from "./devtools-events";

export function unmountChildren(children: VNode[]): void {
  for (const child of children) {
    unmount(child);
  }
}

export function unmount(vnode: VNode): void {
  if (vnode.shapeFlag & ShapeFlags.COMPONENT) {
    const instance = vnode.component as ComponentInstance | null;
    if (instance === null) {
      return;
    }

    instance.isUnmounted = true;
    instance.isMounted = false;
    instance.effect?.stop();
    instance.effect = null;
    instance.update = null;

    if (instance.subTree !== null) {
      unmount(instance.subTree);
    }
    callHooks(instance.unmounted);
    emitComponentDevtoolsEvent("component:unmount", instance);
    return;
  }

  if (vnode.shapeFlag & ShapeFlags.FRAGMENT) {
    if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      unmountChildren(vnode.children as VNode[]);
    }
    return;
  }

  if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    unmountChildren(vnode.children as VNode[]);
  }

  if (vnode.el !== null) {
    remove(vnode.el);
    emitRendererElementDevtoolsEvent("unmount", vnode.type as string);
  }
}
