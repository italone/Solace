import { describe, expect, it } from "vitest";

import { createApp, h } from "../../../src";
import type { App, HydrationOptions, RouteLocationNormalized } from "../../../src";
import type { AsyncComponentType, AsyncVNodeChild, AsyncVNodeChildren } from "../../../src";
import { createStaticRoutesFromRouter, resolveStaticAssets } from "../../../src/server";
import type {
  GenerateStaticSiteOptions,
  RenderToStringOptions,
  StaticRouterOptions,
  StaticRouterRouteRecord,
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

function acceptAppHydrateAsync(app: App, container: Element): Promise<void> {
  return app.hydrateAsync(container);
}

const AsyncRoot: AsyncComponentType = async () => () => h("p", null, "async");
const asyncChild: AsyncVNodeChild = Promise.resolve(h("span", null, "child"));
const asyncChildren: AsyncVNodeChildren = [h("span", null, "sync"), asyncChild];

createApp(AsyncRoot);
h("div", null, asyncChildren);

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

function acceptStaticRouterOptions(options: StaticRouterOptions): StaticRouterOptions {
  return options;
}

function acceptRouteCallback(callback: NonNullable<StaticRouterOptions["context"]>) {
  return callback;
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

const typedRoutes: StaticRouterRouteRecord[] = [
  { path: "/", component: () => h("p", null, "home") },
];
const staticRouterOptions = acceptStaticRouterOptions({
  routes: typedRoutes,
  paths: ["/"],
  context(route: RouteLocationNormalized) {
    return { current: route.fullPath };
  },
  provides(route) {
    return new Map([[Symbol.for("route"), route.path]]);
  },
});

acceptRouteCallback((route) => ({ path: route.path, matched: route.matched }));

acceptSSGOptions({
  routes: createStaticRoutesFromRouter(staticRouterOptions),
});

// @ts-expect-error static router routes require eager function components
acceptStaticRouterOptions({ routes: [{ path: "/group", component: null }], paths: ["/group"] });

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

// @ts-expect-error streaming hydration integration is deferred
acceptHydrationOptions({ stream: true });

function acceptAsyncHydrationRootComponent(): void {
  createApp(async () => h("p", null, "async")).hydrate(document.createElement("main"));
}

// @ts-expect-error direct GenerateStaticSiteOptions.router is unsupported; router-aware SSG adapters are exposed as createStaticRoutesFromRouter()
acceptSSGOptions({ routes: [{ path: "/", source: h("p") }], router: {} });

// @ts-expect-error renderToString does not read production manifests
acceptRenderOptions({ manifest: {} });

// @ts-expect-error renderToString does not infer client entries
acceptRenderOptions({ clientEntry: "/src/main.ts" });

// @ts-expect-error router-aware SSR integration is deferred
acceptRenderOptions({ router: {} });

// @ts-expect-error streaming SSR integration is deferred
acceptRenderOptions({ stream: true });

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
    expect(acceptAppHydrateAsync).toEqual(expect.any(Function));
    expect(acceptAsyncHydrationRootComponent).toEqual(expect.any(Function));
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
