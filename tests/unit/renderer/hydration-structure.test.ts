import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import { hydrate, SolaceHydrationError } from "../../../src/renderer/renderer";

function captureHydrationError(fn: () => void): SolaceHydrationError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(SolaceHydrationError);
    return error as SolaceHydrationError;
  }

  throw new Error("Expected hydration to throw");
}

describe("hydrate structural mismatches", () => {
  it("reports an extra element in a children list as extra-node", () => {
    const container = document.createElement("div");
    container.innerHTML = "<ul><li>a</li><li>b</li><li>c</li></ul>";

    const error = captureHydrationError(() =>
      hydrate(h("ul", null, [h("li", null, "a"), h("li", null, "b")]), container),
    );

    expect(error.kind).toBe("extra-node");
    expect(error).toMatchObject({
      kind: "extra-node",
      path: "root/ul[2]",
      expected: "no DOM node",
      actual: "<li>",
    });
    expect(error.message).toMatch(/path root\/ul\[2\]/i);
  });

  it("reports a missing element in a children list as missing-node", () => {
    const container = document.createElement("div");
    container.innerHTML = "<ul><li>a</li></ul>";

    const error = captureHydrationError(() =>
      hydrate(h("ul", null, [h("li", null, "a"), h("li", null, "b")]), container),
    );

    expect(error.kind).toBe("missing-node");
    expect(error).toMatchObject({
      kind: "missing-node",
      path: "root/ul[1]",
      expected: "<li>",
      actual: "null",
    });
    expect(error.message).toMatch(/path root\/ul\[1\]: missing DOM node for <li>/i);
  });

  it("reports an element where the client tree expects text as a text mismatch", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p><span>x</span></p>";

    const error = captureHydrationError(() => hydrate(h("p", null, "text"), container));

    // A string child is compared against the element's textContent, so an
    // element child where text is expected surfaces as a text mismatch.
    expect(error.kind).toBe("text-mismatch");
    expect(error.message).toMatch(/expected text "text" but found "x"/i);
  });
});
