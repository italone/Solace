import {
  createComponentInstance,
  setupComponent,
  updateComponentProps,
  type ComponentInstance,
} from "../component/component";
import { callHooks } from "../component/lifecycle";
import type { Provides } from "../component/provide";
import { ReactiveEffect } from "../reactivity/effect";
import { queueJob } from "../scheduler/scheduler";
import { ShapeFlags } from "../shared/flags";
import { isThenable } from "../shared/utils";
import type { VNode } from "../vnode/vnode";
import { isSameVNodeType, mountChildren, patchChildren } from "./children";
import { emitComponentDevtoolsEvent, emitRendererElementDevtoolsEvent } from "./devtools-events";
import { createElement, insert, setText } from "./dom";
import { havePropsChanged, mountInitialProps, patchProps } from "./props";
import { unmount } from "./unmount";

export function patch(
  n1: VNode | null,
  n2: VNode,
  container: Node,
  anchor: Node | null = null,
  parentComponent: ComponentInstance | null = null,
  appProvides: Provides | null = parentComponent?.appProvides ?? null,
): void {
  if (isThenable(n2)) {
    throw new TypeError(
      "Async client rendering is deferred; render() and mount() require synchronous trees.",
    );
  }

  if (n1 !== null && !isSameVNodeType(n1, n2)) {
    const nextAnchor = n1.el?.nextSibling ?? anchor;
    unmount(n1);
    patch(null, n2, container, nextAnchor, parentComponent, appProvides);
    return;
  }

  if (n2.shapeFlag & ShapeFlags.ELEMENT) {
    if (n1 === null) {
      mountElement(n2, container, anchor, parentComponent, appProvides);
      return;
    }

    patchElement(n1, n2, parentComponent, appProvides);
    return;
  }

  if (n2.shapeFlag & ShapeFlags.FRAGMENT) {
    if (n1 === null) {
      mountFragment(n2, container, anchor, parentComponent, appProvides);
      return;
    }

    patchChildren(n1, n2, container, parentComponent, appProvides);
    n2.el = getFragmentRoot(n2);
    return;
  }

  if (n2.shapeFlag & ShapeFlags.COMPONENT) {
    if (n1 === null) {
      mountComponent(n2, container, anchor, parentComponent, appProvides);
      return;
    }

    updateComponent(n1, n2);
  }
}

function mountFragment(
  vnode: VNode,
  container: Node,
  anchor: Node | null,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): void {
  if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    const children = vnode.children as VNode[];

    if (canBatchMountFragment(children)) {
      const fragment = document.createDocumentFragment();
      for (const child of children) {
        patch(null, child, fragment, null, parentComponent, appProvides);
      }
      insert(fragment, container, anchor);
      vnode.el = getFragmentRoot(vnode);
      return;
    }

    for (const child of children) {
      patch(null, child, container, anchor, parentComponent, appProvides);
    }
  }

  vnode.el = getFragmentRoot(vnode);
}

function canBatchMountFragment(children: VNode[]): boolean {
  return children.length > 0;
}

function mountElement(
  vnode: VNode,
  container: Node,
  anchor: Node | null,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): void {
  const el = createElement(vnode.type as string);
  vnode.el = el;

  if (vnode.props) {
    mountInitialProps(el, vnode.props);
  }

  if (vnode.shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    setText(el, vnode.children as string);
  } else if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    mountChildren(vnode.children as VNode[], el, parentComponent, appProvides);
  }

  insert(el, container, anchor);
  emitRendererElementDevtoolsEvent("mount", vnode.type as string);
}

function mountComponent(
  vnode: VNode,
  container: Node,
  anchor: Node | null,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): void {
  const instance = createComponentInstance(vnode, parentComponent, appProvides);
  vnode.component = instance;

  setupComponent(instance);

  const componentUpdate = (): void => {
    try {
      if (instance.isUnmounted) {
        return;
      }

      if (!instance.isMounted) {
        const subTree = instance.render();
        instance.subTree = subTree;
        patch(null, subTree, container, anchor, instance, instance.appProvides);
        vnode.el = subTree.el;
        instance.isMounted = true;
        callHooks(instance.mounted);
        emitComponentDevtoolsEvent("component:mount", instance);
        return;
      }

      const nextTree = instance.render();
      const previousTree = instance.subTree;
      const updateContainer = previousTree?.el?.parentNode ?? container;

      patch(previousTree, nextTree, updateContainer, anchor, instance, instance.appProvides);

      instance.subTree = nextTree;
      instance.vnode.el = nextTree.el;
      callHooks(instance.updated);
      emitComponentDevtoolsEvent("component:update", instance);
    } finally {
      instance.isUpdateQueued = false;
    }
  };
  const reactiveEffect = new ReactiveEffect(componentUpdate, () => {
    if (instance.update === null || instance.isUpdateQueued) {
      return;
    }

    instance.isUpdateQueued = true;
    queueJob(instance.update);
  });

  instance.effect = reactiveEffect;
  instance.update = reactiveEffect.run.bind(reactiveEffect);
  instance.update();
}

function getFragmentRoot(vnode: VNode): Element | Text | null {
  if (!(vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN)) {
    return null;
  }

  return ((vnode.children as VNode[])[0]?.el as Element | Text | null | undefined) ?? null;
}

function updateComponent(n1: VNode, n2: VNode): void {
  const instance = n1.component as ComponentInstance;
  n2.component = instance;

  if (!shouldUpdateComponent(n1, n2)) {
    instance.vnode = n2;
    n2.el = n1.el;
    return;
  }

  updateComponentProps(instance, n2);

  instance.update?.();
  n2.el = instance.subTree?.el ?? null;
}

function shouldUpdateComponent(n1: VNode, n2: VNode): boolean {
  if (n1.children !== n2.children) {
    return true;
  }

  return havePropsChanged(n1.props, n2.props);
}

function patchElement(
  n1: VNode,
  n2: VNode,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): void {
  const el = n1.el as Element;
  n2.el = el;

  const propsChanged = havePropsChanged(n1.props, n2.props);
  const childrenChanged = haveElementChildrenChanged(n1, n2);

  if (!propsChanged && !childrenChanged) {
    return;
  }

  if (propsChanged) {
    patchProps(el, n1.props, n2.props);
  }

  if (childrenChanged) {
    patchChildren(n1, n2, el, parentComponent, appProvides);
  }

  emitRendererElementDevtoolsEvent("update", n2.type as string);
}

function haveElementChildrenChanged(n1: VNode, n2: VNode): boolean {
  const oldShapeFlag = n1.shapeFlag;
  const newShapeFlag = n2.shapeFlag;
  const oldHasTextChildren = Boolean(oldShapeFlag & ShapeFlags.TEXT_CHILDREN);
  const newHasTextChildren = Boolean(newShapeFlag & ShapeFlags.TEXT_CHILDREN);
  const oldHasArrayChildren = Boolean(oldShapeFlag & ShapeFlags.ARRAY_CHILDREN);
  const newHasArrayChildren = Boolean(newShapeFlag & ShapeFlags.ARRAY_CHILDREN);

  if (oldHasTextChildren || newHasTextChildren) {
    return !oldHasTextChildren || !newHasTextChildren || n1.children !== n2.children;
  }

  if (oldHasArrayChildren || newHasArrayChildren) {
    return !oldHasArrayChildren || !newHasArrayChildren || n1.children !== n2.children;
  }

  return false;
}
