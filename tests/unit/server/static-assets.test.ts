import { describe, expect, it } from "vitest";

import { resolveStaticAssets } from "../../../src/server";

describe("resolveStaticAssets", () => {
  it("rejects invalid options containers", () => {
    for (const options of [null, [], "assets"]) {
      expect(() => resolveStaticAssets(options as never)).toThrow(
        TypeError("Static asset options must be an object"),
      );
    }
  });

  it("rejects non-string asset bases", () => {
    for (const base of [null, 42, {}]) {
      expect(() =>
        resolveStaticAssets({
          base: base as never,
          entry: "src/main.ts",
          manifest: { "src/main.ts": { file: "assets/main.js" } },
        }),
      ).toThrow(TypeError("Static asset base must be a string"));
    }
  });

  it("rejects invalid manifests", () => {
    for (const manifest of [null, [], "manifest"]) {
      expect(() =>
        resolveStaticAssets({
          entry: "src/main.ts",
          manifest: manifest as never,
        }),
      ).toThrow(TypeError("Static asset manifest must be an object"));
    }
  });

  it("rejects non-string asset entries", () => {
    for (const entry of [null, 42, {}]) {
      expect(() =>
        resolveStaticAssets({
          entry: entry as never,
          manifest: { "src/main.ts": { file: "assets/main.js" } },
        }),
      ).toThrow(TypeError("Static asset entry must be a string"));
    }
  });

  it("rejects empty asset entries", () => {
    expect(() =>
      resolveStaticAssets({
        entry: "",
        manifest: {},
      }),
    ).toThrow(TypeError("Static asset entry must not be empty"));
  });

  it("rejects invalid manifest chunks", () => {
    for (const chunk of [null, [], "chunk"]) {
      expect(() =>
        resolveStaticAssets({
          entry: "src/main.ts",
          manifest: { "src/main.ts": chunk as never },
        }),
      ).toThrow(TypeError("Static asset manifest chunk must be an object"));
    }
  });

  it("rejects manifest chunks with non-string files", () => {
    for (const file of [undefined, null, 42, {}]) {
      expect(() =>
        resolveStaticAssets({
          entry: "src/main.ts",
          manifest: { "src/main.ts": { file: file as never } },
        }),
      ).toThrow(TypeError("Static asset manifest chunk file must be a string"));
    }
  });

  it("rejects manifest chunks with empty files", () => {
    expect(() =>
      resolveStaticAssets({
        entry: "src/main.ts",
        manifest: { "src/main.ts": { file: "" } },
      }),
    ).toThrow(TypeError("Static asset manifest chunk file must not be empty"));
  });

  it("rejects manifest chunks with non-array css", () => {
    for (const css of [null, "assets/main.css", {}]) {
      expect(() =>
        resolveStaticAssets({
          entry: "src/main.ts",
          manifest: { "src/main.ts": { file: "assets/main.js", css: css as never } },
        }),
      ).toThrow(TypeError("Static asset manifest chunk css must be an array"));
    }
  });

  it("rejects manifest chunks with non-string css items", () => {
    for (const css of [[null], ["assets/main.css", {}]]) {
      expect(() =>
        resolveStaticAssets({
          entry: "src/main.ts",
          manifest: { "src/main.ts": { file: "assets/main.js", css: css as never } },
        }),
      ).toThrow(TypeError("Static asset manifest chunk css items must be strings"));
    }
  });

  it("rejects manifest chunks with empty css items", () => {
    expect(() =>
      resolveStaticAssets({
        entry: "src/main.ts",
        manifest: { "src/main.ts": { file: "assets/main.js", css: [""] } },
      }),
    ).toThrow(TypeError("Static asset manifest chunk css items must not be empty"));
  });

  it("rejects manifest chunks with non-array imports", () => {
    for (const imports of [null, "_vendor.js", {}]) {
      expect(() =>
        resolveStaticAssets({
          entry: "src/main.ts",
          manifest: { "src/main.ts": { file: "assets/main.js", imports: imports as never } },
        }),
      ).toThrow(TypeError("Static asset manifest chunk imports must be an array"));
    }
  });

  it("rejects manifest chunks with non-string import items", () => {
    for (const imports of [[null], ["_vendor.js", {}]]) {
      expect(() =>
        resolveStaticAssets({
          entry: "src/main.ts",
          manifest: { "src/main.ts": { file: "assets/main.js", imports: imports as never } },
        }),
      ).toThrow(TypeError("Static asset manifest chunk import items must be strings"));
    }
  });

  it("rejects manifest chunks with empty import items", () => {
    expect(() =>
      resolveStaticAssets({
        entry: "src/main.ts",
        manifest: { "src/main.ts": { file: "assets/main.js", imports: [""] } },
      }),
    ).toThrow(TypeError("Static asset manifest chunk import items must not be empty"));
  });

  it("emits imported chunks before the entry chunk and dedupes css", () => {
    const assets = resolveStaticAssets({
      entry: "src/main.ts",
      manifest: {
        "src/main.ts": {
          file: "assets/main.js",
          css: ["assets/main.css"],
          imports: ["_vendor.js", "_shared.js"],
        },
        "_vendor.js": {
          file: "assets/vendor.js",
          css: ["assets/vendor.css", "assets/shared.css"],
        },
        "_shared.js": {
          file: "assets/shared.js",
          css: ["assets/shared.css"],
        },
      },
    });

    expect(assets).toEqual({
      modulePreloads: [
        '<link rel="modulepreload" href="/assets/vendor.js">',
        '<link rel="modulepreload" href="/assets/shared.js">',
      ],
      stylesheets: [
        '<link rel="stylesheet" href="/assets/vendor.css">',
        '<link rel="stylesheet" href="/assets/shared.css">',
        '<link rel="stylesheet" href="/assets/main.css">',
      ],
      scripts: ['<script type="module" src="/assets/main.js"></script>'],
    });
  });

  it("walks recursive imports before their parents", () => {
    const assets = resolveStaticAssets({
      entry: "src/main.ts",
      manifest: {
        "src/main.ts": { file: "assets/main.js", imports: ["_feature.js"] },
        "_feature.js": { file: "assets/feature.js", imports: ["_vendor.js"] },
        "_vendor.js": { file: "assets/vendor.js" },
      },
    });

    expect(assets.modulePreloads).toEqual([
      '<link rel="modulepreload" href="/assets/vendor.js">',
      '<link rel="modulepreload" href="/assets/feature.js">',
    ]);
    expect(assets.scripts).toEqual(['<script type="module" src="/assets/main.js"></script>']);
  });

  it("normalizes custom base paths to one trailing slash", () => {
    const assets = resolveStaticAssets({
      base: "/docs/app//",
      entry: "src/main.ts",
      manifest: {
        "src/main.ts": {
          file: "/assets/main.js",
          css: ["/assets/main.css"],
          imports: ["_vendor.js"],
        },
        "_vendor.js": { file: "/assets/vendor.js" },
      },
    });

    expect(assets).toEqual({
      modulePreloads: ['<link rel="modulepreload" href="/docs/app/assets/vendor.js">'],
      stylesheets: ['<link rel="stylesheet" href="/docs/app/assets/main.css">'],
      scripts: ['<script type="module" src="/docs/app/assets/main.js"></script>'],
    });
  });

  it("escapes generated tag attributes", () => {
    const assets = resolveStaticAssets({
      entry: "src/main.ts",
      manifest: {
        "src/main.ts": {
          file: 'assets/main-"quoted".js',
          css: ['assets/main-"quoted".css'],
          imports: ["_vendor.js"],
        },
        "_vendor.js": {
          file: 'assets/vendor-"quoted".js',
        },
      },
    });

    expect(assets.modulePreloads).toEqual([
      '<link rel="modulepreload" href="/assets/vendor-&quot;quoted&quot;.js">',
    ]);
    expect(assets.stylesheets).toEqual([
      '<link rel="stylesheet" href="/assets/main-&quot;quoted&quot;.css">',
    ]);
    expect(assets.scripts).toEqual([
      '<script type="module" src="/assets/main-&quot;quoted&quot;.js"></script>',
    ]);
  });

  it("throws TypeError when the entry or an imported chunk is missing", () => {
    expect(() =>
      resolveStaticAssets({
        entry: "src/missing.ts",
        manifest: {},
      }),
    ).toThrow(TypeError);

    expect(() =>
      resolveStaticAssets({
        entry: "src/missing.ts",
        manifest: {},
      }),
    ).toThrow(/Static asset manifest entry not found: src\/missing\.ts/);

    expect(() =>
      resolveStaticAssets({
        entry: "src/main.ts",
        manifest: {
          "src/main.ts": { file: "assets/main.js", imports: ["_missing.js"] },
        },
      }),
    ).toThrow(TypeError);

    expect(() =>
      resolveStaticAssets({
        entry: "src/main.ts",
        manifest: {
          "src/main.ts": { file: "assets/main.js", imports: ["_missing.js"] },
        },
      }),
    ).toThrow(/Static asset manifest entry not found: _missing\.js/);
  });
});
