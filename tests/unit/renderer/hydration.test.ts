import { describe, expect, it, vi } from "vitest";

import { h, nextTick, ref } from "../../../src";
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
});
