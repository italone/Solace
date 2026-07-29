import type { Plugin } from "vite";

import { compile, SolaceCompileError } from "../compiler/index";

export function solacePlugin(...options: never[]): Plugin {
  if (options.length > 0) {
    throw new TypeError(
      "Solace Vite plugin options are not part of the public contract; keep .solace syntax stable.",
    );
  }

  return {
    name: "solace-sfc",
    enforce: "pre",
    transform(code, id) {
      const request = parseSolaceRequest(id);
      if (request === "query") {
        throw new TypeError(
          "Solace Vite plugin query transforms are not part of the public contract; import bare .solace files only.",
        );
      }

      if (request === "non-solace") {
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

type SolaceRequestKind = "bare" | "query" | "non-solace";

function parseSolaceRequest(id: string): SolaceRequestKind {
  const queryIndex = id.indexOf("?");
  if (queryIndex === -1) {
    return id.endsWith(".solace") ? "bare" : "non-solace";
  }

  return id.slice(0, queryIndex).endsWith(".solace") ? "query" : "non-solace";
}

function formatViteCompileError(error: SolaceCompileError): string {
  const location = error.loc
    ? `${error.filename ?? "unknown"}:${error.loc.line}:${error.loc.column}`
    : (error.filename ?? "unknown");

  return `[${error.code}] ${location} ${error.message}`;
}

export default solacePlugin;
