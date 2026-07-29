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

  it("rejects plugin options while the SFC contract is syntax-stable", () => {
    expect(() => solacePlugin({ customBlocks: true } as never)).toThrow(
      /Solace Vite plugin options are not part of the public contract/,
    );
  });

  it("ignores non-Solace files", () => {
    const plugin = solacePlugin();
    const result = transformWith(plugin, "export default 1;", "/app/src/main.ts");

    expect(result).toBeNull();
  });

  it("rejects Solace file query transforms while the SFC contract is syntax-stable", () => {
    const plugin = solacePlugin();

    expect(() =>
      transformWith(plugin, "<template><p>raw</p></template>", "/app/src/App.solace?raw"),
    ).toThrow(/Solace Vite plugin query transforms are not part of the public contract/);
    expect(() =>
      transformWith(plugin, "<template><p>style</p></template>", "/app/src/App.solace?type=style"),
    ).toThrow(/Solace Vite plugin query transforms are not part of the public contract/);
  });

  it("transforms .solace files and keeps source maps disabled", () => {
    const plugin = solacePlugin();
    const result = transformWith(
      plugin,
      `<template><button class="counter">count</button></template><style>.counter { color: blue; }</style>`,
      "/app/src/App.solace",
    );

    expect(result).toMatchObject({ map: null });
    expect((result as Exclude<TransformResult, string | null>).code).toContain(
      'import * as _Solace from "@italone/solace"',
    );
    expect((result as Exclude<TransformResult, string | null>).code).toContain(
      '_Solace.h("button"',
    );
    expect((result as Exclude<TransformResult, string | null>).code).toContain("_Solace.useStyle(");
    expect((result as Exclude<TransformResult, string | null>).code).not.toContain(
      'document.createElement("style")',
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

  it("reports duplicate block diagnostics without expanding .solace syntax", () => {
    const plugin = solacePlugin();

    expect(() =>
      transformWith(
        plugin,
        `<template><p>one</p></template><template><p>two</p></template>`,
        "/app/src/Duplicate.solace",
      ),
    ).toThrow(/\[SFC_PARSE_ERROR\] \/app\/src\/Duplicate\.solace:1:32 Duplicate <template> block/);
  });
});
