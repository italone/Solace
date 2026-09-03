import { describe, expect, it } from "vitest";

// createVNode is not part of the public API; import the internal module directly.
import { createVNode } from "../../../src/vnode/vnode";
import { h } from "../../../src/index";

describe("flattenChildren allocation", () => {
  it("returns the same array reference when children are already flat", () => {
    const flat = [h("li"), h("li")];
    const vnode = createVNode("ul", null, flat);

    expect(vnode.children).toBe(flat);
  });

  it("still flattens nested arrays into a new flat array", () => {
    const nested = [[h("li", { key: 1 }), h("li", { key: 2 })], h("li", { key: 3 })] as never;
    const vnode = createVNode("ul", null, nested);

    expect(vnode.children).toEqual([h("li", { key: 1 }), h("li", { key: 2 }), h("li", { key: 3 })]);
    expect(vnode.children).not.toBe(nested);
  });
});
