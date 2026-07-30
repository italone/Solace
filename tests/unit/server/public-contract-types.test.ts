import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import type { App, HydrationOptions } from "../../../src";
import { resolveStaticAssets } from "../../../src/server";
import type {
  GenerateStaticSiteOptions,
  RenderToStringOptions,
  StaticAssetManifest,
  StaticAssetTags,
} from "../../../src/server";

function acceptHydrationOptions(options: HydrationOptions): HydrationOptions {
  return options;
}

function acceptAppHydrate(app: App, container: Element): App {
  app.hydrate(container, { recover: true });
  return app;
}

function acceptSSGOptions(options: GenerateStaticSiteOptions): GenerateStaticSiteOptions {
  return options;
}

function acceptRenderOptions(options: RenderToStringOptions): RenderToStringOptions {
  return options;
}

function acceptStaticAssetManifest(manifest: StaticAssetManifest): StaticAssetManifest {
  return manifest;
}

function acceptStaticAssetTags(tags: StaticAssetTags): StaticAssetTags {
  return tags;
}

function acceptShell(shell: NonNullable<GenerateStaticSiteOptions["shell"]>) {
  return shell;
}

const manifest = acceptStaticAssetManifest({
  "/src/main.ts": {
    file: "assets/main.js",
    css: ["assets/main.css"],
    imports: ["_vendor.js"],
  },
  "_vendor.js": {
    file: "assets/vendor.js",
  },
});

const assetTags = acceptStaticAssetTags(
  resolveStaticAssets({
    manifest,
    entry: "/src/main.ts",
    base: "/app/",
  }),
);

acceptSSGOptions({
  routes: [{ path: "/", source: h("p", null, "home") }],
});

acceptSSGOptions({
  routes: [{ path: "/", source: h("p", null, "home") }],
  manifest,
  clientEntry: "/src/main.ts",
  base: "/app/",
});

acceptRenderOptions({
  context: { title: "Home" },
});

acceptHydrationOptions({});
acceptHydrationOptions({ recover: true });

// @ts-expect-error hydration recovery is boolean-only
acceptHydrationOptions({ recover: "yes" });

// @ts-expect-error production manifest integration is not part of the hydration public contract
acceptHydrationOptions({ manifest: {} });

// @ts-expect-error router-aware SSG adapters are deferred
acceptSSGOptions({ routes: [{ path: "/", source: h("p") }], router: {} });

// @ts-expect-error renderToString does not read production manifests
acceptRenderOptions({ manifest: {} });

// @ts-expect-error renderToString does not infer client entries
acceptRenderOptions({ clientEntry: "/src/main.ts" });

// @ts-expect-error router-aware SSR integration is deferred
acceptRenderOptions({ router: {} });

acceptShell(({ path, body, styles, context, assets }) => {
  return `${path}:${body}:${styles.join("")}:${assets.modulePreloads.join("")}:${assets.stylesheets.join("")}:${assets.scripts.join("")}:${String(context.title ?? "")}`;
});

acceptShell(({ styles }) => {
  // @ts-expect-error shell styles are read-only
  styles.push("mutated");
  return "";
});

acceptShell(({ context }) => {
  // @ts-expect-error shell context is read-only
  context.title = "mutated";
  return "";
});

describe("server public contract types", () => {
  it("keeps manifest assets in SSG and deferred integration out of SSR", () => {
    expect(acceptAppHydrate).toEqual(expect.any(Function));
    expect(assetTags).toEqual(
      expect.objectContaining({
        modulePreloads: expect.any(Array),
        stylesheets: expect.any(Array),
        scripts: expect.any(Array),
      }),
    );
    expect(true).toBe(true);
  });
});
