import { describe, expect, it } from "vitest";

import { createApp, h, render } from "../../../src/index";
import type { AsyncComponentType } from "../../../src/index";
import { ShapeFlags } from "../../../src/shared/flags";

describe("vnode and render", () => {
  it("creates an element VNode with text children", () => {
    const vnode = h("div", null, "hello");

    expect(vnode.type).toBe("div");
    expect(vnode.props).toBeNull();
    expect(vnode.children).toBe("hello");
    expect(vnode.shapeFlag & ShapeFlags.ELEMENT).toBeTruthy();
    expect(vnode.shapeFlag & ShapeFlags.TEXT_CHILDREN).toBeTruthy();
  });

  it("inserts an element VNode into the container", () => {
    const container = document.createElement("div");

    render(h("div", null, "hello"), container);

    expect(container.innerHTML).toBe("<div>hello</div>");
  });

  it("mounts array children in order", () => {
    const container = document.createElement("div");

    render(h("div", null, [h("span", null, "first"), h("span", null, "second")]), container);

    expect(container.innerHTML).toBe("<div><span>first</span><span>second</span></div>");
  });

  it("normalizes a single vnode child to array children", () => {
    const container = document.createElement("div");

    render(h("div", null, h("span", null, "child")), container);

    expect(container.innerHTML).toBe("<div><span>child</span></div>");
  });

  it("rejects async component results in synchronous client rendering", () => {
    const container = document.createElement("div");
    const AsyncApp: AsyncComponentType = async () => () => h("p", null, "async");

    expect(() => render(h(AsyncApp), container)).toThrow(
      TypeError(
        "Async client rendering is deferred; render() and mount() require synchronous trees.",
      ),
    );
    expect(() => createApp(AsyncApp).mount(container)).toThrow(
      /Async client rendering is deferred/,
    );
  });

  it("rejects promised children in synchronous client rendering", () => {
    const container = document.createElement("div");

    expect(() => render(h("div", null, Promise.resolve(h("span"))), container)).toThrow(
      TypeError(
        "Async client rendering is deferred; render() and mount() require synchronous trees.",
      ),
    );
  });
});
