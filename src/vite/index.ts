import type { Plugin } from "vite";

import { compile, SolaceCompileError } from "../compiler/index";

export function solacePlugin(): Plugin {
  return {
    name: "solace-sfc",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith(".solace")) {
        return null;
      }

      try {
        const result = compile(code, { id });
        return {
          code: result.code,
          map: null,
        };
      } catch (error) {
        if (error instanceof SolaceCompileError) {
          throw new Error(formatViteCompileError(error));
        }

        throw error;
      }
    },
  };
}

function formatViteCompileError(error: SolaceCompileError): string {
  const location = error.loc
    ? `${error.filename ?? "unknown"}:${error.loc.line}:${error.loc.column}`
    : (error.filename ?? "unknown");

  return `[${error.code}] ${location} ${error.message}`;
}

export default solacePlugin;
