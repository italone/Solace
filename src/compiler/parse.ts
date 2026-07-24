import type { Attribute, SFCDescriptor, TemplateNode } from "./types";

export function parseSFC(source: string): SFCDescriptor {
  return {
    template: extractBlock(source, "template"),
    script: extractBlock(source, "script"),
    style: extractBlock(source, "style"),
  };
}

function extractBlock(source: string, tag: string): string | undefined {
  const open = `<${tag}>`;
  const openIndex = source.indexOf(open);
  if (openIndex === -1) {
    return undefined;
  }

  const close = `</${tag}>`;
  const closeIndex = source.indexOf(close, openIndex + open.length);
  if (closeIndex === -1) {
    throw new Error(`Missing closing tag </${tag}>`);
  }

  return source.slice(openIndex + open.length, closeIndex).trim();
}

export function parseTemplate(template: string): TemplateNode[] {
  const nodes: TemplateNode[] = [];
  let index = 0;

  while (index < template.length) {
    const char = template[index];

    if (char === "<") {
      if (template[index + 1] === "/") {
        // Closing tag reached unexpectedly at top level.
        break;
      }

      const result = parseElement(template, index);
      nodes.push(result.node);
      index = result.index;
      continue;
    }

    if (char === "{") {
      const result = parseInterpolation(template, index);
      nodes.push(result.node);
      index = result.index;
      continue;
    }

    const result = parseText(template, index);
    if (result.node.content.length > 0) {
      nodes.push(result.node);
    }
    index = result.index;
  }

  return nodes;
}

function parseText(
  template: string,
  start: number,
): { node: { type: "text"; content: string }; index: number } {
  let index = start;
  while (index < template.length) {
    const char = template[index];
    if (char === "<" || char === "{") {
      break;
    }
    index += 1;
  }

  return {
    node: { type: "text", content: template.slice(start, index) },
    index,
  };
}

function parseInterpolation(
  template: string,
  start: number,
): { node: { type: "interpolation"; expression: string }; index: number } {
  let depth = 0;
  let index = start;
  while (index < template.length) {
    const char = template[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          node: { type: "interpolation", expression: template.slice(start + 1, index) },
          index: index + 1,
        };
      }
    }
    index += 1;
  }

  throw new Error("Unclosed interpolation expression");
}

function parseElement(template: string, start: number): { node: TemplateNode; index: number } {
  let index = start + 1; // skip '<'
  const tagEnd = findTagNameEnd(template, index);
  const tag = template.slice(index, tagEnd).trim();
  index = tagEnd;

  const attributes: Attribute[] = [];
  let isSelfClosing = false;

  while (index < template.length) {
    const char = template[index];

    if (char === "/" && template[index + 1] === ">") {
      isSelfClosing = true;
      index += 2;
      break;
    }

    if (char === ">") {
      index += 1;
      break;
    }

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    const result = parseAttribute(template, index);
    attributes.push(result.attribute);
    index = result.index;
  }

  if (isSelfClosing) {
    return {
      node: { type: "element", tag, attributes, children: [], isSelfClosing: true },
      index,
    };
  }

  const children: TemplateNode[] = [];
  while (index < template.length) {
    if (template[index] === "<" && template[index + 1] === "/") {
      const closeStart = index + 2;
      const closeEnd = findTagNameEnd(template, closeStart);
      const closeTag = template.slice(closeStart, closeEnd).trim();
      if (closeTag !== tag) {
        throw new Error(`Mismatched closing tag: expected </${tag}> but found </${closeTag}>`);
      }
      index = closeEnd + 1; // skip '>'
      break;
    }

    if (template[index] === "<") {
      const result = parseElement(template, index);
      children.push(result.node);
      index = result.index;
      continue;
    }

    if (template[index] === "{") {
      const result = parseInterpolation(template, index);
      children.push(result.node);
      index = result.index;
      continue;
    }

    const result = parseText(template, index);
    if (result.node.content.length > 0) {
      children.push(result.node);
    }
    index = result.index;
  }

  return {
    node: { type: "element", tag, attributes, children, isSelfClosing: false },
    index,
  };
}

function findTagNameEnd(template: string, start: number): number {
  let index = start;
  while (index < template.length) {
    const char = template[index];
    if (/\s/.test(char) || char === ">" || (char === "/" && template[index + 1] === ">")) {
      return index;
    }
    index += 1;
  }
  return index;
}

function parseAttribute(template: string, start: number): { attribute: Attribute; index: number } {
  let index = start;
  const nameEnd = findAttributeNameEnd(template, index);
  const name = template.slice(index, nameEnd).trim();
  index = nameEnd;

  if (index >= template.length || template[index] !== "=") {
    return {
      attribute: { name, value: { type: "boolean", value: true } },
      index,
    };
  }

  index += 1; // skip '='

  // Skip whitespace before value
  while (index < template.length && /\s/.test(template[index])) {
    index += 1;
  }

  if (template[index] === "{") {
    const result = parseInterpolation(template, index);
    return {
      attribute: { name, value: { type: "expression", content: result.node.expression } },
      index: result.index,
    };
  }

  if (template[index] === '"' || template[index] === "'") {
    const quote = template[index];
    index += 1;
    const valueStart = index;
    while (index < template.length && template[index] !== quote) {
      index += 1;
    }
    if (index >= template.length) {
      throw new Error(`Unclosed attribute value for ${name}`);
    }
    const content = template.slice(valueStart, index);
    index += 1; // skip closing quote
    return {
      attribute: { name, value: { type: "static", content } },
      index,
    };
  }

  throw new Error(`Unexpected character in attribute value for ${name}`);
}

function findAttributeNameEnd(template: string, start: number): number {
  let index = start;
  while (index < template.length) {
    const char = template[index];
    if (
      /\s/.test(char) ||
      char === "=" ||
      char === ">" ||
      (char === "/" && template[index + 1] === ">")
    ) {
      return index;
    }
    index += 1;
  }
  return index;
}
