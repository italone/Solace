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

export type HydrationMismatchKind =
  "missing-node" | "extra-node" | "element-tag-mismatch" | "text-mismatch";

export interface HydrationContext {
  hydratedInstances: ComponentInstance[];
}

interface HydrationMismatchDetails {
  kind: HydrationMismatchKind;
  path: string;
  expected: string;
  actual: string;
  message: string;
}

export class SolaceHydrationError extends Error {
  readonly kind?: HydrationMismatchKind;
  readonly path?: string;
  readonly expected?: string;
  readonly actual?: string;

  constructor(messageOrDetails: string | HydrationMismatchDetails) {
    const message =
      typeof messageOrDetails === "string" ? messageOrDetails : messageOrDetails.message;
    super(message);
    this.name = "SolaceHydrationError";

    if (typeof messageOrDetails !== "string") {
      this.kind = messageOrDetails.kind;
      this.path = messageOrDetails.path;
      this.expected = messageOrDetails.expected;
      this.actual = messageOrDetails.actual;
    }
  }
}

export function hydrateVNode(
  vnode: VNode,
  node: Node | null,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  context: HydrationContext | null = null,
  path = "root",
): Node | null {
  assertNoAsyncHydrationTree(vnode);

  if (node === null) {
    throwHydrationMismatch({
      kind: "missing-node",
      path,
      expected: describeVNode(vnode),
      actual: "null",
      message: `Hydration mismatch at path ${path}: missing DOM node for ${describeVNode(vnode)}`,
    });
  }

  if (vnode.shapeFlag & ShapeFlags.ELEMENT) {
    return hydrateElement(vnode, node, parentComponent, appProvides, context, path);
  }

  if (vnode.shapeFlag & ShapeFlags.COMPONENT) {
    return hydrateComponent(vnode, node, parentComponent, appProvides, context, path);
  }

  if (vnode.shapeFlag & ShapeFlags.FRAGMENT) {
    return hydrateFragment(vnode, node, parentComponent, appProvides, context, path);
  }

  return node.nextSibling;
}

function hydrateElement(
  vnode: VNode,
  node: Node,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  context: HydrationContext | null,
  path: string,
): Node | null {
  if (!(node instanceof Element) || node.tagName.toLowerCase() !== String(vnode.type)) {
    throwHydrationMismatch({
      kind: "element-tag-mismatch",
      path,
      expected: `<${String(vnode.type)}>`,
      actual: describeDomNode(node),
      message: `Hydration mismatch at path ${path}: expected <${String(vnode.type)}> but found ${describeDomNode(node)}`,
    });
  }

  vnode.el = node;
  hydrateProps(node, vnode.props);

  if (vnode.shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    const expected = vnode.children as string;
    if (node.textContent !== expected) {
      const textPath = describeElementTextPath(path, vnode);
      throwHydrationMismatch({
        kind: "text-mismatch",
        path: textPath,
        expected: `text "${expected}"`,
        actual: `text "${node.textContent ?? ""}"`,
        message: `Hydration mismatch at path ${textPath}: expected text "${expected}" but found "${node.textContent ?? ""}"`,
      });
    }
    return node.nextSibling;
  }

  if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    const childPath = describeElementTextPath(path, vnode);
    const next = hydrateChildren(
      vnode.children as VNode[],
      node.firstChild,
      parentComponent,
      appProvides,
      context,
      childPath,
    );
    assertNoExtraDomNode(next, `${childPath}[${(vnode.children as VNode[]).length}]`);
  }

  return node.nextSibling;
}

function hydrateComponent(
  vnode: VNode,
  node: Node,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  context: HydrationContext | null,
  path: string,
): Node | null {
  const updateContainer = node.parentNode;
  const instance = createComponentInstance(vnode, parentComponent, appProvides);
  vnode.component = instance;
  setupComponent(instance);

  const subTree = instance.render();
  assertNoAsyncHydrationTree(subTree);
  instance.subTree = subTree;
  const next = hydrateVNode(subTree, node, instance, instance.appProvides, context, path);
  vnode.el = subTree.el;
  instance.isMounted = true;
  clearLifecycleHooks(instance);
  setupHydratedComponentUpdate(instance, updateContainer);
  context?.hydratedInstances.push(instance);

  return next;
}

export function stopHydratedComponentUpdates(context: HydrationContext): void {
  for (const instance of context.hydratedInstances) {
    instance.effect?.stop();
    instance.effect = null;
    instance.update = null;
    instance.isUnmounted = true;
    instance.isUpdateQueued = false;
  }

  context.hydratedInstances.length = 0;
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
        assertNoAsyncHydrationTree(instance.render());
        hasCollectedHydrationDependencies = true;
        return;
      }

      const previousTree = instance.subTree;
      const nextTree = instance.render();
      assertNoAsyncHydrationTree(nextTree);

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
  context: HydrationContext | null,
  path: string,
): Node | null {
  if (!(vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN)) {
    return node;
  }

  let current: Node | null = node;
  for (const [index, child] of (vnode.children as VNode[]).entries()) {
    current = hydrateVNode(
      child,
      current,
      parentComponent,
      appProvides,
      context,
      `${path}[${index}]`,
    );
  }
  vnode.el = (vnode.children as VNode[])[0]?.el ?? null;

  return current;
}

function hydrateChildren(
  children: VNode[],
  firstNode: ChildNode | null,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  context: HydrationContext | null,
  parentPath: string,
): Node | null {
  let current: Node | null = firstNode;
  for (const [index, child] of children.entries()) {
    current = hydrateVNode(
      child,
      current,
      parentComponent,
      appProvides,
      context,
      `${parentPath}[${index}]`,
    );
  }

  return current;
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

function describeElementTextPath(path: string, vnode: VNode): string {
  return `${path}/${String(vnode.type)}`;
}

export function assertNoExtraDomNode(node: Node | null, path: string): void {
  if (node === null) {
    return;
  }

  throwHydrationMismatch({
    kind: "extra-node",
    path,
    expected: "no DOM node",
    actual: describeDomNode(node),
    message: `Hydration mismatch at path ${path}: expected no DOM node but found ${describeDomNode(node)}`,
  });
}

function throwHydrationMismatch(details: HydrationMismatchDetails): never {
  throw new SolaceHydrationError(details);
}

function assertNoAsyncHydrationTree(value: unknown): void {
  if (isThenable(value)) {
    throw new TypeError(
      "Async hydration is deferred; hydrate() currently accepts synchronous hydration trees only.",
    );
  }
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}
