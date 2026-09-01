import { describe, expect, it } from "vitest";

import { createStore, h, nextTick, render } from "../../../src/index";
import type { StoreGetterContext } from "../../../src/index";

type ListState = { items: string[] };

describe("deep reactive store state", () => {
  it("rerenders components that read nested array state after a raw push", async () => {
    const store = createStore({
      state: () => ({ items: [] as string[] }),
      actions: {
        add({ state }: StoreGetterContext<ListState>, item: string) {
          state.items.push(item);
        },
      },
    });
    const container = document.createElement("div");
    const List = () => () => h("p", null, `items: ${store.state.items.length}`);

    render(h(List), container);

    expect(container.innerHTML).toBe("<p>items: 0</p>");

    store.actions.add("first");

    await nextTick();

    expect(container.innerHTML).toBe("<p>items: 1</p>");
  });

  it("reflects raw nested pushes in getters", () => {
    const store = createStore({
      state: () => ({ items: [] as string[] }),
      actions: {
        add({ state }: StoreGetterContext<ListState>, item: string) {
          state.items.push(item);
        },
      },
      getters: {
        itemCount({ state }: StoreGetterContext<ListState>) {
          return state.items.length;
        },
      },
    });

    expect(store.getters.itemCount).toBe(0);

    store.actions.add("first");
    store.actions.add("second");

    expect(store.getters.itemCount).toBe(2);
  });
});
