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
import { ReactiveEffect } from "../reactivity/effect";
import { queueJob } from "../scheduler/scheduler";
import { ShapeFlags } from "../shared/flags";
import { isThenable } from "../shared/utils";
import type { VNode } from "../vnode/vnode";
import { createElement, insert, setText } from "./dom";
import {
  isKeyedReorderMovePathInstrumentationEnabled,
  recordKeyedReorderLisLength,
  recordKeyedReorderMatchedOldChild,
  recordKeyedReorderMiddleSegment,
  recordKeyedReorderMountedChildren,
  recordKeyedReorderMovedExistingBatch,
  recordKeyedReorderMovedExistingChild,
  recordKeyedReorderRemovedOldChildren,
  recordKeyedReorderStableMoveSkip,
} from "./keyed-reorder-instrumentation";
import { getIncreasingSubsequence, hasUniqueKeys } from "./keyed-sequence";
import { hasEventProps, havePropsChanged, mountInitialProps, patchProps } from "./props";
import { getFragmentRoot, unmount, unmountChildren } from "./unmount";

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

  const shouldRecordMovePath = isKeyedReorderMovePathInstrumentationEnabled();
  if (shouldRecordMovePath) {
    recordKeyedReorderMiddleSegment();
  }

  const oldKeyedChildren = new Map<string | number, KeyedChildRecord>();
  const newIndexToOldIndexMap = new Array<number>(newEnd - newStart + 1).fill(0);
  let matchedOldCount = 0;

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
      matchedOldCount += 1;
      if (shouldRecordMovePath) {
        recordKeyedReorderMatchedOldChild();
      }
      newIndexToOldIndexMap[index - newStart] = oldRecord.index + 1;
      patch(oldRecord.vnode, newChild, container, null, parentComponent, appProvides);
    }
  }

  if (matchedOldCount < oldEnd - oldStart + 1) {
    if (shouldRecordMovePath) {
      recordKeyedReorderRemovedOldChildren(oldEnd - oldStart + 1 - matchedOldCount);
    }
    unmountUnusedKeyedChildren(oldChildren, oldStart, oldEnd, newIndexToOldIndexMap);
  }

  const stablePositions = getIncreasingSubsequence(newIndexToOldIndexMap);
  if (shouldRecordMovePath) {
    recordKeyedReorderLisLength(stablePositions.length);
  }
  const stableSet = new Array<boolean>(newEnd - newStart + 1).fill(false);
  for (const position of stablePositions) {
    stableSet[position] = true;
  }

  let anchorNode = getAnchor(newChildren, newEnd + 1);
  const movedExistingBatch: Node[] = [];

  function flushMovedExistingBatch(): void {
    if (movedExistingBatch.length === 0) {
      return;
    }

    if (movedExistingBatch.length === 1) {
      const [node] = movedExistingBatch;
      insert(node, container, anchorNode);
      anchorNode = node;
      movedExistingBatch.length = 0;
      return;
    }

    if (shouldRecordMovePath) {
      recordKeyedReorderMovedExistingBatch();
    }

    const fragment = document.createDocumentFragment();
    for (const node of movedExistingBatch) {
      fragment.appendChild(node);
    }
    insert(fragment, container, anchorNode);
    anchorNode = movedExistingBatch[0];
    movedExistingBatch.length = 0;
  }

  for (let index = newEnd; index >= newStart; index -= 1) {
    if (newIndexToOldIndexMap[index - newStart] === 0) {
      flushMovedExistingBatch();
      const runStart = getNewRunStart(newIndexToOldIndexMap, newStart, index);
      if (runStart < index && canBatchMountChildren(newChildren, runStart, index)) {
        if (shouldRecordMovePath) {
          recordKeyedReorderMountedChildren(index - runStart + 1);
        }
        mountNewChildren(
          newChildren,
          runStart,
          index,
          container,
          anchorNode,
          parentComponent,
          appProvides,
        );
        anchorNode = newChildren[runStart].el ?? anchorNode;
        index = runStart;
        continue;
      }

      if (shouldRecordMovePath) {
        recordKeyedReorderMountedChildren(1);
      }
      patch(null, newChildren[index], container, anchorNode, parentComponent, appProvides);
      anchorNode = newChildren[index].el ?? anchorNode;
      continue;
    }

    const childEl = newChildren[index].el;
    if (childEl === null) {
      flushMovedExistingBatch();
      continue;
    }

    if (stableSet[index - newStart]) {
      flushMovedExistingBatch();
      if (shouldRecordMovePath) {
        recordKeyedReorderStableMoveSkip();
      }
      anchorNode = childEl;
      continue;
    }

    if (shouldRecordMovePath) {
      recordKeyedReorderMovedExistingChild();
    }
    movedExistingBatch.unshift(childEl);
  }

  flushMovedExistingBatch();
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
  newIndexToOldIndexMap: number[],
): void {
  const usedOldIndexes = new Array<boolean>(end - start + 1).fill(false);

  for (const mappedOldIndex of newIndexToOldIndexMap) {
    if (mappedOldIndex > 0) {
      usedOldIndexes[mappedOldIndex - 1 - start] = true;
    }
  }

  let index = start;

  while (index <= end) {
    if (usedOldIndexes[index - start]) {
      index += 1;
      continue;
    }

    const runStart = index;
    while (index <= end && !usedOldIndexes[index - start]) {
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

function getAnchor(children: VNode[], index: number): Node | null {
  return (children[index]?.el as Node | null | undefined) ?? null;
}

type KeyedChildRecord = {
  index: number;
  vnode: VNode;
};

function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key;
}

export function emitComponentDevtoolsEvent(
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

export function emitRendererElementDevtoolsEvent(
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
