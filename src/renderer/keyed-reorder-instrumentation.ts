export type KeyedReorderMovePathCounts = {
  keyedMiddleSegments: number;
  matchedOldChildren: number;
  newChildrenMounted: number;
  removedOldChildren: number;
  lisLength: number;
  stableMoveSkips: number;
  movedExistingChildren: number;
  anchorLookups: number;
};

export function createEmptyKeyedReorderMovePathCounts(): KeyedReorderMovePathCounts {
  return {
    keyedMiddleSegments: 0,
    matchedOldChildren: 0,
    newChildrenMounted: 0,
    removedOldChildren: 0,
    lisLength: 0,
    stableMoveSkips: 0,
    movedExistingChildren: 0,
    anchorLookups: 0,
  };
}

let enabled = false;
let counts = createEmptyKeyedReorderMovePathCounts();

export function enableKeyedReorderMovePathInstrumentation(): void {
  counts = createEmptyKeyedReorderMovePathCounts();
  enabled = true;
}

export function disableKeyedReorderMovePathInstrumentation(): void {
  enabled = false;
}

export function resetKeyedReorderMovePathCounts(): void {
  counts = createEmptyKeyedReorderMovePathCounts();
}

export function isKeyedReorderMovePathInstrumentationEnabled(): boolean {
  return enabled;
}

export function getKeyedReorderMovePathCounts(): KeyedReorderMovePathCounts {
  return { ...counts };
}

export function recordKeyedReorderMiddleSegment(): void {
  counts.keyedMiddleSegments += 1;
}

export function recordKeyedReorderMatchedOldChild(): void {
  counts.matchedOldChildren += 1;
}

export function recordKeyedReorderMountedChildren(amount: number): void {
  counts.newChildrenMounted += amount;
}

export function recordKeyedReorderRemovedOldChildren(amount: number): void {
  counts.removedOldChildren += amount;
}

export function recordKeyedReorderLisLength(amount: number): void {
  counts.lisLength += amount;
}

export function recordKeyedReorderStableMoveSkip(): void {
  counts.stableMoveSkips += 1;
}

export function recordKeyedReorderMovedExistingChild(): void {
  counts.movedExistingChildren += 1;
}

export function recordKeyedReorderAnchorLookup(): void {
  counts.anchorLookups += 1;
}
