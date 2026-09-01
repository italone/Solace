import { afterEach, describe, expect, it } from "vitest";

import { Fragment, h, render } from "../../../src/index";

describe("nested array children", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders nested arrays produced by jsx children mapping", () => {
    const rows = [1, 2];
    const container = document.createElement("div");
    document.body.appendChild(container);

    const node = h(
      "ul",
      null,
      // This mirrors JSX output where a mapped list is interleaved with
      // standalone children: [[li, li], li, [li, li]]
      [
        rows.map((n) => h("li", { key: n }, `left-${n}`)),
        h("li", { key: "mid" }, "mid"),
        rows.map((n) => h("li", { key: `right-${n}` }, `right-${n}`)),
      ] as never,
    );

    render(node, container);

    expect(container.innerHTML).toBe(
      "<ul><li>left-1</li><li>left-2</li><li>mid</li><li>right-1</li><li>right-2</li></ul>",
    );
  });

  it("renders nested arrays inside a Fragment", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const node = h(Fragment, null, [
      h("span", { key: "a" }, "a"),
      [h("span", { key: "b" }, "b"), h("span", { key: "c" }, "c")],
    ] as never);

    render(node, container);

    expect(container.innerHTML).toBe("<span>a</span><span>b</span><span>c</span>");
  });
});
