import { createHash } from "node:crypto";

import { generateRender } from "./codegen";
import { parseSFC, parseTemplate } from "./parse";
import { scopeStyle } from "./style";

export interface CompileOptions {
  id?: string;
}

export interface CompileResult {
  code: string;
}

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const scopeId = options.id ? hashId(options.id) : undefined;
  const descriptor = parseSFC(source);

  if (descriptor.template === undefined) {
    throw new Error("Missing <template> block");
  }

  const ast = parseTemplate(descriptor.template);
  const renderExpr = generateRender(ast, { scopeId });

  const { imports, body } = descriptor.script
    ? extractScript(descriptor.script)
    : { imports: "", body: "" };

  let styleInjection = "";
  if (descriptor.style && scopeId !== undefined) {
    const scoped = scopeStyle(descriptor.style, scopeId);
    styleInjection = `
const _style = document.createElement("style");
_style.setAttribute("data-s-id", ${JSON.stringify(scopeId)});
_style.textContent = ${JSON.stringify(scoped)};
document.head.appendChild(_style);
`;
  }

  const code = `
import * as _Solace from "@italone/solace";
${imports}

export default (props, context) => {
  ${styleInjection}
  ${body}
  return () => ${renderExpr};
};
`.trim();

  return { code };
}

function extractScript(script: string): { imports: string; body: string } {
  const lines = script.split("\n");
  const imports: string[] = [];
  const body: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("import ")) {
      imports.push(line);
    } else {
      body.push(line);
    }
  }

  return {
    imports: imports.join("\n"),
    body: body.join("\n").trim(),
  };
}

function hashId(id: string): string {
  return createHash("sha256").update(id).digest("hex").slice(0, 8);
}

export { parseSFC, parseTemplate } from "./parse";
export { generateRender } from "./codegen";
export { scopeStyle } from "./style";
export type * from "./types";
