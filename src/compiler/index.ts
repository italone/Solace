import { createHash } from "node:crypto";

import { generateRender } from "./codegen";
import { parseSFC, parseTemplate } from "./parse";
import { scopeStyle } from "./style";
import type { SolaceCompileErrorOptions, SourceLocation } from "./types";

export class SolaceCompileError extends Error {
  readonly code: SolaceCompileErrorOptions["code"];
  readonly filename: string | undefined;
  readonly loc: SourceLocation | undefined;
  readonly cause: unknown;

  constructor(options: SolaceCompileErrorOptions) {
    super(options.message);
    this.name = "SolaceCompileError";
    this.code = options.code;
    this.filename = options.filename;
    this.loc = options.loc;
    this.cause = options.cause;
  }
}

export interface CompileOptions {
  id?: string;
}

export interface CompileResult {
  code: string;
}

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const filename = options.id;
  const scopeId = filename ? hashId(filename) : undefined;
  const descriptor = wrapCompileStep(() => parseSFC(source), "SFC_PARSE_ERROR", filename);

  if (descriptor.template === undefined) {
    throw new SolaceCompileError({
      code: "SFC_MISSING_TEMPLATE",
      message: "Missing <template> block",
      filename,
    });
  }

  const ast = wrapCompileStep(
    () => parseTemplate(descriptor.template ?? "", descriptor.templateOffset ?? 0, source, 0),
    "SFC_PARSE_ERROR",
    filename,
  );
  const renderExpr = wrapCompileStep(
    () => generateRender(ast, { scopeId }),
    "SFC_CODEGEN_ERROR",
    filename,
  );

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

function wrapCompileStep<T>(
  step: () => T,
  code: SolaceCompileErrorOptions["code"],
  filename: string | undefined,
): T {
  try {
    return step();
  } catch (error) {
    if (error instanceof SolaceCompileError) {
      throw error;
    }

    const maybeLocated = error as { loc?: SourceLocation; message?: string };
    throw new SolaceCompileError({
      code,
      message: maybeLocated.message ?? "Solace SFC compile failed",
      filename,
      loc: maybeLocated.loc,
      cause: error,
    });
  }
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
