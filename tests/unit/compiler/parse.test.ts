import { describe, expect, it } from "vitest";

import { parseSFC, parseTemplate } from "../../../src/compiler/parse";

describe("parseSFC", () => {
  it("extracts template, script, and style blocks", () => {
    const source = `
      <template>
        <div>hello</div>
      </template>
      <script>
        const count = 0;
      </script>
      <style>
        div { color: red; }
      </style>
    `;

    const result = parseSFC(source);
    expect(result.template).toContain("<div>hello</div>");
    expect(result.script).toContain("const count = 0;");
    expect(result.style).toContain("div { color: red; }");
  });

  it("returns undefined for missing blocks", () => {
    const result = parseSFC("<template><div></div></template>");
    expect(result.template).toBeDefined();
    expect(result.script).toBeUndefined();
    expect(result.style).toBeUndefined();
  });

  it("throws when closing tag is missing", () => {
    expect(() => parseSFC("<template><div>")).toThrow("Missing closing tag");
  });
});

describe("parseTemplate", () => {
  it("parses a simple element", () => {
    const nodes = parseTemplate("<div>hello</div>");
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ type: "element", tag: "div" });
    expect((nodes[0] as { children: unknown[] }).children).toMatchObject([
      { type: "text", content: "hello" },
    ]);
  });

  it("parses self-closing element", () => {
    const nodes = parseTemplate("<input />");
    expect(nodes[0]).toMatchObject({ type: "element", tag: "input", isSelfClosing: true });
  });

  it("parses attributes with static, expression, and boolean values", () => {
    const nodes = parseTemplate(`<button class="btn" onClick={handle} disabled>click</button>`);
    const element = nodes[0] as {
      type: "element";
      attributes: { name: string; value: { type: string; content?: string; value?: boolean } }[];
    };
    expect(element.attributes).toHaveLength(3);
    expect(element.attributes[0]).toMatchObject({
      name: "class",
      value: { type: "static", content: "btn" },
    });
    expect(element.attributes[1]).toMatchObject({
      name: "onClick",
      value: { type: "expression", content: "handle" },
    });
    expect(element.attributes[2]).toMatchObject({
      name: "disabled",
      value: { type: "boolean", value: true },
    });
  });

  it("parses text interpolation", () => {
    const nodes = parseTemplate("count: {count.value}");
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({ type: "text", content: "count: " });
    expect(nodes[1]).toMatchObject({ type: "interpolation", expression: "count.value" });
  });

  it("parses nested elements", () => {
    const nodes = parseTemplate("<div><span>{a}</span></div>");
    const div = nodes[0] as { children: { tag: string; children: unknown[] }[] };
    expect(div.children[0].tag).toBe("span");
  });

  it("throws on mismatched closing tags", () => {
    expect(() => parseTemplate("<div></span>")).toThrow("Mismatched closing tag");
  });

  it("throws on unclosed interpolation", () => {
    expect(() => parseTemplate("{count")).toThrow("Unclosed interpolation expression");
  });
});
