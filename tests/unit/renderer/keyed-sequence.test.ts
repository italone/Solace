import { describe, expect, it } from "vitest";

import { getIncreasingSubsequence, hasUniqueKeys } from "../../../src/renderer/keyed-sequence";
import type { VNode } from "../../../src/vnode/vnode";

const children = (...keys: Array<string | number | null>) =>
  keys.map((key) => ({ key })) as VNode[];

describe("keyed sequence helpers", () => {
  it("returns no positions for empty or zero-only input", () => {
    expect(getIncreasingSubsequence([])).toEqual([]);
    expect(getIncreasingSubsequence([0, 0])).toEqual([]);
  });

  it("ignores zero placeholders while retaining sorted positions", () => {
    expect(getIncreasingSubsequence([0, 1, 2])).toEqual([1, 2]);
    expect(getIncreasingSubsequence([1, 2, 3])).toEqual([0, 1, 2]);
  });

  it("finds stable positions for reversed and mixed sequences", () => {
    expect(getIncreasingSubsequence([3, 2, 1])).toEqual([2]);
    expect(getIncreasingSubsequence([2, 0, 1, 3])).toEqual([2, 3]);
  });

  it("requires a non-empty list of unique non-null keys", () => {
    expect(hasUniqueKeys(children("a", "b"))).toBe(true);
    expect(hasUniqueKeys(children("a", "a"))).toBe(false);
    expect(hasUniqueKeys(children("a", null))).toBe(false);
    expect(hasUniqueKeys([])).toBe(false);
  });
});
