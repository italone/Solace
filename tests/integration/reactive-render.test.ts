import { describe, expect, it, vi } from "vitest";

import { h, nextTick, reactive, render } from "../../src/index";

describe("reactive render diff", () => {
  it("patches the previous vnode when reactive state changes", async () => {
    const state = reactive({ count: 0, label: "idle" });
    const container = document.createElement("div");
    const view = vi.fn(() =>
      h("button", { "data-count": state.count }, `${state.label}:${state.count}`),
    );

    render(view, container);
    const button = container.querySelector("button");

    state.count = 1;
    state.label = "ready";

    await nextTick();

    const patchedButton = container.querySelector("button");

    expect(view).toHaveBeenCalledTimes(2);
    expect(patchedButton).toBe(button);
    expect(container.innerHTML).toBe('<button data-count="1">ready:1</button>');
  });
});
