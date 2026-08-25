import { describe, expect, it } from "vitest";

import { defineAsyncComponent } from "../../../src/component/async-component";
import { getAsyncComponentMetadata } from "../../../src/component/async-component";
import { h } from "../../../src";

describe("defineAsyncComponent fallback option", () => {
  it("exposes the fallback VNode through metadata", () => {
    const fallback = h("p", null, "loading…");
    const AsyncPart = defineAsyncComponent({
      loader: async () => () => h("em", null, "late"),
      fallback,
    });
    expect(getAsyncComponentMetadata(AsyncPart)?.getFallback?.()).toBe(fallback);
  });

  it("supports fallback factory functions and defaults to null", () => {
    const fallback = h("p", null, "loading…");
    const WithFactory = defineAsyncComponent({
      loader: async () => () => h("em", null, "late"),
      fallback: () => fallback,
    });
    expect(getAsyncComponentMetadata(WithFactory)?.getFallback?.()).toBe(fallback);

    const Without = defineAsyncComponent(async () => () => h("em", null, "late"));
    expect(getAsyncComponentMetadata(Without)?.getFallback?.()).toBeNull();
  });

  it("keeps the loader-only shorthand unchanged", () => {
    const AsyncPart = defineAsyncComponent(async () => () => h("em", null, "late"));
    expect(typeof AsyncPart).toBe("function");
    expect(getAsyncComponentMetadata(AsyncPart)?.getFallback?.()).toBeNull();
  });
});
