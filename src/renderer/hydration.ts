import {
  createComponentInstance,
  setupComponent,
  type ComponentInstance,
} from "../component/component";
import type { Provides } from "../component/provide";
import { isEventProp } from "../event/event";
import { ReactiveEffect } from "../reactivity/effect";
import { queueJob } from "../scheduler/scheduler";
import { ShapeFlags } from "../shared/flags";
import type { VNode, VNodeProps } from "../vnode/vnode";
import { patch } from "./diff";
import { patchProp } from "./dom";

export class SolaceHydrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SolaceHydrationError";
  }
}

export function hydrateVNode(
  vnode: VNode,
  node: Node | null,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): Node | null {
  if (node === null) {
    throw new SolaceHydrationError(`Missing DOM node for ${describeVNode(vnode)}`);
  }

  if (vnode.shapeFlag & ShapeFlags.ELEMENT) {
    return hydrateElement(vnode, node, parentComponent, appProvides);
  }

  if (vnode.shapeFlag & ShapeFlags.COMPONENT) {
    return hydrateComponent(vnode, node, parentComponent, appProvides);
  }

  if (vnode.shapeFlag & ShapeFlags.FRAGMENT) {
    return hydrateFragment(vnode, node, parentComponent, appProvides);
  }

  return node.nextSibling;
}

function hydrateElement(
  vnode: VNode,
  node: Node,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): Node | null {
  if (!(node instanceof Element) || node.tagName.toLowerCase() !== String(vnode.type)) {
    throw new SolaceHydrationError(
      `Expected <${String(vnode.type)}> but found ${describeDomNode(node)}`,
    );
  }

  vnode.el = node;
  hydrateProps(node, vnode.props);

  if (vnode.shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    const expected = vnode.children as string;
    if (node.textContent !== expected) {
      throw new SolaceHydrationError(
        `Text mismatch in <${String(vnode.type)}>: expected "${expected}" but found "${node.textContent ?? ""}"`,
      );
    }
    return node.nextSibling;
  }

  if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    hydrateChildren(vnode.children as VNode[], node.firstChild, parentComponent, appProvides);
  }

  return node.nextSibling;
}

function hydrateComponent(
  vnode: VNode,
  node: Node,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): Node | null {
  const updateContainer = node.parentNode;
  const instance = createComponentInstance(vnode, parentComponent, appProvides);
  vnode.component = instance;
  setupComponent(instance);

  const subTree = instance.render();
  instance.subTree = subTree;
  const next = hydrateVNode(subTree, node, instance, instance.appProvides);
  vnode.el = subTree.el;
  instance.isMounted = true;
  clearLifecycleHooks(instance);
  setupHydratedComponentUpdate(instance, updateContainer);

  return next;
}

function setupHydratedComponentUpdate(
  instance: ComponentInstance,
  updateContainer: Node | null,
): void {
  let hasCollectedHydrationDependencies = false;
  const componentUpdate = (): void => {
    try {
      if (instance.isUnmounted) {
        return;
      }

      if (!hasCollectedHydrationDependencies) {
        instance.render();
        hasCollectedHydrationDependencies = true;
        return;
      }

      const previousTree = instance.subTree;
      const nextTree = instance.render();

      if (previousTree !== null && updateContainer !== null) {
        patch(previousTree, nextTree, updateContainer, null, instance, instance.appProvides);
      }

      instance.subTree = nextTree;
      instance.vnode.el = nextTree.el;
      clearLifecycleHooks(instance);
    } finally {
      instance.isUpdateQueued = false;
    }
  };
  const reactiveEffect = new ReactiveEffect(componentUpdate, () => {
    if (!hasCollectedHydrationDependencies || instance.update === null || instance.isUpdateQueued) {
      return;
    }

    instance.isUpdateQueued = true;
    queueJob(instance.update);
  });

  instance.effect = reactiveEffect;
  instance.update = reactiveEffect.run.bind(reactiveEffect);
  instance.update();
}

function clearLifecycleHooks(instance: ComponentInstance): void {
  instance.mounted.length = 0;
  instance.updated.length = 0;
  instance.unmounted.length = 0;
}

function hydrateFragment(
  vnode: VNode,
  node: Node,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): Node | null {
  if (!(vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN)) {
    return node;
  }

  let current: Node | null = node;
  for (const child of vnode.children as VNode[]) {
    current = hydrateVNode(child, current, parentComponent, appProvides);
  }
  vnode.el = (vnode.children as VNode[])[0]?.el ?? null;

  return current;
}

function hydrateChildren(
  children: VNode[],
  firstNode: ChildNode | null,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): void {
  let current: Node | null = firstNode;
  for (const child of children) {
    current = hydrateVNode(child, current, parentComponent, appProvides);
  }
}

function hydrateProps(el: Element, props: VNodeProps | null): void {
  if (props === null) {
    return;
  }

  for (const [key, value] of Object.entries(props)) {
    if (key === "key" || !isEventProp(key)) {
      continue;
    }

    patchProp(el, key, null, value);
  }
}

function describeVNode(vnode: VNode): string {
  return typeof vnode.type === "string" ? `<${vnode.type}>` : "component";
}

function describeDomNode(node: Node): string {
  return node instanceof Element ? `<${node.tagName.toLowerCase()}>` : node.nodeName;
}
