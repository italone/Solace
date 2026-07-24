import type { Plugin } from "vite";

import { compile } from "../compiler/index";

export function solacePlugin(): Plugin {
  return {
    name: "solace-sfc",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith(".solace")) {
        return null;
      }

      const result = compile(code, { id });
      return {
        code: result.code,
        map: null,
      };
    },
  };
}

export default solacePlugin;
