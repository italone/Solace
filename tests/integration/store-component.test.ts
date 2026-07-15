import { describe, expect, it } from "vitest";

import { createStore, h, nextTick, render } from "../../src/index";
import type { StoreGetterContext } from "../../src/index";

type CounterState = { count: number };

describe("store and components", () => {
  it("rerenders components that read store state", async () => {
    const store = createStore({
      state: () => ({ count: 0 }),
      actions: {
        increment({ state }: StoreGetterContext<CounterState>) {
          state.count += 1;
        },
      },
      getters: {
        label({ state }: StoreGetterContext<CounterState>) {
          return `count: ${state.count}`;
        },
      },
    });
    const container = document.createElement("div");
    const Counter = () => () => h("button", null, store.getters.label);

    render(h(Counter), container);
    store.actions.increment();

    expect(container.innerHTML).toBe("<button>count: 0</button>");

    await nextTick();

    expect(container.innerHTML).toBe("<button>count: 1</button>");
  });

  it("rerenders components that read store state directly", async () => {
    const store = createStore({
      state: () => ({ count: 0 }),
      actions: {
        increment({ state }: StoreGetterContext<CounterState>) {
          state.count += 1;
        },
      },
    });
    const container = document.createElement("div");
    const Counter = () => () => h("button", null, `count: ${store.state.count}`);

    render(h(Counter), container);
    store.actions.increment();

    await nextTick();

    expect(container.innerHTML).toBe("<button>count: 1</button>");
  });
});
