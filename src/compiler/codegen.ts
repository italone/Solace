import type { ElementNode, TemplateNode } from "./types";

export interface RenderCodegenOptions {
  scopeId?: string;
}

export function generateRender(ast: TemplateNode[], options: RenderCodegenOptions = {}): string {
  const { scopeId } = options;

  if (ast.length === 0) {
    return "_Solace.h(_Solace.Fragment, null, [])";
  }

  if (ast.length === 1 && ast[0].type === "element") {
    return generateNode(ast[0], scopeId, true);
  }

  const children = generateChildArray(ast);
  return `_Solace.h(_Solace.Fragment, null, ${children})`;
}

function generateNode(node: TemplateNode, scopeId?: string, isRoot = false): string {
  if (node.type === "text") {
    return JSON.stringify(node.content);
  }

  if (node.type === "interpolation") {
    return `String(${node.expression})`;
  }

  return generateElement(node, scopeId, isRoot);
}

function generateElement(node: ElementNode, scopeId?: string, isRoot = false): string {
  const tag = JSON.stringify(node.tag);
  const props = generateProps(node, scopeId, isRoot);

  if (node.isSelfClosing) {
    return `_Solace.h(${tag}, ${props})`;
  }

  const children = generateChildArray(node.children);
  return `_Solace.h(${tag}, ${props}, ${children})`;
}

function generateProps(node: ElementNode, scopeId?: string, isRoot = false): string {
  const entries: string[] = [];

  for (const attribute of node.attributes) {
    if (attribute.value.type === "boolean") {
      entries.push(`${attribute.name}: true`);
    } else if (attribute.value.type === "static") {
      entries.push(`${attribute.name}: ${JSON.stringify(attribute.value.content)}`);
    } else {
      entries.push(`${attribute.name}: ${attribute.value.content}`);
    }
  }

  if (isRoot && scopeId !== undefined) {
    entries.push(`"data-s-id": ${JSON.stringify(scopeId)}`);
  }

  if (entries.length === 0) {
    return "null";
  }

  return `{ ${entries.join(", ")} }`;
}

function generateChildArray(children: TemplateNode[]): string {
  const nonEmpty = children.filter((child) => {
    if (child.type === "text") {
      return child.content.trim().length > 0;
    }
    return true;
  });

  if (nonEmpty.length === 0) {
    return "null";
  }

  if (nonEmpty.length === 1) {
    const child = nonEmpty[0];
    if (child.type === "text") {
      return JSON.stringify(child.content);
    }
    if (child.type === "interpolation") {
      return `String(${child.expression})`;
    }
    return generateNode(child);
  }

  const allText = nonEmpty.every((child) => child.type === "text");
  if (allText) {
    return JSON.stringify(nonEmpty.map((child) => (child as { content: string }).content).join(""));
  }

  const parts = nonEmpty.map((child) => {
    if (child.type === "text") {
      return `_Solace.h("span", null, ${JSON.stringify(child.content)})`;
    }
    if (child.type === "interpolation") {
      return `_Solace.h("span", null, String(${child.expression}))`;
    }
    return generateNode(child);
  });

  return `[${parts.join(", ")}]`;
}
