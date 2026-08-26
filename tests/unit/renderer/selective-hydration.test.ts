import { describe, expect, it } from "vitest";

import { defineAsyncComponent, Fragment, h, Suspense } from "../../../src";
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

  it("rejects selective: true on the synchronous hydrate()", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>x</p>";
    expect(() =>
      createApp(() => h("p", null, "x")).hydrate(container, { selective: true }),
    ).toThrow("Selective hydration requires hydrateAsync(); hydrate() is synchronous.");
  });
});

describe("selective hydration", () => {
  it("hydrates ready parts immediately and patches pending boundaries on resolution", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const AsyncPart = defineAsyncComponent({
      loader: () => gate.then(() => () => h("em", { id: "late" }, "late")),
      fallback: h("p", null, "loading…"),
    });
    const App = () => h(Fragment, null, [h("b", null, "ok"), h(AsyncPart)]);

    const container = document.createElement("div");
    container.innerHTML = "<b>ok</b><!--so:b:1--><p>loading…</p><!--/so:b:1-->";
    document.body.appendChild(container);

    const hydration = createApp(App).hydrateAsync(container, { selective: true });
    await Promise.resolve();
    // The ready part must be live while the gate is still closed: the walk
    // completed without awaiting the loader.
    expect(container.querySelector("b")?.textContent).toBe("ok");

    release!();
    await hydration;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.querySelector("#late")?.textContent).toBe("late");
    expect(container.textContent).not.toContain("loading…");
    expect(container.innerHTML).not.toContain("so:b:1");
  });

  it("hydrates Suspense fallback and swaps content on resolution", async () => {
    const Inner = defineAsyncComponent(async () => () => h("i", null, "inner"));
    const App = () => h(Suspense, { fallback: h("p", null, "loading…") }, [h(Inner)]);
    const container = document.createElement("div");
    container.innerHTML = "<!--so:b:1--><p>loading…</p><!--/so:b:1-->";
    document.body.appendChild(container);
    await createApp(App).hydrateAsync(container, { selective: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.querySelector("i")?.textContent).toBe("inner");
    expect(container.innerHTML).not.toContain("so:b:1");
  });

  it("keeps the fallback and does not reject when a boundary loader fails", async () => {
    const Bad = defineAsyncComponent({
      loader: () => Promise.reject(new Error("boom")),
      fallback: h("p", null, "loading…"),
    });
    const App = () => h(Bad);
    const container = document.createElement("div");
    container.innerHTML = "<!--so:b:1--><p>loading…</p><!--/so:b:1-->";
    document.body.appendChild(container);
    const errors: unknown[] = [];
    const originalError = console.error;
    console.error = (e: unknown) => errors.push(e);
    try {
      await createApp(App).hydrateAsync(container, { selective: true });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(container.textContent).toContain("loading…");
      expect(errors.length).toBeGreaterThan(0);
    } finally {
      console.error = originalError;
    }
  });
});
