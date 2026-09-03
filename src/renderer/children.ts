import type { ComponentInstance } from "../component/component";
import type { Provides } from "../component/provide";
import { hasDevtoolsListeners } from "../devtools/events";
import { ShapeFlags } from "../shared/flags";
import type { VNode } from "../vnode/vnode";
import { insert, setText } from "./dom";
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
import { hasEventProps } from "./props";
import { unmount, unmountChildren } from "./unmount";

type PatchFunction = (
  n1: VNode | null,
  n2: VNode,
  container: Node,
  anchor: Node | null,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
) => void;

export function patchChildren(
  n1: VNode,
  n2: VNode,
  container: Node,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  patch: PatchFunction,
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
      mountChildren(nextChildren, container, parentComponent, appProvides, patch);
      return;
    }

    if (oldShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      patchArrayChildren(
        oldChildren as VNode[],
        nextChildren,
        container,
        parentComponent,
        appProvides,
        patch,
      );
      return;
    }

    mountChildren(nextChildren, container, parentComponent, appProvides, patch);
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
  patch: PatchFunction,
): void {
  if (hasUniqueKeys(oldChildren) && hasUniqueKeys(newChildren)) {
    patchKeyedChildren(oldChildren, newChildren, container, parentComponent, appProvides, patch);
    return;
  }

  patchUnkeyedChildren(oldChildren, newChildren, container, parentComponent, appProvides, patch);
}

function patchUnkeyedChildren(
  oldChildren: VNode[],
  newChildren: VNode[],
  container: Node,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  patch: PatchFunction,
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
      patch,
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
  patch: PatchFunction,
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
      patch,
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

  let anyNewChildKeyed = false;
  for (let index = newStart; index <= newEnd; index += 1) {
    if (newChildren[index].key !== null) {
      anyNewChildKeyed = true;
      break;
    }
  }

  // No keyed new child can ever match an entry in the map, so a fully-unkeyed
  // middle segment skips the old-children scan entirely; every lookup in that
  // case yields oldRecord null (all new children mount, all old unmount),
  // which is identical to querying an empty map.
  const oldKeyedChildren = anyNewChildKeyed ? new Map<string | number, KeyedChildRecord>() : null;
  const newIndexToOldIndexMap = new Array<number>(newEnd - newStart + 1).fill(0);
  let matchedOldCount = 0;

  if (oldKeyedChildren !== null) {
    for (let index = oldStart; index <= oldEnd; index += 1) {
      const oldChild = oldChildren[index];
      if (oldChild.key !== null) {
        oldKeyedChildren.set(oldChild.key, {
          vnode: oldChild,
          index,
        });
      }
    }
  }

  for (let index = newStart; index <= newEnd; index += 1) {
    const newChild = newChildren[index];
    const oldRecord =
      (oldKeyedChildren?.get(newChild.key as string | number) as KeyedChildRecord | undefined) ??
      null;

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
          patch,
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
  patch: PatchFunction,
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

export function canBatchMountChildren(children: VNode[], start: number, end: number): boolean {
  return start <= end;
}

export function mountChildren(
  children: VNode[],
  container: Node,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  patch: PatchFunction,
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

export function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key;
}
