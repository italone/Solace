import {
  createComponentInstance,
  getComponentDevtoolsName,
  setupComponent,
  updateComponentProps,
  type ComponentInstance,
} from "../component/component";
import { callHooks } from "../component/lifecycle";
import type { Provides } from "../component/provide";
import { emitDevtoolsEvent, hasDevtoolsListeners } from "../devtools/events";
import { isEventProp } from "../event/event";
import { ReactiveEffect } from "../reactivity/effect";
import { queueJob } from "../scheduler/scheduler";
import { ShapeFlags } from "../shared/flags";
import type { VNode, VNodeProps } from "../vnode/vnode";
import { createElement, insert, patchProp, remove, setText } from "./dom";

export function patch(
  n1: VNode | null,
  n2: VNode,
  container: Node,
  anchor: Node | null = null,
  parentComponent: ComponentInstance | null = null,
  appProvides: Provides | null = parentComponent?.appProvides ?? null,
): void {
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

      patch(previousTree, nextTree, container, anchor, instance, instance.appProvides);

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

function mountChildren(
  children: VNode[],
  container: Node,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): void {
  if (canBatchMountChildren(children, 0, children.length - 1)) {
    const fragment = document.createDocumentFragment();
    for (const child of children) {
      patch(null, child, fragment, null, parentComponent, appProvides);
    }
    insert(fragment, container, null);
    return;
  }

  for (const child of children) {
    patch(null, child, container, null, parentComponent, appProvides);
  }
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

function havePropsChanged(oldProps: VNodeProps | null, newProps: VNodeProps | null): boolean {
  if (oldProps === newProps) {
    return false;
  }

  if (oldProps === null) {
    return hasPatchableProps(newProps);
  }

  if (newProps === null) {
    return hasPatchableProps(oldProps);
  }

  for (const key in oldProps) {
    if (!hasOwnProp(oldProps, key) || key === "key") {
      continue;
    }

    if (!hasOwnProp(newProps, key) || oldProps[key] !== newProps[key]) {
      return true;
    }
  }

  for (const key in newProps) {
    if (!hasOwnProp(newProps, key) || key === "key") {
      continue;
    }

    if (!hasOwnProp(oldProps, key)) {
      return true;
    }
  }

  return false;
}

function hasPatchableProps(props: VNodeProps | null): boolean {
  if (props === null) {
    return false;
  }

  for (const key in props) {
    if (hasOwnProp(props, key) && key !== "key") {
      return true;
    }
  }

  return false;
}

function hasOwnProp(props: VNodeProps, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(props, key);
}

function mountInitialProps(el: Element, props: VNodeProps): void {
  for (const key in props) {
    if (!hasOwnProp(props, key) || key === "key") {
      continue;
    }

    const value = props[key];
    if (value === null || value === undefined || value === false) {
      continue;
    }

    if (key === "class") {
      mountInitialClass(el, value);
      continue;
    }

    if (mightBeEventProp(key)) {
      patchProp(el, key, null, value);
      continue;
    }

    el.setAttribute(key, String(value));
  }
}

function mountInitialClass(el: Element, value: unknown): void {
  if (el instanceof HTMLElement) {
    el.className = String(value);
    return;
  }

  el.setAttribute("class", String(value));
}

function mightBeEventProp(key: string): boolean {
  return key.length > 2 && key[0] === "o" && key[1] === "n" && isEventProp(key);
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

function patchProps(el: Element, oldProps: VNodeProps | null, newProps: VNodeProps | null): void {
  const previousProps = oldProps ?? {};
  const nextProps = newProps ?? {};

  for (const [key, nextValue] of Object.entries(nextProps)) {
    if (key === "key") {
      continue;
    }

    const previousValue = previousProps[key];
    if (previousValue !== nextValue) {
      patchProp(el, key, previousValue, nextValue);
    }
  }

  for (const key of Object.keys(previousProps)) {
    if (key !== "key" && !(key in nextProps)) {
      patchProp(el, key, previousProps[key], null);
    }
  }
}

function patchChildren(
  n1: VNode,
  n2: VNode,
  container: Node,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): void {
  const oldChildren = n1.children;
  const newChildren = n2.children;
  const oldShapeFlag = n1.shapeFlag;
  const newShapeFlag = n2.shapeFlag;

  if (newShapeFlag & ShapeFlags.TEXT_CHILDREN) {
    if (oldShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      unmountChildren(oldChildren as VNode[]);
    }

    if (oldChildren !== newChildren) {
      setText(container, newChildren as string);
    }
    return;
  }

  if (newShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    const nextChildren = newChildren as VNode[];

    if (oldShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      setText(container, "");
      mountChildren(nextChildren, container, parentComponent, appProvides);
      return;
    }

    if (oldShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      patchArrayChildren(
        oldChildren as VNode[],
        nextChildren,
        container,
        parentComponent,
        appProvides,
      );
      return;
    }

    mountChildren(nextChildren, container, parentComponent, appProvides);
    return;
  }

  if (oldShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    unmountChildren(oldChildren as VNode[]);
  } else if (oldShapeFlag & ShapeFlags.TEXT_CHILDREN) {
    setText(container, "");
  }
}

function patchArrayChildren(
  oldChildren: VNode[],
  newChildren: VNode[],
  container: Node,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): void {
  if (hasUniqueKeys(oldChildren) && hasUniqueKeys(newChildren)) {
    patchKeyedChildren(oldChildren, newChildren, container, parentComponent, appProvides);
    return;
  }

  patchUnkeyedChildren(oldChildren, newChildren, container, parentComponent, appProvides);
}

function patchUnkeyedChildren(
  oldChildren: VNode[],
  newChildren: VNode[],
  container: Node,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): void {
  const commonLength = Math.min(oldChildren.length, newChildren.length);

  for (let index = 0; index < commonLength; index += 1) {
    patch(oldChildren[index], newChildren[index], container, null, parentComponent, appProvides);
  }

  if (newChildren.length > oldChildren.length) {
    mountNewChildren(
      newChildren,
      commonLength,
      newChildren.length - 1,
      container,
      null,
      parentComponent,
      appProvides,
    );
    return;
  }

  unmountChildrenRange(oldChildren, commonLength, oldChildren.length - 1);
}

function patchKeyedChildren(
  oldChildren: VNode[],
  newChildren: VNode[],
  container: Node,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): void {
  let oldStart = 0;
  let newStart = 0;
  let oldEnd = oldChildren.length - 1;
  let newEnd = newChildren.length - 1;

  while (
    oldStart <= oldEnd &&
    newStart <= newEnd &&
    isSameVNodeType(oldChildren[oldStart], newChildren[newStart])
  ) {
    patch(
      oldChildren[oldStart],
      newChildren[newStart],
      container,
      null,
      parentComponent,
      appProvides,
    );
    oldStart += 1;
    newStart += 1;
  }

  while (
    oldStart <= oldEnd &&
    newStart <= newEnd &&
    isSameVNodeType(oldChildren[oldEnd], newChildren[newEnd])
  ) {
    patch(oldChildren[oldEnd], newChildren[newEnd], container, null, parentComponent, appProvides);
    oldEnd -= 1;
    newEnd -= 1;
  }

  if (oldStart > oldEnd) {
    const anchor = getAnchor(newChildren, newEnd + 1);
    mountNewChildren(
      newChildren,
      newStart,
      newEnd,
      container,
      anchor,
      parentComponent,
      appProvides,
    );
    return;
  }

  if (newStart > newEnd) {
    unmountChildrenRange(oldChildren, oldStart, oldEnd);
    return;
  }

  const oldKeyedChildren = new Map<string | number, KeyedChildRecord>();
  const newIndexToOldIndexMap = new Array<number>(newEnd - newStart + 1).fill(0);
  const usedOldChildren = new Set<VNode>();

  for (let index = oldStart; index <= oldEnd; index += 1) {
    const oldChild = oldChildren[index];
    if (oldChild.key !== null) {
      oldKeyedChildren.set(oldChild.key, {
        vnode: oldChild,
        index,
      });
    }
  }

  for (let index = newStart; index <= newEnd; index += 1) {
    const newChild = newChildren[index];
    const oldRecord = oldKeyedChildren.get(newChild.key as string | number) ?? null;

    if (oldRecord !== null) {
      usedOldChildren.add(oldRecord.vnode);
      newIndexToOldIndexMap[index - newStart] = oldRecord.index + 1;
      patch(oldRecord.vnode, newChild, container, null, parentComponent, appProvides);
    }
  }

  unmountUnusedKeyedChildren(oldChildren, oldStart, oldEnd, usedOldChildren);

  const stablePositions = getIncreasingSubsequence(newIndexToOldIndexMap);
  let stableIndex = stablePositions.length - 1;

  for (let index = newEnd; index >= newStart; index -= 1) {
    if (newIndexToOldIndexMap[index - newStart] === 0) {
      const runStart = getNewRunStart(newIndexToOldIndexMap, newStart, index);
      if (runStart < index && canBatchMountChildren(newChildren, runStart, index)) {
        mountNewChildren(
          newChildren,
          runStart,
          index,
          container,
          getAnchor(newChildren, index + 1),
          parentComponent,
          appProvides,
        );
        index = runStart;
        continue;
      }

      patch(
        null,
        newChildren[index],
        container,
        getAnchor(newChildren, index + 1),
        parentComponent,
        appProvides,
      );
      continue;
    }

    const childEl = newChildren[index].el;
    if (childEl === null) {
      continue;
    }

    if (stableIndex >= 0 && index - newStart === stablePositions[stableIndex]) {
      stableIndex -= 1;
      continue;
    }

    insert(childEl, container, getAnchor(newChildren, index + 1));
  }
}

function getNewRunStart(newIndexToOldIndexMap: number[], newStart: number, index: number): number {
  let start = index;

  while (start > newStart && newIndexToOldIndexMap[start - 1 - newStart] === 0) {
    start -= 1;
  }

  return start;
}

function unmountUnusedKeyedChildren(
  children: VNode[],
  start: number,
  end: number,
  usedChildren: Set<VNode>,
): void {
  let index = start;

  while (index <= end) {
    if (usedChildren.has(children[index])) {
      index += 1;
      continue;
    }

    const runStart = index;
    while (index <= end && !usedChildren.has(children[index])) {
      index += 1;
    }
    unmountChildrenRange(children, runStart, index - 1);
  }
}

function mountNewChildren(
  children: VNode[],
  start: number,
  end: number,
  container: Node,
  anchor: Node | null,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): void {
  if (canBatchMountChildren(children, start, end)) {
    const fragment = document.createDocumentFragment();
    for (let index = start; index <= end; index += 1) {
      patch(null, children[index], fragment, null, parentComponent, appProvides);
    }
    insert(fragment, container, anchor);
    return;
  }

  for (let index = start; index <= end; index += 1) {
    patch(null, children[index], container, anchor, parentComponent, appProvides);
  }
}

function canBatchMountChildren(children: VNode[], start: number, end: number): boolean {
  return start <= end;
}

function unmountChildrenRange(children: VNode[], start: number, end: number): void {
  if (canBatchRemoveChildren(children, start, end)) {
    const fragment = document.createDocumentFragment();
    for (let index = start; index <= end; index += 1) {
      fragment.appendChild(children[index].el as Node);
    }
    return;
  }

  for (let index = start; index <= end; index += 1) {
    unmount(children[index]);
  }
}

function canBatchRemoveChildren(children: VNode[], start: number, end: number): boolean {
  if (start > end || hasDevtoolsListeners()) {
    return false;
  }

  let parent: Node | null = null;

  for (let index = start; index <= end; index += 1) {
    const child = children[index];
    if (
      !(child.shapeFlag & ShapeFlags.ELEMENT) ||
      child.shapeFlag & ShapeFlags.ARRAY_CHILDREN ||
      child.el === null ||
      hasEventProps(child.props)
    ) {
      return false;
    }

    parent ??= child.el.parentNode;
    if (parent === null || child.el.parentNode !== parent) {
      return false;
    }
  }

  return true;
}

function hasEventProps(props: VNodeProps | null): boolean {
  if (props === null) {
    return false;
  }

  return Object.keys(props).some(isEventProp);
}

function getAnchor(children: VNode[], index: number): Node | null {
  return (children[index]?.el as Node | null | undefined) ?? null;
}

type KeyedChildRecord = {
  index: number;
  vnode: VNode;
};

function getIncreasingSubsequence(source: number[]): number[] {
  const predecessors = source.slice();
  const result: number[] = [];

  for (let index = 0; index < source.length; index += 1) {
    const value = source[index];
    if (value === 0) {
      continue;
    }

    const lastResultIndex = result[result.length - 1];
    if (result.length === 0 || source[lastResultIndex] < value) {
      if (result.length > 0) {
        predecessors[index] = lastResultIndex;
      }
      result.push(index);
      continue;
    }

    let start = 0;
    let end = result.length - 1;

    while (start < end) {
      const middle = Math.floor((start + end) / 2);
      if (source[result[middle]] < value) {
        start = middle + 1;
      } else {
        end = middle;
      }
    }

    if (value < source[result[start]]) {
      if (start > 0) {
        predecessors[index] = result[start - 1];
      }
      result[start] = index;
    }
  }

  if (result.length === 0) {
    return [];
  }

  let current = result[result.length - 1];
  for (let index = result.length - 1; index >= 0; index -= 1) {
    result[index] = current;
    current = predecessors[current];
  }

  return result;
}

function hasUniqueKeys(children: VNode[]): boolean {
  const keys = new Set<string | number>();

  for (const child of children) {
    if (child.key === null || keys.has(child.key)) {
      return false;
    }

    keys.add(child.key);
  }

  return children.length > 0;
}

function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key;
}

function unmountChildren(children: VNode[]): void {
  for (const child of children) {
    unmount(child);
  }
}

function unmount(vnode: VNode): void {
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

function getFragmentRoot(vnode: VNode): Element | Text | null {
  if (!(vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN)) {
    return null;
  }

  return ((vnode.children as VNode[])[0]?.el as Element | Text | null | undefined) ?? null;
}

function emitComponentDevtoolsEvent(
  type: "component:mount" | "component:update" | "component:unmount",
  instance: ComponentInstance,
): void {
  if (!hasDevtoolsListeners()) {
    return;
  }

  emitDevtoolsEvent({
    type,
    id: instance.devtoolsId,
    name: getComponentDevtoolsName(instance),
  });
}

function emitRendererElementDevtoolsEvent(
  operation: "mount" | "update" | "unmount",
  tag: string,
): void {
  if (!hasDevtoolsListeners()) {
    return;
  }

  emitDevtoolsEvent({
    type: "renderer:element",
    operation,
    tag,
  });
}
