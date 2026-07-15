import { describe, expect, it, vi } from "vitest";

import { jsxDEV } from "../../../src/jsx-dev-runtime";
import { Fragment, jsx, jsxs } from "../../../src/jsx-runtime";
import { render } from "../../../src/index";

describe("jsx runtime", () => {
  it("maps jsx calls to element vnodes", () => {
    const container = document.createElement("div");
    const onClick = vi.fn();

    render(jsx("button", { id: "counter", onClick, children: "count: 0" }), container);
    container.querySelector("button")?.click();

    expect(container.innerHTML).toBe('<button id="counter">count: 0</button>');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("maps jsxs Fragment calls to unwrapped children", () => {
    const container = document.createElement("div");

    render(
      jsxs(Fragment, {
        children: [jsx("span", { children: "one" }), jsx("span", { children: "two" })],
      }),
      container,
    );

    expect(container.innerHTML).toBe("<span>one</span><span>two</span>");
  });

  it("normalizes primitive and empty JSX children", () => {
    const container = document.createElement("div");

    render(
      jsxs("div", {
        children: [0, false, null, undefined, " item"],
      }),
      container,
    );

    expect(container.innerHTML).toBe("<div>0 item</div>");
  });

  it("wraps mixed string children in spans for array rendering", () => {
    const container = document.createElement("div");

    render(
      jsxs("section", {
        children: ["before", jsx("strong", { children: "middle" }), "after"],
      }),
      container,
    );

    expect(container.innerHTML).toBe(
      "<section><span>before</span><strong>middle</strong><span>after</span></section>",
    );
  });

  it("maps jsxDEV calls to element vnodes", () => {
    const container = document.createElement("div");

    render(jsxDEV("p", { children: 42 }), container);

    expect(container.innerHTML).toBe("<p>42</p>");
  });
});
