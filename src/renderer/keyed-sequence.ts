import type { VNode } from "../vnode/vnode";

export function getIncreasingSubsequence(source: number[]): number[] {
  const predecessors = source.slice();
  const result: number[] = [];

  for (let index = 0; index < source.length; index += 1) {
    const value = source[index];
    if (value === 0) continue;

    const lastResultIndex = result[result.length - 1];
    if (result.length === 0 || source[lastResultIndex] < value) {
      if (result.length > 0) predecessors[index] = lastResultIndex;
      result.push(index);
      continue;
    }

    let start = 0;
    let end = result.length - 1;
    while (start < end) {
      const middle = Math.floor((start + end) / 2);
      if (source[result[middle]] < value) start = middle + 1;
      else end = middle;
    }

    if (value < source[result[start]]) {
      if (start > 0) predecessors[index] = result[start - 1];
      result[start] = index;
    }
  }

  if (result.length === 0) return [];
  let current = result[result.length - 1];
  for (let index = result.length - 1; index >= 0; index -= 1) {
    result[index] = current;
    current = predecessors[current];
  }
  return result;
}

export function hasUniqueKeys(children: VNode[]): boolean {
  const keys = new Set<string | number>();
  for (const child of children) {
    if (child.key === null || keys.has(child.key)) return false;
    keys.add(child.key);
  }
  return children.length > 0;
}
