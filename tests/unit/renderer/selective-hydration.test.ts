import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import { createApp } from "../../../src/app";

describe("hydration comment tolerance", () => {
  it("skips non-boundary comment nodes during the walk", async () => {
    const container = document.createElement("div");
    container.innerHTML = "<!--so:b:1--><p>x</p><!--/so:b:1-->";
    const App = () => h("p", null, "x");
    await createApp(App).hydrateAsync(container);
    expect(container.querySelector("p")?.textContent).toBe("x");
  });

  it("skips trailing comments before the extra-node assertion", async () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>x</p><!--tail-->";
    const App = () => h("p", null, "x");
    await createApp(App).hydrateAsync(container);
    expect(container.querySelector("p")?.textContent).toBe("x");
  });

  it("rejects invalid selective values synchronously", () => {
    const container = document.createElement("div");
    expect(() =>
      createApp(() => h("p", null, "x")).hydrateAsync(container, { selective: "yes" as never }),
    ).rejects.toThrow("Hydration selective option must be a boolean");
  });

  it("accepts selective: false explicitly", async () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>x</p>";
    const App = () => h("p", null, "x");
    await createApp(App).hydrateAsync(container, { selective: false });
    expect(container.querySelector("p")?.textContent).toBe("x");
  });

  it("throws on unknown hydration options (unchanged)", () => {
    const container = document.createElement("div");
    expect(() =>
      createApp(() => h("p", null, "x")).hydrateAsync(container, { teleport: true } as never),
    ).rejects.toThrow("Unknown hydration option: teleport");
  });
});
