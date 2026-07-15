import { describe, expect, it, vi } from "vitest";

import { removeEvents } from "../../../src/event/event";
import { h, render } from "../../../src/index";
import { patchProp } from "../../../src/renderer/dom";

describe("DOM events", () => {
  it("binds onClick and dispatches DOM events", () => {
    const container = document.createElement("div");
    const onClick = vi.fn();

    render(h("button", { onClick }, "click"), container);
    container.querySelector("button")?.click();

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("uses the latest event handler after patch", () => {
    const container = document.createElement("div");
    const oldHandler = vi.fn();
    const newHandler = vi.fn();

    render(h("button", { onClick: oldHandler }, "click"), container);
    render(h("button", { onClick: newHandler }, "click"), container);

    container.querySelector("button")?.click();

    expect(oldHandler).not.toHaveBeenCalled();
    expect(newHandler).toHaveBeenCalledTimes(1);
  });

  it("removes event handlers when the prop is removed", () => {
    const container = document.createElement("div");
    const onClick = vi.fn();

    render(h("button", { onClick }, "click"), container);
    render(h("button", null, "click"), container);

    container.querySelector("button")?.click();

    expect(onClick).not.toHaveBeenCalled();
  });

  it("removes event handlers when the element is unmounted", () => {
    const container = document.createElement("div");
    const onClick = vi.fn();

    render(h("button", { onClick }, "click"), container);
    const button = container.querySelector("button");
    render(h("span", null, "gone"), container);

    button?.click();

    expect(onClick).not.toHaveBeenCalled();
  });

  it("caches event invokers when handlers change", () => {
    const button = document.createElement("button");
    const addEventListener = vi.spyOn(button, "addEventListener");
    const removeEventListener = vi.spyOn(button, "removeEventListener");
    const oldHandler = vi.fn();
    const newHandler = vi.fn();

    patchProp(button, "onClick", null, oldHandler);
    patchProp(button, "onClick", oldHandler, newHandler);
    button.click();

    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(removeEventListener).not.toHaveBeenCalled();
    expect(oldHandler).not.toHaveBeenCalled();
    expect(newHandler).toHaveBeenCalledTimes(1);
  });

  it("does nothing when clearing events on an element without invokers", () => {
    const button = document.createElement("button");

    removeEvents(button);

    expect(button.outerHTML).toBe("<button></button>");
  });
});
