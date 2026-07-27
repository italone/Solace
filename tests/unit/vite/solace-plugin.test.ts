import { describe, expect, it } from "vitest";
import type { Plugin, TransformResult } from "vite";

import defaultSolacePlugin, { solacePlugin } from "../../../src/vite/index";

type TestTransformResult = TransformResult | Promise<TransformResult> | undefined;

function transformWith(plugin: Plugin, code: string, id: string): TestTransformResult {
  const transform = plugin.transform;

  if (typeof transform === "function") {
    return transform.call({} as never, code, id) as TestTransformResult;
  }

  return transform?.handler.call({} as never, code, id) as TestTransformResult;
}

describe("solacePlugin", () => {
  it("exposes a stable Vite plugin shape", () => {
    const plugin = solacePlugin();
    const defaultPlugin = defaultSolacePlugin();

    expect(plugin.name).toBe("solace-sfc");
    expect(plugin.enforce).toBe("pre");
    expect(defaultPlugin.name).toBe(plugin.name);
    expect(defaultPlugin.enforce).toBe(plugin.enforce);
  });

  it("ignores non-Solace files", () => {
    const plugin = solacePlugin();
    const result = transformWith(plugin, "export default 1;", "/app/src/main.ts");

    expect(result).toBeNull();
  });

  it("transforms .solace files and keeps source maps disabled", () => {
    const plugin = solacePlugin();
    const result = transformWith(
      plugin,
      `<template><button>count</button></template>`,
      "/app/src/App.solace",
    );

    expect(result).toMatchObject({ map: null });
    expect((result as Exclude<TransformResult, string | null>).code).toContain(
      'import * as _Solace from "@italone/solace"',
    );
    expect((result as Exclude<TransformResult, string | null>).code).toContain(
      '_Solace.h("button"',
    );
  });

  it("adds Vite file context to compiler diagnostics", () => {
    const plugin = solacePlugin();

    expect(() =>
      transformWith(
        plugin,
        `<template><button>{count</button></template>`,
        "/app/src/Broken.solace",
      ),
    ).toThrow(/\/app\/src\/Broken\.solace:1:19/);
  });
});
