import { describe, expect, it } from "vitest";

import { scopeStyle } from "../../../src/compiler/style";

describe("scopeStyle", () => {
  it("prefixes selectors with data-s-id attribute", () => {
    const css = `.counter { color: blue; }`;
    expect(scopeStyle(css, "abc123")).toBe(`[data-s-id="abc123"] .counter { color: blue; }`);
  });

  it("handles multiple comma-separated selectors", () => {
    const css = `.a, .b { color: red; }`;
    expect(scopeStyle(css, "abc123")).toBe(
      `[data-s-id="abc123"] .a, [data-s-id="abc123"] .b { color: red; }`,
    );
  });

  it("preserves multiple rules", () => {
    const css = `.a { color: red; }\n.b { color: blue; }`;
    const result = scopeStyle(css, "abc123");
    expect(result).toContain(`[data-s-id="abc123"] .a { color: red; }`);
    expect(result).toContain(`[data-s-id="abc123"] .b { color: blue; }`);
  });
});
