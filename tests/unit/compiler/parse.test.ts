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
    expect(result.templateOffset).toBeGreaterThan(0);
    expect(result.scriptOffset).toBeGreaterThan(0);
    expect(result.styleOffset).toBeGreaterThan(0);
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

  it("rejects duplicate top-level blocks", () => {
    expect(() =>
      parseSFC("<template><p>one</p></template><template><p>two</p></template>"),
    ).toThrow("Duplicate <template> block");
    expect(() =>
      parseSFC("<template><p>one</p></template><script>one</script><script>two</script>"),
    ).toThrow("Duplicate <script> block");
    expect(() =>
      parseSFC("<template><p>one</p></template><style>.one {}</style><style>.two {}</style>"),
    ).toThrow("Duplicate <style> block");
  });

  it("rejects block attributes and custom top-level blocks", () => {
    expect(() => parseSFC('<template lang="html"><p>one</p></template>')).toThrow(
      "Attributes on <template> blocks are not supported",
    );
    expect(() => parseSFC("<template><p>one</p></template><script setup></script>")).toThrow(
      "Attributes on <script> blocks are not supported",
    );
    expect(() => parseSFC("<template><p>one</p></template><style scoped></style>")).toThrow(
      "Attributes on <style> blocks are not supported",
    );
    expect(() => parseSFC("<template><p>one</p></template><i18n>{}</i18n>")).toThrow(
      "Unsupported top-level <i18n> block",
    );
    expect(() => parseSFC("<template><p>one</p></template><docs>notes</docs>")).toThrow(
      "Unsupported top-level <docs> block",
    );
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

  it("reports location for mismatched closing tags", () => {
    try {
      parseTemplate("<section>\n  <span>bad</strong>\n</section>", 10);
      throw new Error("parseTemplate should have thrown");
    } catch (error) {
      expect(error).toMatchObject({
        loc: { offset: 31, line: 2, column: 12 },
      });
      expect(String((error as Error).message)).toContain(
        "Mismatched closing tag: expected </span> but found </strong>",
      );
    }
  });

  it("reports location for unclosed interpolation", () => {
    try {
      parseTemplate("<p>{count</p>", 20);
      throw new Error("parseTemplate should have thrown");
    } catch (error) {
      expect(error).toMatchObject({
        loc: { offset: 23, line: 1, column: 4 },
      });
      expect(String((error as Error).message)).toContain("Unclosed interpolation expression");
    }
  });
});
