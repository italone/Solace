import { describe, expect, it, vi } from "vitest";

import { h, nextTick, reactive, render } from "../../src/index";

describe("batched render", () => {
  it("updates the DOM once for multiple state mutations in the same tick", async () => {
    const state = reactive({ count: 0 });
    const container = document.createElement("div");
    const view = vi.fn(() => h("button", { "data-count": state.count }, String(state.count)));

    render(view, container);

    const initialButton = container.querySelector("button");

    expect(container.innerHTML).toBe('<button data-count="0">0</button>');
    expect(view).toHaveBeenCalledTimes(1);

    state.count = 1;
    state.count = 2;

    expect(container.innerHTML).toBe('<button data-count="0">0</button>');

    await nextTick();

    const updatedButton = container.querySelector("button");

    expect(container.innerHTML).toBe('<button data-count="2">2</button>');
    expect(view).toHaveBeenCalledTimes(2);
    expect(updatedButton).toBe(initialButton);
  });

  it("stops the previous render effect when replacing a function render source", async () => {
    const first = reactive({ count: 0 });
    const second = reactive({ count: 10 });
    const container = document.createElement("div");

    render(() => h("p", null, String(first.count)), container);
    render(() => h("p", null, String(second.count)), container);

    expect(container.innerHTML).toBe("<p>10</p>");

    first.count = 1;
    second.count = 11;

    await nextTick();

    expect(container.innerHTML).toBe("<p>11</p>");
  });

  it("skips a queued stale render effect after replacing the function source", async () => {
    const first = reactive({ count: 0 });
    const second = reactive({ count: 10 });
    const container = document.createElement("div");
    const firstView = vi.fn(() => h("p", null, String(first.count)));

    render(firstView, container);
    first.count = 1;
    render(() => h("p", null, String(second.count)), container);

    await nextTick();

    expect(firstView).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe("<p>10</p>");
  });

  it("clears previous function-rendered DOM when rendering a static vnode", async () => {
    const state = reactive({ count: 0 });
    const container = document.createElement("div");

    render(() => h("p", null, String(state.count)), container);
    render(h("span", null, "static"), container);

    state.count = 1;
    await nextTick();

    expect(container.innerHTML).toBe("<span>static</span>");
  });
});
