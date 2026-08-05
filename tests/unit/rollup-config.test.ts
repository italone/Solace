import { existsSync } from "node:fs";
import { resolve } from "node:path";

// @ts-expect-error Rollup config is authored as JavaScript without declarations.
import rollupConfig from "../../rollup.config.mjs";
import tsconfig from "../../tsconfig.json";

import { describe, expect, it } from "vitest";

describe("rollup config", () => {
  it("emits SFC runtime shims as assets instead of empty chunks", () => {
    const runtimeConfig = rollupConfig[0];
    const plugins = runtimeConfig.plugins as Array<{ name?: string }>;

    expect(runtimeConfig.input).not.toHaveProperty("sfc");
    expect(plugins.some((plugin) => plugin.name === "emit-sfc-runtime-shims")).toBe(true);
  });

  it("keeps the SFC package alias on an importable source shim", () => {
    const sfcAlias = tsconfig.compilerOptions.paths["@italone/solace/sfc"];

    expect(sfcAlias).toEqual(["src/sfc-entry.ts"]);
    expect(existsSync(resolve(sfcAlias[0]))).toBe(true);
  });

  it("maps public server package imports to the source entry for local typechecking", () => {
    expect(tsconfig.compilerOptions.paths["@italone/solace/server"]).toEqual([
      "src/server/index.ts",
    ]);
  });
});
