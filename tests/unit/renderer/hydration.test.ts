import { describe, expect, it, vi } from "vitest";

import {
  Fragment,
  defineAsyncComponent,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  onUpdated,
  reactive,
  ref,
  render,
  useStyle,
} from "../../../src";
import type { AsyncComponentType } from "../../../src";
import { hydrate, hydrateAsync, SolaceHydrationError } from "../../../src/renderer/renderer";

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

  it("stops hydrated child updates when a later root mismatch fails", async () => {
    const count = ref(0);
    const container = document.createElement("div");
    container.innerHTML = "<button>count: 0</button><p>extra</p>";
    const App = () => h("button", null, `count: ${count.value}`);

    expect(() => hydrate(App, container)).toThrow(SolaceHydrationError);

    count.value = 1;
    await nextTick();

    expect(container.innerHTML).toBe("<button>count: 0</button><p>extra</p>");
  });

  it("rejects deferred hydration integration options at runtime", () => {
    const container = document.createElement("div");
    container.innerHTML = "<button>server</button>";

    for (const options of [null, [], "options"]) {
      expect(() => hydrate(h("button", null, "server"), container, null, options as never)).toThrow(
        TypeError("Hydration options must be an object"),
      );
    }

    expect(() =>
      hydrate(h("button", null, "server"), container, null, { recover: "yes" } as never),
    ).toThrow(TypeError("Hydration recover option must be a boolean"));

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
    ).toThrow(TypeError("Hydration router option must be a Router instance"));

    expect(() =>
      hydrate(h("button", null, "server"), container, null, { stream: true } as never),
    ).toThrow(/Hydration streaming integration is deferred/);
  });

  it("rejects unknown hydration options at runtime", () => {
    const container = document.createElement("div");
    container.innerHTML = "<button>server</button>";

    expect(() =>
      hydrate(h("button", null, "server"), container, null, { recvoer: true } as never),
    ).toThrow(TypeError("Unknown hydration option: recvoer"));
  });

  it("rejects async hydration sources instead of entering the hydration pipeline", () => {
    const container = document.createElement("div");
    container.innerHTML = "<button>server</button>";

    expect(() => hydrate(Promise.resolve(h("button", null, "server")) as never, container)).toThrow(
      /Async hydration is deferred/,
    );
    expect((container as { _solaceRenderEffect?: unknown })._solaceRenderEffect).toBeUndefined();
  });

  it("rejects async hydration component trees instead of claiming server DOM", () => {
    const asyncSources = [
      async () => h("button", null, "client"),
      () => async () => h("button", null, "client"),
    ];

    for (const AsyncApp of asyncSources) {
      const container = document.createElement("div");
      container.innerHTML = "<button>server</button>";

      expect(() => hydrate(AsyncApp as never, container)).toThrow(/Async hydration is deferred/);
      expect((container as { _solaceRenderEffect?: unknown })._solaceRenderEffect).toBeUndefined();
      expect(container.innerHTML).toBe("<button>server</button>");
    }
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

describe("hydrateAsync", () => {
  it("validates the container before evaluating the async source", async () => {
    let setupCalls = 0;
    const sourceFailure = new Error("source should not run");
    const AsyncApp: AsyncComponentType = async () => {
      setupCalls += 1;
      throw sourceFailure;
    };

    await expect(hydrateAsync(h(AsyncApp), {} as Element)).rejects.toThrow(
      TypeError("Hydration container must be an Element"),
    );
    expect(setupCalls).toBe(0);
  });

  it("keeps a nested async component mounted across parent updates", async () => {
    const parentVersion = ref(0);
    let loadedSetups = 0;
    const Loaded = () => {
      loadedSetups += 1;
      return () => h("button", null, "loaded");
    };
    const AsyncChild = defineAsyncComponent(() => Promise.resolve(Loaded));
    const Parent = () => () =>
      h("section", null, [h("span", null, `parent: ${parentVersion.value}`), h(AsyncChild)]);
    const container = document.createElement("div");
    container.innerHTML = "<section><span>parent: 0</span><button>loaded</button></section>";

    await hydrateAsync(h(Parent), container);
    const button = container.querySelector("button");
    expect(loadedSetups).toBe(1);

    parentVersion.value += 1;
    await nextTick();

    expect(container.querySelector("span")?.textContent).toBe("parent: 1");
    expect(container.querySelector("button")).toBe(button);
    expect(loadedSetups).toBe(1);
  });

  it("recovers a prepared async tree and keeps reactive updates working", async () => {
    const count = ref(0);
    const AsyncApp: AsyncComponentType = async () => () =>
      h("button", { onClick: () => count.value++ }, `count: ${count.value}`);
    const container = document.createElement("div");
    container.innerHTML = "<span>server mismatch</span>";

    await hydrateAsync(h(AsyncApp), container, null, { recover: true });
    container.querySelector("button")?.click();
    await nextTick();

    expect(container.innerHTML).toBe("<button>count: 1</button>");
  });

  it("commits prepared styles through the document style sink", async () => {
    const isolatedDocument = document.implementation.createHTMLDocument("async hydration");
    const container = isolatedDocument.createElement("div");
    container.innerHTML = '<p class="async-style">styled</p>';
    isolatedDocument.body.appendChild(container);
    const AsyncApp: AsyncComponentType = async () => {
      useStyle("async-style", ".async-style { color: blue; }");
      await Promise.resolve();
      return () => h("p", { class: "async-style" }, "styled");
    };

    await hydrateAsync(h(AsyncApp), container);

    expect(isolatedDocument.head.querySelectorAll('style[data-s-id="async-style"]')).toHaveLength(
      1,
    );
    expect(isolatedDocument.head.textContent).toContain(".async-style { color: blue; }");
  });
});
