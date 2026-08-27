import { describe, expect, it } from "vitest";

import { assertSSRAssetOptions, buildSSRAssetTags } from "../../../src/server/ssr-assets";

const manifest = {
  "src/main.ts": { file: "assets/main.js", css: ["assets/main.css"] },
  "src/shared.ts": { file: "assets/shared.js", imports: undefined },
};
const manifestWithImports = {
  "src/main.ts": {
    file: "assets/main.js",
    css: ["assets/main.css"],
    imports: ["src/shared.ts"],
  },
  "src/shared.ts": { file: "assets/shared.js" },
};

describe("assertSSRAssetOptions", () => {
  it("accepts both options together", () => {
    expect(() => assertSSRAssetOptions({ manifest, clientEntry: "src/main.ts" })).not.toThrow();
  });

  it("accepts both absent", () => {
    expect(() => assertSSRAssetOptions({})).not.toThrow();
  });

  it("rejects manifest without clientEntry and vice versa", () => {
    expect(() => assertSSRAssetOptions({ manifest } as never)).toThrow(
      "SSR manifest and clientEntry must be provided together",
    );
    expect(() => assertSSRAssetOptions({ clientEntry: "src/main.ts" } as never)).toThrow(
      "SSR manifest and clientEntry must be provided together",
    );
  });
});

describe("buildSSRAssetTags", () => {
  it("renders modulepreloads, stylesheets, then the entry module script", () => {
    const tags = buildSSRAssetTags(manifestWithImports, "src/main.ts");
    expect(tags).toBe(
      '<link rel="modulepreload" href="/assets/shared.js">' +
        '<link rel="stylesheet" href="/assets/main.css">' +
        '<script type="module" src="/assets/main.js"></script>',
    );
  });

  it("propagates resolveStaticAssets validation errors", () => {
    expect(() => buildSSRAssetTags(manifest, "src/missing.ts")).toThrow(
      "Static asset manifest entry not found: src/missing.ts",
    );
  });
});
