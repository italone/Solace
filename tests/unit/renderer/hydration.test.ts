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
  function captureHydrationError(fn: () => void): SolaceHydrationError {
    try {
      fn();
    } catch (error) {
      expect(error).toBeInstanceOf(SolaceHydrationError);
      return error as SolaceHydrationError;
    }

    throw new Error("Expected hydration to throw");
  }

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
    const error = captureHydrationError(() => hydrate(h("button", null, "server"), container));

    expect(error.message).toMatch(/path root: expected <button> but found <span>/i);
    expect(error).toMatchObject({
      kind: "element-tag-mismatch",
      path: "root",
      expected: "<button>",
      actual: "<span>",
    });
  });

  it("throws on text mismatches", () => {
    const container = document.createElement("div");
    container.innerHTML = "<button>server</button>";
    const error = captureHydrationError(() => hydrate(h("button", null, "client"), container));

    expect(error.message).toMatch(/path root\/button: expected text "client" but found "server"/i);
    expect(error).toMatchObject({
      kind: "text-mismatch",
      path: "root/button",
      expected: 'text "client"',
      actual: 'text "server"',
    });
  });

  it("recovers from structural mismatches when recovery is enabled", () => {
    const container = document.createElement("div");
    container.innerHTML = "<span>server</span>";
    const serverNode = container.firstChild;
    const onClick = vi.fn();

    hydrate(h("button", { onClick }, "client"), container, null, { recover: true });

    const button = container.querySelector("button");
    expect(container.firstChild).not.toBe(serverNode);
    expect(container.innerHTML).toBe("<button>client</button>");
    button?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps reactive updates working after recovery", async () => {
    const count = ref(0);
    const container = document.createElement("div");
    container.innerHTML = "<span>server</span>";
    const App = () => h("button", { onClick: () => count.value++ }, `count: ${count.value}`);

    hydrate(App, container, null, { recover: true });
    container.querySelector("button")?.click();
    await nextTick();

    expect(container.innerHTML).toBe("<button>count: 1</button>");
  });

  it("does not recover from non-hydration errors", () => {
    const container = document.createElement("div");
    container.innerHTML = "<button>server</button>";
    const App = () => {
      throw new Error("setup failed");
    };

    expect(() => hydrate(App, container, null, { recover: true })).toThrow("setup failed");
  });

  it("cleans up root hydration effects after unrecovered mismatches", async () => {
    const count = ref(0);
    const container = document.createElement("div");
    container.innerHTML = "<span>server</span>";
    const App = () => h("button", null, `count: ${count.value}`);

    expect(() => hydrate(App, container)).toThrow(SolaceHydrationError);
    expect((container as { _solaceRenderEffect?: unknown })._solaceRenderEffect).toBeUndefined();

    count.value = 1;
    await nextTick();

    expect(container.innerHTML).toBe("<span>server</span>");
  });

  it("rejects deferred hydration integration options at runtime", () => {
    const container = document.createElement("div");
    container.innerHTML = "<button>server</button>";

    expect(() =>
      hydrate(h("button", null, "server"), container, null, { manifest: {} } as never),
    ).toThrow(/Hydration manifest integration is deferred/);

    expect(() =>
      hydrate(h("button", null, "server"), container, null, {
        clientEntry: "/src/main.ts",
      } as never),
    ).toThrow(/Hydration manifest integration is deferred/);

    expect(() =>
      hydrate(h("button", null, "server"), container, null, { router: {} } as never),
    ).toThrow(/Router-aware hydration integration is deferred/);
  });

  it("reports nested mismatch paths during hydration", () => {
    const container = document.createElement("div");
    container.innerHTML = "<section><span>server</span></section>";

    expect(() => hydrate(h("section", null, [h("button", null, "server")]), container)).toThrow(
      /path root\/section\[0\]: expected <button> but found <span>/i,
    );
  });

  it("reports missing child nodes during hydration", () => {
    const container = document.createElement("div");
    container.innerHTML = "<ul><li>one</li></ul>";
    const error = captureHydrationError(() =>
      hydrate(h("ul", null, [h("li", null, "one"), h("li", null, "two")]), container),
    );

    expect(error).toMatchObject({
      kind: "missing-node",
      path: "root/ul[1]",
      expected: "<li>",
      actual: "null",
    });
    expect(error.message).toMatch(/path root\/ul\[1\]: missing DOM node for <li>/i);
  });

  it("reports extra child and root nodes during hydration", () => {
    const childContainer = document.createElement("div");
    childContainer.innerHTML = "<ul><li>one</li><li>extra</li></ul>";
    const childError = captureHydrationError(() =>
      hydrate(h("ul", null, [h("li", null, "one")]), childContainer),
    );

    expect(childError).toMatchObject({
      kind: "extra-node",
      path: "root/ul[1]",
      expected: "no DOM node",
      actual: "<li>",
    });

    const rootContainer = document.createElement("div");
    rootContainer.innerHTML = "<p>one</p><p>extra</p>";
    const rootError = captureHydrationError(() => hydrate(h("p", null, "one"), rootContainer));

    expect(rootError).toMatchObject({
      kind: "extra-node",
      path: "root[1]",
      expected: "no DOM node",
      actual: "<p>",
    });
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
