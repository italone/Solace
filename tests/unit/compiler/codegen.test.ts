import { describe, expect, it } from "vitest";

import { generateRender } from "../../../src/compiler/codegen";
import type { ElementNode, InterpolationNode, TextNode } from "../../../src/compiler/types";

describe("generateRender", () => {
  it("generates empty fragment for empty template", () => {
    const result = generateRender([]);
    expect(result).toBe("_Solace.h(_Solace.Fragment, null, [])");
  });

  it("generates a single element", () => {
    const node: ElementNode = {
      type: "element",
      tag: "div",
      attributes: [],
      children: [],
      isSelfClosing: false,
    };
    expect(generateRender([node])).toBe(`_Solace.h("div", null, null)`);
  });

  it("generates element with static attributes", () => {
    const node: ElementNode = {
      type: "element",
      tag: "button",
      attributes: [{ name: "class", value: { type: "static", content: "btn" } }],
      children: [],
      isSelfClosing: false,
    };
    expect(generateRender([node])).toBe(`_Solace.h("button", { class: "btn" }, null)`);
  });

  it("generates element with expression attribute", () => {
    const node: ElementNode = {
      type: "element",
      tag: "button",
      attributes: [{ name: "onClick", value: { type: "expression", content: "increment" } }],
      children: [{ type: "text", content: "click" }],
      isSelfClosing: false,
    };
    expect(generateRender([node])).toBe(`_Solace.h("button", { onClick: increment }, "click")`);
  });

  it("generates text interpolation", () => {
    const text: TextNode = { type: "text", content: "count: " };
    const interpolation: InterpolationNode = { type: "interpolation", expression: "count.value" };
    expect(generateRender([text, interpolation])).toBe(
      `_Solace.h(_Solace.Fragment, null, [_Solace.h("span", null, "count: "), _Solace.h("span", null, String(count.value))])`,
    );
  });

  it("adds scope id to root element", () => {
    const node: ElementNode = {
      type: "element",
      tag: "div",
      attributes: [],
      children: [],
      isSelfClosing: false,
    };
    expect(generateRender([node], { scopeId: "abc123" })).toBe(
      `_Solace.h("div", { "data-s-id": "abc123" }, null)`,
    );
  });

  it("wraps mixed text/element children with spans", () => {
    const text: TextNode = { type: "text", content: "hello " };
    const element: ElementNode = {
      type: "element",
      tag: "span",
      attributes: [],
      children: [],
      isSelfClosing: false,
    };
    expect(generateRender([text, element])).toBe(
      `_Solace.h(_Solace.Fragment, null, [_Solace.h("span", null, "hello "), _Solace.h("span", null, null)])`,
    );
  });
});
