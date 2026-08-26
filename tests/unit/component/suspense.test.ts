import { describe, expect, it } from "vitest";

import { defineAsyncComponent, h, Suspense } from "../../../src";
import { getAsyncComponentMetadata } from "../../../src/component/async-component";
import { render } from "../../../src/renderer/renderer";

function collectText(el: Element): string {
  return el.textContent ?? "";
}

describe("Suspense component", () => {
  it("renders fallback while subtree loaders are pending, then swaps", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const AsyncPart = defineAsyncComponent(() => gate.then(() => () => h("em", null, "late")));

    const container = document.createElement("div");
    render(
      h(Suspense, { fallback: h("p", null, "loading…") }, [h("b", null, "first"), h(AsyncPart)]),
      container,
    );

    expect(collectText(container)).toContain("first");
    expect(collectText(container)).toContain("loading…");
    expect(collectText(container)).not.toContain("late");

    release!();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(collectText(container)).toContain("late");
    expect(collectText(container)).not.toContain("loading…");
  });

  it("renders content synchronously when loaders are already resolved", async () => {
    const AsyncPart = defineAsyncComponent(async () => () => h("em", null, "ready"));
    const AsyncSibling = defineAsyncComponent(async () => () => h("i", null, "sib"));
    await Promise.all([
      getAsyncComponentMetadata(AsyncPart)!.load(),
      getAsyncComponentMetadata(AsyncSibling)!.load(),
    ]);

    const container = document.createElement("div");
    render(
      h(Suspense, { fallback: h("p", null, "loading…") }, [h(AsyncPart), h(AsyncSibling)]),
      container,
    );

    expect(collectText(container)).toContain("ready");
    expect(collectText(container)).toContain("sib");
    expect(collectText(container)).not.toContain("loading…");
  });

  it("uses an empty fragment when no fallback is provided", () => {
    const container = document.createElement("div");
    render(h(Suspense, null, [h("b", null, "ok")]), container);
    expect(collectText(container)).toContain("ok");
  });

  it("keeps the fallback and logs when a subtree loader rejects", async () => {
    const Bad = defineAsyncComponent(() => Promise.reject(new Error("boom")));
    const errors: unknown[] = [];
    const originalError = console.error;
    console.error = (e: unknown) => errors.push(e);

    try {
      const container = document.createElement("div");
      render(h(Suspense, { fallback: h("p", null, "loading…") }, [h(Bad)]), container);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(collectText(container)).toContain("loading…");
      expect(errors.length).toBeGreaterThan(0);
    } finally {
      console.error = originalError;
    }
  });

  it("does not coordinate async components inside a nested Suspense", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const Inner = defineAsyncComponent(() => gate.then(() => () => h("i", null, "inner")));
    const Outer = defineAsyncComponent(async () => () => h("b", null, "outer"));

    const container = document.createElement("div");
    render(
      h(Suspense, { fallback: h("p", null, "outer…") }, [
        h(Outer),
        h(Suspense, { fallback: h("p", null, "inner…") }, [h(Inner)]),
      ]),
      container,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(collectText(container)).toContain("outer");
    expect(collectText(container)).toContain("inner…");
    expect(collectText(container)).not.toContain("outer…");

    release!();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(collectText(container)).toContain("inner");
    expect(collectText(container)).not.toContain("inner…");
  });
});
