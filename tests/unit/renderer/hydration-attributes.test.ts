import { describe, expect, it } from "vitest";

import { h, SolaceHydrationError } from "../../../src";
import { hydrate } from "../../../src/renderer/renderer";

function createContainer(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

function captureHydrationError(fn: () => void): SolaceHydrationError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(SolaceHydrationError);
    return error as SolaceHydrationError;
  }

  throw new Error("Expected hydration to throw");
}

describe("hydrate attribute mismatches", () => {
  it("throws on a missing attribute", () => {
    const container = createContainer("<a></a>");
    const error = captureHydrationError(() => hydrate(h("a", { href: "/x" }), container));

    expect(error.kind).toBe("attribute-mismatch");
    expect(error.attributeName).toBe("href");
    expect(error.path).toContain("/a");
  });

  it("throws on a differing string value", () => {
    const container = createContainer('<a href="/y"></a>');
    const error = captureHydrationError(() => hydrate(h("a", { href: "/x" }), container));

    expect(error.kind).toBe("attribute-mismatch");
    expect(error.attributeName).toBe("href");
    expect(error.expected).toContain('"/x"');
    expect(error.actual).toContain('"/y"');
  });

  it("throws when a boolean prop is present on the client only", () => {
    const container = createContainer("<input>");
    const error = captureHydrationError(() => hydrate(h("input", { disabled: true }), container));

    expect(error.kind).toBe("attribute-mismatch");
    expect(error.attributeName).toBe("disabled");
  });

  it("accepts false, undefined, and null as equivalent to an absent attribute", () => {
    const falseContainer = createContainer("<input>");
    expect(() => hydrate(h("input", { disabled: false }), falseContainer)).not.toThrow();

    const undefinedContainer = createContainer("<input>");
    expect(() => hydrate(h("input", { disabled: undefined }), undefinedContainer)).not.toThrow();

    const nullContainer = createContainer("<input>");
    expect(() => hydrate(h("input", { disabled: null }), nullContainer)).not.toThrow();
  });

  it("accepts true when the attribute is present with any value", () => {
    const container = createContainer("<input disabled>");
    expect(() => hydrate(h("input", { disabled: true }), container)).not.toThrow();

    const valuedContainer = createContainer('<input disabled="disabled">');
    expect(() => hydrate(h("input", { disabled: true }), valuedContainer)).not.toThrow();
  });

  it("accepts a matching string attribute", () => {
    const container = createContainer('<a href="/x"></a>');
    expect(() => hydrate(h("a", { href: "/x" }), container)).not.toThrow();
  });

  it("ignores extra DOM attributes the client does not declare", () => {
    const container = createContainer('<button type="submit">ok</button>');
    expect(() => hydrate(h("button", null, "ok"), container)).not.toThrow();
  });

  it("ignores event props, key, ref, and style", () => {
    const eventContainer = createContainer("<button>ok</button>");
    expect(() =>
      hydrate(h("button", { onClick: () => {}, onInput: () => {} }, "ok"), eventContainer),
    ).not.toThrow();

    const keyContainer = createContainer("<button>ok</button>");
    expect(() => hydrate(h("button", { key: "submit" }, "ok"), keyContainer)).not.toThrow();

    const refContainer = createContainer("<button>ok</button>");
    expect(() => hydrate(h("button", { ref: () => {} }, "ok"), refContainer)).not.toThrow();

    const styleContainer = createContainer("<button>ok</button>");
    expect(() =>
      hydrate(h("button", { style: { color: "red" } } as never, "ok"), styleContainer),
    ).not.toThrow();
  });

  it("compares className as the literal className attribute, matching renderer behavior", () => {
    const container = createContainer('<p class="a"></p>');
    const error = captureHydrationError(() => hydrate(h("p", { className: "a" }), container));

    expect(error.kind).toBe("attribute-mismatch");
    expect(error.attributeName).toBe("className");
  });

  it("accepts a matching class attribute", () => {
    const container = createContainer('<p class="a"></p>');
    expect(() => hydrate(h("p", { class: "a" }), container)).not.toThrow();
  });

  it("stringifies numeric prop values instead of falsy-skipping them", () => {
    const matchingContainer = createContainer('<input maxlength="0">');
    expect(() => hydrate(h("input", { maxlength: 0 }), matchingContainer)).not.toThrow();

    const differingContainer = createContainer('<input maxlength="1">');
    const error = captureHydrationError(() =>
      hydrate(h("input", { maxlength: 0 }), differingContainer),
    );

    expect(error.kind).toBe("attribute-mismatch");
    expect(error.attributeName).toBe("maxlength");
    expect(error.expected).toContain('"0"');
    expect(error.actual).toContain('"1"');
  });

  it("compares form value and checked against DOM properties", () => {
    const valueContainer = createContainer('<input value="typed">');
    expect(() => hydrate(h("input", { value: "typed" }), valueContainer)).not.toThrow();

    const missingValueContainer = createContainer("<input>");
    const error = captureHydrationError(() =>
      hydrate(h("input", { value: "x" }), missingValueContainer),
    );

    expect(error.kind).toBe("attribute-mismatch");
    expect(error.attributeName).toBe("value");

    const checkedContainer = createContainer('<input type="checkbox" checked>');
    expect(() =>
      hydrate(h("input", { type: "checkbox", checked: true }), checkedContainer),
    ).not.toThrow();
  });
});
