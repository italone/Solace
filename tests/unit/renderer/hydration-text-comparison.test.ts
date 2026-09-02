import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import { hydrate, hydrateAsync, SolaceHydrationError } from "../../../src/renderer/renderer";

describe("hydrate textComparison option", () => {
  function captureHydrationError(fn: () => void): SolaceHydrationError {
    try {
      fn();
    } catch (error) {
      expect(error).toBeInstanceOf(SolaceHydrationError);
      return error as SolaceHydrationError;
    }

    throw new Error("Expected hydration to throw");
  }

  it("defaults to exact text comparison", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>hello  world</p>";

    const error = captureHydrationError(() => hydrate(h("p", null, "hello world"), container));

    expect(error.kind).toBe("text-mismatch");
  });

  it("normalized-collapsing accepts foldable inner whitespace", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>hello   world</p>";

    expect(() =>
      hydrate(h("p", null, "hello world"), container, null, {
        textComparison: "normalized-collapsing",
      }),
    ).not.toThrow();
  });

  it("normalized-collapsing trims outer whitespace", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>\n  hello world\n</p>";

    expect(() =>
      hydrate(h("p", null, "hello world"), container, null, {
        textComparison: "normalized-collapsing",
      }),
    ).not.toThrow();
  });

  it("normalized-collapsing still throws on real text differences", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>hello world</p>";

    const error = captureHydrationError(() =>
      hydrate(h("p", null, "hello there"), container, null, {
        textComparison: "normalized-collapsing",
      }),
    );

    expect(error.kind).toBe("text-mismatch");
  });

  it("throws TypeError for unknown textComparison values", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>hello</p>";

    expect(() =>
      hydrate(h("p", null, "hello"), container, null, {
        textComparison: "loose" as never,
      }),
    ).toThrow(/Hydration textComparison option must be/);
  });

  it("hydrateAsync honors normalized-collapsing for component trees", async () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>hello   world</p>";
    const Component = () => h("p", null, "hello world");

    await expect(
      hydrateAsync(Component, container, null, { textComparison: "normalized-collapsing" }),
    ).resolves.toBeUndefined();
  });
});
