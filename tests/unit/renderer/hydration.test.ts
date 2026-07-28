import { describe, expect, it, vi } from "vitest";

import {
  Fragment,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  onUpdated,
  reactive,
  ref,
  render,
} from "../../../src";
import { hydrate, SolaceHydrationError } from "../../../src/renderer/renderer";

describe("hydrate", () => {
  it("attaches events to existing DOM and preserves the original element", () => {
    const container = document.createElement("div");
    container.innerHTML = "<button>count: 0</button>";
    const button = container.querySelector("button");
    const onClick = vi.fn();

    hydrate(h("button", { onClick }, "count: 0"), container);

    expect(container.querySelector("button")).toBe(button);
    button?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("throws on structural mismatches", () => {
    const container = document.createElement("div");
    container.innerHTML = "<span>server</span>";

    expect(() => hydrate(h("button", null, "server"), container)).toThrow(SolaceHydrationError);
    expect(() => hydrate(h("button", null, "server"), container)).toThrow(
      /path root: expected <button> but found <span>/i,
    );
  });

  it("throws on text mismatches", () => {
    const container = document.createElement("div");
    container.innerHTML = "<button>server</button>";

    expect(() => hydrate(h("button", null, "client"), container)).toThrow(SolaceHydrationError);
    expect(() => hydrate(h("button", null, "client"), container)).toThrow(
      /path root\/button: expected text "client" but found "server"/i,
    );
  });

  it("reports nested mismatch paths during hydration", () => {
    const container = document.createElement("div");
    container.innerHTML = "<section><span>server</span></section>";

    expect(() => hydrate(h("section", null, [h("button", null, "server")]), container)).toThrow(
      /path root\/section\[0\]: expected <button> but found <span>/i,
    );
  });

  it("does not patch non-event props during the first component hydration pass", () => {
    const container = document.createElement("div");
    container.innerHTML = '<button data-server="yes">count: 0</button>';
    const button = container.querySelector("button");
    const onClick = vi.fn();
    let dataServer = "no";
    const App = () => {
      const renderedDataServer = dataServer;
      dataServer = "later";

      return h("button", { "data-server": renderedDataServer, onClick }, "count: 0");
    };

    hydrate(App, container);

    expect(container.querySelector("button")).toBe(button);
    expect(button?.getAttribute("data-server")).toBe("yes");
    button?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("patches normally after a hydrated reactive update", async () => {
    const count = ref(0);
    const container = document.createElement("div");
    container.innerHTML = "<button>count: 0</button>";
    const App = () => h("button", { onClick: () => count.value++ }, `count: ${count.value}`);

    hydrate(App, container);
    container.querySelector("button")?.click();
    await nextTick();

    expect(container.innerHTML).toBe("<button>count: 1</button>");
  });

  it("hydrates array children and fragments", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>first</p><button>second</button>";
    const first = container.querySelector("p");
    const second = container.querySelector("button");
    const onClick = vi.fn();

    hydrate(
      h(Fragment, null, [h("p", null, "first"), h("button", { onClick }, "second")]),
      container,
    );

    expect(container.querySelector("p")).toBe(first);
    expect(container.querySelector("button")).toBe(second);
    second?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call lifecycle hooks during hydration or hydrated updates", async () => {
    const state = reactive({ active: true });
    const calls: string[] = [];
    const container = document.createElement("div");
    container.innerHTML = "<div><button>child</button></div>";
    const Child = () => {
      onMounted(() => calls.push("mounted"));
      onUpdated(() => calls.push("updated"));
      onUnmounted(() => calls.push("unmounted"));

      return () => h("button", null, "child");
    };
    const App = () => {
      onMounted(() => calls.push("mounted"));
      onUpdated(() => calls.push("updated"));
      onUnmounted(() => calls.push("unmounted"));

      return () =>
        h("div", { onClick: () => (state.active = false) }, state.active ? h(Child) : null);
    };

    hydrate(App, container);
    container.querySelector("div")?.click();
    await nextTick();

    expect(calls).toEqual([]);
  });

  it("preserves render function source behavior separately from hydration component sources", async () => {
    const state = reactive({ count: 0 });
    const container = document.createElement("div");
    const view = vi.fn(() => h("button", null, `count: ${state.count}`));

    render(view, container);
    const button = container.querySelector("button");
    state.count = 1;
    await nextTick();

    expect(view).toHaveBeenCalledTimes(2);
    expect(container.querySelector("button")).toBe(button);
    expect(container.innerHTML).toBe("<button>count: 1</button>");
  });
});
