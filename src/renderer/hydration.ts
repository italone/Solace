import {
  createComponentInstance,
  setupComponent,
  type ComponentInstance,
} from "../component/component";
import type { Provides } from "../component/provide";
import { isEventProp } from "../event/event";
import { ReactiveEffect } from "../reactivity/effect";
import { associateJobCause, queueJob } from "../scheduler/scheduler";
import { peekLastDevtoolsTriggerCorrelationId } from "../devtools/events";
import { ShapeFlags } from "../shared/flags";
import type { PreparedVNode } from "../shared/async-tree";
import type { VNode, VNodeProps } from "../vnode/vnode";
import { patch } from "./diff";
import { patchProp } from "./dom";

export type HydrationMismatchKind =
  "missing-node" | "extra-node" | "element-tag-mismatch" | "text-mismatch" | "attribute-mismatch";

export type HydrationTextComparison = "exact" | "normalized-collapsing";

export interface HydrationContext {
  hydratedInstances: ComponentInstance[];
  textComparison?: HydrationTextComparison;
}

interface HydrationMismatchDetails {
  kind: HydrationMismatchKind;
  path: string;
  expected: string;
  actual: string;
  message: string;
  attributeName?: string;
}

export class SolaceHydrationError extends Error {
  readonly kind?: HydrationMismatchKind;
  readonly path?: string;
  readonly expected?: string;
  readonly actual?: string;
  readonly attributeName?: string;
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
      this.attributeName = messageOrDetails.attributeName;
    }
  }
}

function textMatches(
  expected: string,
  actual: string | null,
  context: HydrationContext | null,
): boolean {
  if (context?.textComparison === "normalized-collapsing") {
    return normalizeText(expected) === normalizeText(actual ?? "");
  }
  return actual === expected;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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

  node = skipComments(node);
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

  return skipComments(node.nextSibling);
}

export function hydratePreparedVNode(
  prepared: PreparedVNode,
  node: Node | null,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  context: HydrationContext | null = null,
  path = "root",
): Node | null {
  const { vnode } = prepared;
  node = skipComments(node);
  if (node === null) {
    throwHydrationMismatch({
      kind: "missing-node",
      path,
      expected: describeVNode(vnode),
      actual: "null",
      message: `Hydration mismatch at path ${path}: missing DOM node for ${describeVNode(vnode)}`,
    });
  }

  if (prepared.component !== null) {
    return hydratePreparedComponent(prepared, node, parentComponent, appProvides, context, path);
  }

  if (vnode.shapeFlag & ShapeFlags.ELEMENT) {
    return hydratePreparedElement(prepared, node, parentComponent, appProvides, context, path);
  }

  if (vnode.shapeFlag & ShapeFlags.FRAGMENT) {
    return hydratePreparedFragment(prepared, node, parentComponent, appProvides, context, path);
  }

  return skipComments(node.nextSibling);
}

function hydratePreparedElement(
  prepared: PreparedVNode,
  node: Node,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  context: HydrationContext | null,
  path: string,
): Node | null {
  const { vnode, children } = prepared;
  if (!(node instanceof Element) || node.tagName.toLowerCase() !== String(vnode.type)) {
    throwHydrationMismatch({
      kind: "element-tag-mismatch",
      path,
      expected: `<${String(vnode.type)}>`,
      actual: describeDomNode(node),
      message: `Hydration mismatch at path ${path}: expected <${String(vnode.type)}> but found ${describeDomNode(node)}`,
    });
  }

  assertHydrationAttributes(node, vnode.props, path);

  vnode.el = node;
  hydrateProps(node, vnode.props);

  if (typeof children === "string") {
    if (!textMatches(children, node.textContent, context)) {
      const textPath = describeElementTextPath(path, vnode);
      throwHydrationMismatch({
        kind: "text-mismatch",
        path: textPath,
        expected: `text "${children}"`,
        actual: `text "${node.textContent ?? ""}"`,
        message: `Hydration mismatch at path ${textPath}: expected text "${children}" but found "${node.textContent ?? ""}"`,
      });
    }
    return skipComments(node.nextSibling);
  }

  if (Array.isArray(children)) {
    const childPath = describeElementTextPath(path, vnode);
    const next = hydratePreparedChildren(
      children,
      skipComments(node.firstChild),
      parentComponent,
      appProvides,
      context,
      childPath,
    );
    assertNoExtraDomNode(next, `${childPath}[${children.length}]`);
  }

  return skipComments(node.nextSibling);
}

function hydratePreparedComponent(
  prepared: PreparedVNode,
  node: Node,
  _parentComponent: ComponentInstance | null,
  _appProvides: Provides | null,
  context: HydrationContext | null,
  path: string,
): Node | null {
  const component = prepared.component;
  if (component === null) {
    return node;
  }

  const { instance, subtree } = component;
  const updateContainer = node.parentNode;
  prepared.vnode.component = instance;
  const next = hydratePreparedVNode(subtree, node, instance, instance.appProvides, context, path);
  prepared.vnode.el = subtree.vnode.el;
  instance.subTree = subtree.vnode;
  instance.isMounted = true;
  instance.isUnmounted = false;
  clearLifecycleHooks(instance);
  setupHydratedComponentUpdate(instance, updateContainer);
  context?.hydratedInstances.push(instance);

  return next;
}

function hydratePreparedFragment(
  prepared: PreparedVNode,
  node: Node,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  context: HydrationContext | null,
  path: string,
): Node | null {
  if (!Array.isArray(prepared.children)) {
    return node;
  }

  let current: Node | null = node;
  for (const [index, child] of prepared.children.entries()) {
    current = hydratePreparedVNode(
      child,
      current,
      parentComponent,
      appProvides,
      context,
      `${path}[${index}]`,
    );
  }
  prepared.vnode.el = prepared.children[0]?.vnode.el ?? null;

  return current;
}

function hydratePreparedChildren(
  children: PreparedVNode[],
  firstNode: Node | null,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  context: HydrationContext | null,
  parentPath: string,
): Node | null {
  let current: Node | null = firstNode;
  for (const [index, child] of children.entries()) {
    current = skipComments(current);
    current = hydratePreparedVNode(
      child,
      current,
      parentComponent,
      appProvides,
      context,
      `${parentPath}[${index}]`,
    );
  }

  return skipComments(current);
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

  assertHydrationAttributes(node, vnode.props, path);

  vnode.el = node;
  hydrateProps(node, vnode.props);

  if (vnode.shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    const expected = vnode.children as string;
    if (!textMatches(expected, node.textContent, context)) {
      const textPath = describeElementTextPath(path, vnode);
      throwHydrationMismatch({
        kind: "text-mismatch",
        path: textPath,
        expected: `text "${expected}"`,
        actual: `text "${node.textContent ?? ""}"`,
        message: `Hydration mismatch at path ${textPath}: expected text "${expected}" but found "${node.textContent ?? ""}"`,
      });
    }
    return skipComments(node.nextSibling);
  }

  if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    const childPath = describeElementTextPath(path, vnode);
    const next = hydrateChildren(
      vnode.children as VNode[],
      skipComments(node.firstChild),
      parentComponent,
      appProvides,
      context,
      childPath,
    );
    assertNoExtraDomNode(next, `${childPath}[${(vnode.children as VNode[]).length}]`);
  }

  return skipComments(node.nextSibling);
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
  const componentUpdate = (): void | false => {
    try {
      if (instance.isUnmounted) {
        return false;
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
    const devtoolsCause = peekLastDevtoolsTriggerCorrelationId();
    if (devtoolsCause !== undefined && instance.update !== null) {
      associateJobCause(instance.update, devtoolsCause);
    }
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
  firstNode: Node | null,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  context: HydrationContext | null,
  parentPath: string,
): Node | null {
  let current: Node | null = firstNode;
  for (const [index, child] of children.entries()) {
    current = skipComments(current);
    current = hydrateVNode(
      child,
      current,
      parentComponent,
      appProvides,
      context,
      `${parentPath}[${index}]`,
    );
  }

  return skipComments(current);
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

// value/checked are compared via DOM properties (live form state) rather than attributes,
// on whatever element carries the prop.
const FORM_VALUE_PROPS = new Set(["value", "checked"]);

function assertHydrationAttributes(el: Element, props: VNodeProps | null, path: string): void {
  if (props === null) return;
  for (const [key, value] of Object.entries(props)) {
    if (key === "key" || key === "ref" || key === "style" || isEventProp(key)) continue;
    const attribute = key;

    if (value === undefined || value === null || value === false) {
      if (el.getAttribute(attribute) !== null) {
        throwAttributeMismatch(
          path,
          el,
          attribute,
          String(value),
          el.getAttribute(attribute) ?? "",
        );
      }
      continue;
    }
    if (value === true) {
      if (el.getAttribute(attribute) === null) {
        throwAttributeMismatch(path, el, attribute, "true", "absent");
      }
      continue;
    }
    if (FORM_VALUE_PROPS.has(attribute)) {
      const domValue = (el as unknown as Record<string, unknown>)[attribute];
      if (String(domValue) !== String(value)) {
        throwAttributeMismatch(path, el, attribute, String(value), String(domValue));
      }
      continue;
    }
    const actual = el.getAttribute(attribute);
    if (actual !== String(value)) {
      throwAttributeMismatch(path, el, attribute, String(value), actual ?? "absent");
    }
  }
}

function throwAttributeMismatch(
  path: string,
  el: Element,
  attribute: string,
  expected: string,
  actual: string,
): never {
  throwHydrationMismatch({
    kind: "attribute-mismatch",
    path: `${path}/${el.tagName.toLowerCase()}`,
    attributeName: attribute,
    expected: `attribute "${attribute}" = "${expected}"`,
    actual: `attribute "${attribute}" = "${actual}"`,
    message: `Hydration mismatch at path ${path}/${el.tagName.toLowerCase()}: expected attribute "${attribute}" = "${expected}" but found "${actual}"`,
  });
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

function skipComments(node: Node | null): Node | null {
  let current = node;
  while (current !== null && current.nodeType === Node.COMMENT_NODE) {
    current = current.nextSibling;
  }
  return current;
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
