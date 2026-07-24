import { describe, expect, it } from "vitest";

import { solacePlugin } from "../../../src/vite/index";

describe("solacePlugin", () => {
  it("ignores non-Solace files", () => {
    const plugin = solacePlugin();
    const result = plugin.transform?.call({} as never, "export default 1;", "/app/src/main.ts");

    expect(result).toBeNull();
  });

  it("transforms .solace files and keeps source maps disabled", () => {
    const plugin = solacePlugin();
    const result = plugin.transform?.call(
      {} as never,
      `<template><button>count</button></template>`,
      "/app/src/App.solace",
    );

    expect(result).toMatchObject({ map: null });
    expect((result as { code: string }).code).toContain(
      'import * as _Solace from "@italone/solace"',
    );
    expect((result as { code: string }).code).toContain('_Solace.h("button"');
  });

  it("adds Vite file context to compiler diagnostics", () => {
    const plugin = solacePlugin();

    expect(() =>
      plugin.transform?.call(
        {} as never,
        `<template><button>{count</button></template>`,
        "/app/src/Broken.solace",
      ),
    ).toThrow(/\/app\/src\/Broken\.solace:1:19/);
  });
});
