# SSR/SSG Manifest Router Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic production asset manifest helpers and a router-aware SSG adapter without adding full router SSR, hydration, guards, nested routes, redirects, lazy routes, memory history, filesystem output, or Vite plugin behavior.

**Architecture:** Keep this as a server subpath composition layer. Add focused server helpers for asset tag resolution and router-to-`StaticRoute` conversion, wire manifest assets into `generateStaticSite()` shell input, and keep `renderToString()` as the synchronous renderer primitive with its deferred integration guards unchanged.

**Tech Stack:** TypeScript, Solace runtime/server APIs, beta router matcher/query helpers, Vitest, Rollup package build.

---

## File Structure

- Create `src/server/static-assets.ts`: owns manifest chunk types, base normalization, import traversal, CSS dedupe, and HTML tag generation.
- Create `src/server/static-router.ts`: owns `createStaticRoutesFromRouter()` and its input validation, using existing beta router matcher/query helpers.
- Modify `src/server/generate-static-site.ts`: adds app-level `manifest`, `clientEntry`, and `base` options; passes asset tags into shell input; keeps route-level deferred integration fields rejected.
- Modify `src/server/index.ts`: exports new server helpers and public types from the server subpath.
- Create `tests/unit/server/static-assets.test.ts`: covers manifest helper ordering, recursion, dedupe, base normalization, escaping, and errors.
- Create `tests/unit/server/static-router.test.ts`: covers adapter route conversion, normalized route context, dynamic params, wildcard records, user context/provides, and unmatched paths.
- Modify `tests/unit/server/generate-static-site.test.ts`: covers shell asset threading and partial manifest option errors.
- Modify `tests/unit/server/public-contract-types.test.ts`: updates TypeScript contract assertions for the new public server types and keeps unsupported contracts rejected.
- Modify `tests/integration/package-exports.test.ts`: updates built ESM/CJS server subpath surface and runtime boundary checks.
- Modify `docs/package-usage.md`, `docs/api.md`, `docs/api.zh-CN.md`, `docs/roadmap.md`, `docs/project-status.md`, `docs/project-status.zh-CN.md`, `readme.md`, and `readme.zh-CN.md`: document the supported helper slice and keep the deferred boundaries explicit.

### Task 1: Manifest Asset Helper

**Files:**

- Create: `src/server/static-assets.ts`
- Create: `tests/unit/server/static-assets.test.ts`
- Modify: `src/server/index.ts`

- [x] **Step 1: Write failing manifest helper tests**

Create `tests/unit/server/static-assets.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { resolveStaticAssets } from "../../../src/server";

describe("resolveStaticAssets", () => {
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
        },
      },
    });

    expect(assets.stylesheets).toEqual([
      '<link rel="stylesheet" href="/assets/main-&quot;quoted&quot;.css">',
    ]);
    expect(assets.scripts).toEqual([
      '<script type="module" src="/assets/main-&quot;quoted&quot;.js"></script>',
    ]);
  });

  it("throws when the entry or an imported chunk is missing", () => {
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
    ).toThrow(/Static asset manifest entry not found: _missing\.js/);
  });
});
```

- [x] **Step 2: Run the manifest helper tests to verify failure**

Run:

```bash
pnpm vitest run tests/unit/server/static-assets.test.ts
```

Expected: FAIL because `tests/unit/server/static-assets.test.ts` imports `resolveStaticAssets` before the helper is exported.

- [x] **Step 3: Implement the manifest helper**

Create `src/server/static-assets.ts`:

```ts
import { escapeAttribute } from "../shared/html";

export type StaticAssetManifest = Record<string, StaticAssetManifestChunk>;

export interface StaticAssetManifestChunk {
  file: string;
  css?: readonly string[];
  imports?: readonly string[];
}

export interface StaticAssetTags {
  modulePreloads: string[];
  stylesheets: string[];
  scripts: string[];
}

export interface ResolveStaticAssetOptions {
  manifest: StaticAssetManifest;
  entry: string;
  base?: string;
}

export function resolveStaticAssets(options: ResolveStaticAssetOptions): StaticAssetTags {
  const base = normalizeAssetBase(options.base ?? "/");
  const orderedChunkIds: string[] = [];
  const visited = new Set<string>();

  visitManifestChunk(options.manifest, options.entry, visited, orderedChunkIds);

  const cssFiles: string[] = [];
  const seenCss = new Set<string>();

  for (const chunkId of orderedChunkIds) {
    const chunk = options.manifest[chunkId];
    for (const cssFile of chunk.css ?? []) {
      if (seenCss.has(cssFile)) {
        continue;
      }

      seenCss.add(cssFile);
      cssFiles.push(cssFile);
    }
  }

  const importedChunkIds = orderedChunkIds.filter((chunkId) => chunkId !== options.entry);
  const entryChunk = options.manifest[options.entry];

  return {
    modulePreloads: importedChunkIds.map((chunkId) =>
      renderModulePreloadTag(joinAssetBase(base, options.manifest[chunkId].file)),
    ),
    stylesheets: cssFiles.map((file) => renderStylesheetTag(joinAssetBase(base, file))),
    scripts: [renderModuleScriptTag(joinAssetBase(base, entryChunk.file))],
  };
}

function visitManifestChunk(
  manifest: StaticAssetManifest,
  chunkId: string,
  visited: Set<string>,
  orderedChunkIds: string[],
): void {
  if (visited.has(chunkId)) {
    return;
  }

  const chunk = manifest[chunkId];
  if (chunk === undefined) {
    throw new TypeError(`Static asset manifest entry not found: ${chunkId}`);
  }

  visited.add(chunkId);

  for (const importedChunkId of chunk.imports ?? []) {
    visitManifestChunk(manifest, importedChunkId, visited, orderedChunkIds);
  }

  orderedChunkIds.push(chunkId);
}

function normalizeAssetBase(base: string): string {
  const withoutTrailingSlashes = base.replace(/\/+$/, "");
  return withoutTrailingSlashes === "" ? "/" : `${withoutTrailingSlashes}/`;
}

function joinAssetBase(base: string, file: string): string {
  return `${base}${file.replace(/^\/+/, "")}`;
}

function renderModulePreloadTag(href: string): string {
  return `<link rel="modulepreload" href="${escapeAttribute(href)}">`;
}

function renderStylesheetTag(href: string): string {
  return `<link rel="stylesheet" href="${escapeAttribute(href)}">`;
}

function renderModuleScriptTag(src: string): string {
  return `<script type="module" src="${escapeAttribute(src)}"></script>`;
}
```

Modify `src/server/index.ts` by adding these exports above or below the existing server exports:

```ts
export {
  resolveStaticAssets,
  type ResolveStaticAssetOptions,
  type StaticAssetManifest,
  type StaticAssetManifestChunk,
  type StaticAssetTags,
} from "./static-assets";
```

- [x] **Step 4: Run the manifest helper tests to verify pass**

Run:

```bash
pnpm vitest run tests/unit/server/static-assets.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit the manifest helper**

Run:

```bash
git add src/server/static-assets.ts src/server/index.ts tests/unit/server/static-assets.test.ts
git commit -m "feat: add static asset manifest helper"
```

Expected: one focused commit containing the helper, export, and helper tests.

### Task 2: SSG Shell Manifest Integration

**Files:**

- Modify: `src/server/generate-static-site.ts`
- Modify: `tests/unit/server/generate-static-site.test.ts`
- Modify: `tests/unit/server/public-contract-types.test.ts`

- [x] **Step 1: Add failing SSG manifest shell tests**

In `tests/unit/server/generate-static-site.test.ts`, update the first shell expectation objects to include empty asset tags:

```ts
assets: {
  modulePreloads: [],
  stylesheets: [],
  scripts: [],
},
```

Add this test inside `describe("generateStaticSite", () => { ... })`:

```ts
it("passes resolved manifest assets into custom shells", () => {
  const shell = vi.fn(({ body, assets }) => {
    return [
      "<!doctype html><html><head>",
      assets.modulePreloads.join(""),
      assets.stylesheets.join(""),
      "</head><body>",
      body,
      assets.scripts.join(""),
      "</body></html>",
    ].join("");
  });

  const site = generateStaticSite({
    routes: [{ path: "/", source: h("h1", null, "home") }],
    manifest: {
      "src/main.ts": {
        file: "assets/main.js",
        css: ["assets/main.css"],
        imports: ["_vendor.js"],
      },
      "_vendor.js": {
        file: "assets/vendor.js",
        css: ["assets/vendor.css"],
      },
    },
    clientEntry: "src/main.ts",
    base: "/app/",
    shell,
  });

  expect(shell).toHaveBeenCalledWith({
    path: "/",
    body: "<p>rendered</p>",
    styles: ["scoped.css"],
    context: {},
    assets: {
      modulePreloads: ['<link rel="modulepreload" href="/app/assets/vendor.js">'],
      stylesheets: [
        '<link rel="stylesheet" href="/app/assets/vendor.css">',
        '<link rel="stylesheet" href="/app/assets/main.css">',
      ],
      scripts: ['<script type="module" src="/app/assets/main.js"></script>'],
    },
  });
  expect(site.pages[0].html).toContain('<script type="module" src="/app/assets/main.js">');
});
```

Replace the existing app-level manifest/clientEntry rejection expectations in `"rejects deferred manifest and router integration options"` with partial option coverage:

```ts
expect(() =>
  generateStaticSite({
    routes: [{ path: "/", source: h("p", null, "home") }],
    manifest: {},
  } as never),
).toThrow(/SSG manifest integration requires both manifest and clientEntry/);

expect(() =>
  generateStaticSite({
    routes: [{ path: "/", source: h("p", null, "home") }],
    clientEntry: "/src/main.ts",
  } as never),
).toThrow(/SSG manifest integration requires both manifest and clientEntry/);
```

Keep the app-level `router` rejection expectation unchanged.

- [x] **Step 2: Add failing SSG public type assertions**

In `tests/unit/server/public-contract-types.test.ts`, update the server import:

```ts
import { resolveStaticAssets } from "../../../src/server";
import type {
  GenerateStaticSiteOptions,
  RenderToStringOptions,
  StaticAssetManifest,
  StaticAssetTags,
} from "../../../src/server";
```

Add these helpers and assertions below `acceptSSGOptions()`:

```ts
function acceptAssetManifest(manifest: StaticAssetManifest): StaticAssetManifest {
  return manifest;
}

function acceptAssetTags(tags: StaticAssetTags): StaticAssetTags {
  return tags;
}

const manifest = acceptAssetManifest({
  "src/main.ts": {
    file: "assets/main.js",
    css: ["assets/main.css"],
    imports: ["_vendor.js"],
  },
  "_vendor.js": {
    file: "assets/vendor.js",
  },
});

acceptSSGOptions({
  routes: [{ path: "/", source: h("p", null, "home") }],
  manifest,
  clientEntry: "src/main.ts",
  base: "/app/",
});

acceptAssetTags(resolveStaticAssets({ manifest, entry: "src/main.ts" }));
```

Delete these two old negative assertions because app-level SSG manifest options become supported when paired:

```ts
// @ts-expect-error production manifest integration is not part of the SSG public contract
acceptSSGOptions({ routes: [{ path: "/", source: h("p") }], manifest: {} });

// @ts-expect-error client entry inference is not part of the SSG public contract
acceptSSGOptions({ routes: [{ path: "/", source: h("p") }], clientEntry: "/src/main.ts" });
```

Add this shell assertion below the existing `acceptShell` success assertion:

```ts
acceptShell(({ assets }) => {
  return assets.modulePreloads.join("") + assets.stylesheets.join("") + assets.scripts.join("");
});
```

Keep the `renderToString()` manifest/clientEntry negative assertions unchanged.

- [x] **Step 3: Run targeted SSG tests to verify failure**

Run:

```bash
pnpm vitest run tests/unit/server/generate-static-site.test.ts tests/unit/server/public-contract-types.test.ts
```

Expected: FAIL because `GenerateStaticSiteOptions`, `StaticShellPage`, and implementation do not yet support `manifest`, `clientEntry`, `base`, or `assets`.

- [x] **Step 4: Implement SSG manifest shell integration**

Modify the top of `src/server/generate-static-site.ts`:

```ts
import type { Provides } from "../component/provide";
import type { RenderToStringSource } from "./render-to-string";
import { renderToString } from "./render-to-string";
import {
  resolveStaticAssets,
  type StaticAssetManifest,
  type StaticAssetTags,
} from "./static-assets";
```

Add `assets` to `StaticShellPage`:

```ts
export interface StaticShellPage {
  path: string;
  body: string;
  styles: readonly string[];
  context: Readonly<Record<string, unknown>>;
  assets: StaticAssetTags;
}
```

Extend `GenerateStaticSiteOptions`:

```ts
export interface GenerateStaticSiteOptions {
  routes: StaticRoute[];
  shell?: (page: StaticShellPage) => string;
  manifest?: StaticAssetManifest;
  clientEntry?: string;
  base?: string;
}
```

At the start of `generateStaticSite()`, after route validation, compute one immutable asset tag set:

```ts
const assets = resolveStaticSiteAssets(options);
```

Pass asset copies into the shell:

```ts
options.shell({
  path: route.path,
  body,
  styles: [...styles],
  context: { ...context },
  assets: cloneStaticAssetTags(assets),
});
```

Replace `assertNoDeferredIntegrationOptions()` with this implementation:

```ts
function assertNoDeferredIntegrationOptions(options: GenerateStaticSiteOptions): void {
  const hasManifest = hasOwn(options, "manifest");
  const hasClientEntry = hasOwn(options, "clientEntry");

  if (hasManifest !== hasClientEntry) {
    throw new TypeError("SSG manifest integration requires both manifest and clientEntry.");
  }

  if (hasOwn(options, "router")) {
    throw new TypeError(
      "Router-aware SSG integration is deferred; pass explicit route sources instead.",
    );
  }
}
```

Add these helper functions near the bottom of `src/server/generate-static-site.ts`:

```ts
function resolveStaticSiteAssets(options: GenerateStaticSiteOptions): StaticAssetTags {
  if (options.manifest === undefined || options.clientEntry === undefined) {
    return createEmptyStaticAssetTags();
  }

  return resolveStaticAssets({
    manifest: options.manifest,
    entry: options.clientEntry,
    base: options.base,
  });
}

function createEmptyStaticAssetTags(): StaticAssetTags {
  return {
    modulePreloads: [],
    stylesheets: [],
    scripts: [],
  };
}

function cloneStaticAssetTags(assets: StaticAssetTags): StaticAssetTags {
  return {
    modulePreloads: [...assets.modulePreloads],
    stylesheets: [...assets.stylesheets],
    scripts: [...assets.scripts],
  };
}
```

- [x] **Step 5: Run targeted SSG tests to verify pass**

Run:

```bash
pnpm vitest run tests/unit/server/generate-static-site.test.ts tests/unit/server/public-contract-types.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit the SSG manifest integration**

Run:

```bash
git add src/server/generate-static-site.ts tests/unit/server/generate-static-site.test.ts tests/unit/server/public-contract-types.test.ts
git commit -m "feat: pass manifest assets to ssg shells"
```

Expected: one focused commit containing the SSG shell integration.

### Task 3: Router-Aware SSG Adapter

**Files:**

- Create: `src/server/static-router.ts`
- Create: `tests/unit/server/static-router.test.ts`
- Modify: `src/server/index.ts`
- Modify: `tests/unit/server/public-contract-types.test.ts`

- [x] **Step 1: Write failing router-aware SSG adapter tests**

Create `tests/unit/server/static-router.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import { createStaticRoutesFromRouter } from "../../../src/server";
import type { RouteRecord } from "../../../src";

const Home = () => h("p", null, "home");
const User = () => h("p", null, "user");
const NotFound = () => h("p", null, "not found");

describe("createStaticRoutesFromRouter", () => {
  it("turns explicit paths into static routes using matched components", () => {
    const routes: RouteRecord[] = [
      { path: "/", component: Home },
      { path: "/users/:id", component: User },
    ];

    const staticRoutes = createStaticRoutesFromRouter({
      routes,
      paths: ["/", "/users/42?tab=profile"],
    });

    expect(staticRoutes).toHaveLength(2);
    expect(staticRoutes[0]).toMatchObject({
      path: "/",
      source: Home,
    });
    expect(staticRoutes[0].context?.route).toMatchObject({
      path: "/",
      fullPath: "/",
      params: {},
      query: {},
      matched: routes[0],
    });
    expect(staticRoutes[1]).toMatchObject({
      path: "/users/42?tab=profile",
      source: User,
    });
    expect(staticRoutes[1].context?.route).toMatchObject({
      path: "/users/42",
      fullPath: "/users/42?tab=profile",
      params: { id: "42" },
      query: { tab: "profile" },
      matched: routes[1],
    });
  });

  it("merges user context after the default route context and passes provides", () => {
    const ThemeKey = Symbol("theme");
    const routes: RouteRecord[] = [{ path: "/users/:id", component: User }];

    const [route] = createStaticRoutesFromRouter({
      routes,
      paths: ["/users/42?tab=profile"],
      context: (location) => ({
        route: "custom-route-value",
        title: `User ${location.params.id}`,
      }),
      provides: (location) => new Map([[ThemeKey, location.fullPath]]),
    });

    expect(route.context).toEqual({
      route: "custom-route-value",
      title: "User 42",
    });
    expect(route.provides).toEqual(new Map([[ThemeKey, "/users/42?tab=profile"]]));
  });

  it("uses wildcard routes for unmatched paths when supplied", () => {
    const routes: RouteRecord[] = [
      { path: "/", component: Home },
      { path: "/:pathMatch(.*)*", component: NotFound },
    ];

    const [route] = createStaticRoutesFromRouter({
      routes,
      paths: ["/missing/path"],
    });

    expect(route.path).toBe("/missing/path");
    expect(route.source).toBe(NotFound);
    expect(route.context?.route).toMatchObject({
      path: "/missing/path",
      fullPath: "/missing/path",
      params: { pathMatch: "missing/path" },
      matched: routes[1],
    });
  });

  it("throws for unmatched paths without a wildcard route", () => {
    expect(() =>
      createStaticRoutesFromRouter({
        routes: [{ path: "/", component: Home }],
        paths: ["/missing"],
      }),
    ).toThrow(/Static router path did not match any route: \/missing/);
  });

  it("rejects invalid adapter inputs", () => {
    expect(() =>
      createStaticRoutesFromRouter({
        routes: null,
        paths: ["/"],
      } as never),
    ).toThrow(/Static router routes must be an array/);

    expect(() =>
      createStaticRoutesFromRouter({
        routes: [{ path: "/", component: Home }],
        paths: [],
      }),
    ).toThrow(/Static router paths must be a non-empty array/);

    expect(() =>
      createStaticRoutesFromRouter({
        routes: [{ path: "/", component: Home }],
        paths: [42],
      } as never),
    ).toThrow(/Static router path must be a string/);
  });
});
```

- [x] **Step 2: Add failing router-aware public type assertions**

In `tests/unit/server/public-contract-types.test.ts`, update the root import:

```ts
import { h } from "../../../src";
import type { App, HydrationOptions, RouteLocationNormalized, RouteRecord } from "../../../src";
```

Update the server import to include adapter types:

```ts
import { createStaticRoutesFromRouter, resolveStaticAssets } from "../../../src/server";
import type {
  GenerateStaticSiteOptions,
  RenderToStringOptions,
  StaticAssetManifest,
  StaticAssetTags,
  StaticRouterOptions,
} from "../../../src/server";
```

Add these helpers:

```ts
function acceptStaticRouterOptions(options: StaticRouterOptions): StaticRouterOptions {
  return options;
}

function acceptRouteLocation(route: RouteLocationNormalized): RouteLocationNormalized {
  return route;
}
```

Add these type assertions after the manifest assertions:

```ts
const routeRecords: RouteRecord[] = [{ path: "/", component: () => h("p", null, "home") }];

acceptStaticRouterOptions({
  routes: routeRecords,
  paths: ["/"],
  context: (route) => ({ fullPath: acceptRouteLocation(route).fullPath }),
  provides: (route) => new Map([["route", route.fullPath]]),
});

acceptSSGOptions({
  routes: createStaticRoutesFromRouter({
    routes: routeRecords,
    paths: ["/"],
  }),
});
```

Keep this negative assertion unchanged:

```ts
// @ts-expect-error router-aware SSG adapters are exposed as createStaticRoutesFromRouter()
acceptSSGOptions({ routes: [{ path: "/", source: h("p") }], router: {} });
```

- [x] **Step 3: Run adapter tests to verify failure**

Run:

```bash
pnpm vitest run tests/unit/server/static-router.test.ts tests/unit/server/public-contract-types.test.ts
```

Expected: FAIL because `createStaticRoutesFromRouter` and `StaticRouterOptions` are not implemented or exported.

- [x] **Step 4: Implement the router-aware SSG adapter**

Create `src/server/static-router.ts`:

```ts
import type { Provides } from "../component/provide";
import { createMatcher, type Matcher } from "../router/matcher";
import { parseQuery, stringifyQuery } from "../router/query";
import type { RouteLocationNormalized, RouteRecord } from "../router/types";
import type { StaticRoute } from "./generate-static-site";

export interface StaticRouterOptions {
  routes: RouteRecord[];
  paths: string[];
  context?: (route: RouteLocationNormalized) => Record<string, unknown>;
  provides?: (route: RouteLocationNormalized) => Provides;
}

export function createStaticRoutesFromRouter(options: StaticRouterOptions): StaticRoute[] {
  assertStaticRouterOptions(options);
  const matcher = createMatcher(options.routes);

  return options.paths.map((path) => {
    if (typeof path !== "string") {
      throw new TypeError("Static router path must be a string");
    }

    const route = resolveStaticRouterPath(matcher, path);
    if (route.matched === null) {
      throw new TypeError(`Static router path did not match any route: ${path}`);
    }

    return {
      path: route.fullPath,
      source: route.matched.component,
      context: {
        route,
        ...(options.context?.(route) ?? {}),
      },
      provides: options.provides?.(route),
    };
  });
}

function assertStaticRouterOptions(options: StaticRouterOptions): void {
  if (!Array.isArray(options.routes)) {
    throw new TypeError("Static router routes must be an array");
  }

  if (!Array.isArray(options.paths) || options.paths.length === 0) {
    throw new TypeError("Static router paths must be a non-empty array");
  }
}

function resolveStaticRouterPath(matcher: Matcher, rawFullPath: string): RouteLocationNormalized {
  const fullPath = rawFullPath === "" ? "/" : rawFullPath;
  const queryStart = fullPath.indexOf("?");
  const rawPath = queryStart === -1 ? fullPath : fullPath.slice(0, queryStart);
  const rawSearch = queryStart === -1 ? "" : fullPath.slice(queryStart + 1);
  const match = matcher.resolve(rawPath || "/");
  const query = parseQuery(rawSearch);
  const search = stringifyQuery(query);

  return {
    path: match.path,
    fullPath: `${match.path}${search}`,
    query,
    params: match.params,
    matched: match.matched,
  };
}
```

Modify `src/server/index.ts`:

```ts
export { createStaticRoutesFromRouter, type StaticRouterOptions } from "./static-router";
```

- [x] **Step 5: Run adapter tests to verify pass**

Run:

```bash
pnpm vitest run tests/unit/server/static-router.test.ts tests/unit/server/public-contract-types.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit the router-aware SSG adapter**

Run:

```bash
git add src/server/static-router.ts src/server/index.ts tests/unit/server/static-router.test.ts tests/unit/server/public-contract-types.test.ts
git commit -m "feat: add router aware ssg adapter"
```

Expected: one focused commit containing the adapter and type contract coverage.

### Task 4: Runtime Package Export Contract

**Files:**

- Modify: `tests/integration/package-exports.test.ts`

- [x] **Step 1: Update failing built package export assertions**

In both server export surface checks in `tests/integration/package-exports.test.ts`, replace:

```ts
expect(Object.keys(server).sort()).toEqual(["generateStaticSite", "renderToString"]);
expect(server.generateStaticSite).toEqual(expect.any(Function));
expect(server.renderToString).toEqual(expect.any(Function));
```

with:

```ts
expect(Object.keys(server).sort()).toEqual([
  "createStaticRoutesFromRouter",
  "generateStaticSite",
  "renderToString",
  "resolveStaticAssets",
]);
expect(server.createStaticRoutesFromRouter).toEqual(expect.any(Function));
expect(server.generateStaticSite).toEqual(expect.any(Function));
expect(server.renderToString).toEqual(expect.any(Function));
expect(server.resolveStaticAssets).toEqual(expect.any(Function));
```

In `"enforces SSR and SSG manifest/router boundaries from the server subpath"`, import the root API for a real render source:

```ts
const api = await import("@italone/solace");
const server = await import("@italone/solace/server");
const source = () => api.h("p", null, "home");
```

Keep the three `renderToString()` rejection assertions unchanged.

Replace the app-level SSG manifest/clientEntry rejection assertions with this supported paired-manifest check:

```ts
const site = server.generateStaticSite({
  routes: [{ path: "/", source }],
  manifest: {
    "src/main.ts": {
      file: "assets/main.js",
      css: ["assets/main.css"],
    },
  },
  clientEntry: "src/main.ts",
  shell: ({ body, assets }) =>
    `<!doctype html><html><head>${assets.stylesheets.join("")}</head><body>${body}${assets.scripts.join("")}</body></html>`,
});

expect(site.pages[0].html).toContain('<link rel="stylesheet" href="/assets/main.css">');
expect(site.pages[0].html).toContain('<script type="module" src="/assets/main.js"></script>');
```

Add partial manifest option rejection checks after the supported check:

```ts
expect(() =>
  server.generateStaticSite({
    routes: [{ path: "/", source }],
    manifest: {},
  } as never),
).toThrow(/SSG manifest integration requires both manifest and clientEntry/);
expect(() =>
  server.generateStaticSite({
    routes: [{ path: "/", source }],
    clientEntry: "/src/main.ts",
  } as never),
).toThrow(/SSG manifest integration requires both manifest and clientEntry/);
```

Keep app-level `router` rejection and invalid route path rejection unchanged.

Add this adapter runtime check in the same test:

```ts
const staticRoutes = server.createStaticRoutesFromRouter({
  routes: [{ path: "/users/:id", component: source }],
  paths: ["/users/42?tab=profile"],
});

expect(staticRoutes[0]).toMatchObject({
  path: "/users/42?tab=profile",
  source,
});
expect(staticRoutes[0].context?.route).toMatchObject({
  path: "/users/42",
  fullPath: "/users/42?tab=profile",
  params: { id: "42" },
  query: { tab: "profile" },
});
```

- [x] **Step 2: Run package export integration test to verify failure before build**

Run:

```bash
pnpm vitest run --config vitest.package.config.ts tests/integration/package-exports.test.ts
```

Expected: FAIL if `dist/server.*` still reflects the old build artifacts.

- [x] **Step 3: Build package artifacts**

Run:

```bash
pnpm build
```

Expected: PASS and generated `dist/server.js`, `dist/server.cjs`, and `dist/server.d.ts` include the new server helper exports for package-export validation.

- [x] **Step 4: Run package export integration test to verify pass**

Run:

```bash
pnpm vitest run --config vitest.package.config.ts tests/integration/package-exports.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit package export coverage**

Run:

```bash
git add tests/integration/package-exports.test.ts
git commit -m "test: cover server manifest router exports"
```

Expected: one focused commit containing package export test updates. Generated `dist` artifacts stay untracked in this repository.

### Task 5: Public Documentation Updates

**Files:**

- Modify: `docs/package-usage.md`
- Modify: `docs/api.md`
- Modify: `docs/api.zh-CN.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/project-status.md`
- Modify: `docs/project-status.zh-CN.md`
- Modify: `readme.md`
- Modify: `readme.zh-CN.md`

- [x] **Step 1: Update English usage docs**

In `docs/package-usage.md`, update the server import example to:

```ts
import {
  createStaticRoutesFromRouter,
  generateStaticSite,
  renderToString,
  resolveStaticAssets,
} from "@italone/solace/server";
```

Replace the paragraph that says production asset manifest integration and router-aware SSG adapters are absent with:

```md
This minimum loop includes synchronous `renderToString()`, in-memory SSG through
`generateStaticSite()`, server-side style collection, hydration-safe style dedupe, production asset
tag resolution through `resolveStaticAssets()`, and an explicit-path router-to-SSG adapter through
`createStaticRoutesFromRouter()`. It does not include streaming SSR, async component SSR, filesystem
SSG output, route crawling, router-aware SSR, router-aware hydration, or automatic hydration
mismatch recovery beyond the explicit `recover` deopt.
```

Replace the paragraph that says `manifest`, `clientEntry`, and `router` all throw on `generateStaticSite()` with:

```md
Passing only one of `manifest` or `clientEntry` to `generateStaticSite()` throws a `TypeError`; pass
both to make the shell receive resolved production asset tags. Route-level `manifest`,
`clientEntry`, and `router` fields are rejected. App-level `router` remains unsupported; convert
beta router records with `createStaticRoutesFromRouter()` and pass the returned explicit routes.
Route paths must be strings before rendering starts, so malformed SSG route inputs fail with a stable
`TypeError`.
```

Add this example after the existing `generateStaticSite()` shell example:

```ts
const assets = resolveStaticAssets({
  manifest: {
    "src/main.ts": {
      file: "assets/main.js",
      css: ["assets/main.css"],
      imports: ["_vendor.js"],
    },
    "_vendor.js": {
      file: "assets/vendor.js",
    },
  },
  entry: "src/main.ts",
  base: "/app/",
});

assets.modulePreloads;
assets.stylesheets;
assets.scripts;
```

Add this router-aware SSG example before `## Use The Beta Router`:

```ts
const staticRoutes = createStaticRoutesFromRouter({
  routes: [
    { path: "/", component: App },
    { path: "/users/:id", component: UserPage },
    { path: "/:pathMatch(.*)*", component: NotFound },
  ],
  paths: ["/", "/users/42?tab=profile", "/missing"],
  context: (route) => ({ route }),
});

generateStaticSite({ routes: staticRoutes });
```

- [x] **Step 2: Update English API docs**

In `docs/api.md`, update the server import block to include the two new helpers:

```ts
import {
  createStaticRoutesFromRouter,
  generateStaticSite,
  renderToString,
  resolveStaticAssets,
} from "@italone/solace/server";
```

Replace:

```md
Streaming SSR, async component SSR, SSG CLI, production manifest integration, hydration mismatch
auto-recovery beyond the explicit `recover` deopt, and router SSR/SSG/hydration integration remain
deferred.
```

with:

```md
Streaming SSR, async component SSR, SSG CLI, filesystem output, route crawling, hydration mismatch
auto-recovery beyond the explicit `recover` deopt, router-aware SSR, and router-aware hydration
remain deferred.
```

In the `generateStaticSite(options)` section, add:

```md
When app-level `manifest` and `clientEntry` are provided together, `generateStaticSite()` resolves
production asset tags once and passes them to each shell as `assets`. The shell owns placement of
`assets.modulePreloads`, `assets.stylesheets`, collected `styles`, and `assets.scripts`.
Supplying only `manifest` or only `clientEntry` throws a `TypeError`. Route-level `manifest` and
`clientEntry` fields remain rejected.
```

Add a new section after the `generateStaticSite(options)` section:

```md
### `resolveStaticAssets(options)`

`resolveStaticAssets({ manifest, entry, base })` converts a Vite-like production manifest and a
client entry id into complete HTML tag strings. Imported chunks are walked before the entry chunk,
CSS files are deduped in first-seen order, imported JavaScript files become `modulepreload` links,
and the entry file becomes the single module script. `base` defaults to `/` and is normalized to one
trailing slash.

### `createStaticRoutesFromRouter(options)`

`createStaticRoutesFromRouter({ routes, paths })` converts beta router records and explicit concrete
paths into `generateStaticSite()` routes. Each generated route renders the matched component and gets
a default `{ route }` context containing `{ path, fullPath, query, params, matched }`. Optional
`context(route)` shallow-merges after the default context, and optional `provides(route)` is passed
to `renderToString()` for that route.

This adapter does not install the router plugin, does not enable `useRoute()` during SSR, does not
render nested `RouterView` trees, and does not crawl or infer dynamic params. Use explicit paths such
as `/users/42`; do not pass `/users/:id` as a path to render.
```

- [x] **Step 3: Update Chinese API docs**

In `docs/api.zh-CN.md`, make the matching server import example include:

```ts
import {
  createStaticRoutesFromRouter,
  generateStaticSite,
  renderToString,
  resolveStaticAssets,
} from "@italone/solace/server";
```

Replace the deferred SSR/SSG sentence with:

```md
Streaming SSR、async component SSR、SSG CLI、filesystem output、route crawling、显式
`recover` deopt 之外的 hydration mismatch 自动恢复、router-aware SSR 和 router-aware
hydration 仍保持 deferred。
```

Add these paragraphs to the `generateStaticSite(options)` section:

```md
当 app-level `manifest` 和 `clientEntry` 成对提供时，`generateStaticSite()` 会解析生产 asset
tags，并在每次 shell 调用中通过 `assets` 传入。shell 负责放置
`assets.modulePreloads`、`assets.stylesheets`、收集到的 `styles` 和 `assets.scripts`。
只传 `manifest` 或只传 `clientEntry` 会抛出 `TypeError`。route-level `manifest` 和
`clientEntry` 字段仍会被拒绝。
```

Add a new section after `generateStaticSite(options)`:

```md
### `resolveStaticAssets(options)`

`resolveStaticAssets({ manifest, entry, base })` 会把 Vite-like production manifest 和 client
entry id 转换为完整 HTML tag 字符串。imported chunks 会先于 entry chunk 遍历，CSS 会按首次出现
顺序去重，imported JavaScript 文件会生成 `modulepreload` links，entry 文件会生成唯一 module
script。`base` 默认为 `/`，并规范化为一个 trailing slash。

### `createStaticRoutesFromRouter(options)`

`createStaticRoutesFromRouter({ routes, paths })` 会把 beta router records 和显式 concrete
paths 转换为 `generateStaticSite()` routes。每个生成 route 渲染 matched component，并得到默认
`{ route }` context，其中包含 `{ path, fullPath, query, params, matched }`。可选
`context(route)` 会在默认 context 后浅合并，可选 `provides(route)` 会传给该 route 的
`renderToString()`。

该 adapter 不安装 router plugin，不让 `useRoute()` 在 SSR 中生效，不渲染 nested `RouterView`
trees，也不会 crawl 或推断 dynamic params。需要传入 `/users/42` 这类显式 path，不要把
`/users/:id` 当作待渲染 path。
```

- [x] **Step 4: Update status, roadmap, and README boundaries**

In `readme.md`, replace `production asset manifest integration` in the alpha scope paragraph with `full production SSR pipeline automation`, and add that the current alpha includes `production asset tag resolution and explicit-path router-aware SSG helpers through @italone/solace/server`.

In `readme.zh-CN.md`, make the parallel Chinese update: state that alpha includes `@italone/solace/server` 中的 production asset tag resolution 和 explicit-path router-aware SSG helpers, while full production SSR pipeline automation remains absent.

In `docs/roadmap.md`, update the router beta stabilization item so it defers `SSR/hydration integration` rather than `SSR/SSG/hydration integration`, and update the SSG core item to say manifest helper and explicit-path router adapter exist while filesystem output and route crawling remain deferred.

In `docs/project-status.md`, update the SSR/hydration row to mention `resolveStaticAssets()` and `createStaticRoutesFromRouter()` as supported server helpers, and update known gaps so they defer streaming SSR, async SSR beyond explicit rejection, filesystem SSG output, route crawling, router-aware SSR, and router-aware hydration.

In `docs/project-status.zh-CN.md`, make the parallel Chinese status and known-gap updates.

- [x] **Step 5: Format changed docs**

Run:

```bash
pnpm exec prettier --write docs/package-usage.md docs/api.md docs/api.zh-CN.md docs/roadmap.md docs/project-status.md docs/project-status.zh-CN.md readme.md readme.zh-CN.md
```

Expected: Prettier completes and rewrites only formatting needed for the listed docs.

- [x] **Step 6: Commit documentation**

Run:

```bash
git add docs/package-usage.md docs/api.md docs/api.zh-CN.md docs/roadmap.md docs/project-status.md docs/project-status.zh-CN.md readme.md readme.zh-CN.md
git commit -m "docs: document manifest router ssg helpers"
```

Expected: one focused documentation commit.

### Task 6: Final Validation

**Files:**

- Validate: `src/server/static-assets.ts`
- Validate: `src/server/static-router.ts`
- Validate: `src/server/generate-static-site.ts`
- Validate: `src/server/index.ts`
- Validate: `tests/unit/server/**`
- Validate: `tests/integration/package-exports.test.ts`
- Validate: `docs/package-usage.md`
- Validate: `docs/api.md`
- Validate: `docs/api.zh-CN.md`
- Validate: `docs/roadmap.md`
- Validate: `docs/project-status.md`
- Validate: `docs/project-status.zh-CN.md`
- Validate: `readme.md`
- Validate: `readme.zh-CN.md`

- [x] **Step 1: Run targeted server and router unit tests**

Run:

```bash
pnpm vitest run tests/unit/server/static-assets.test.ts tests/unit/server/static-router.test.ts tests/unit/server/generate-static-site.test.ts tests/unit/server/render-to-string.test.ts tests/unit/router
```

Expected: PASS. `renderToString()` manifest/router rejection tests remain passing.

- [x] **Step 2: Run public type contract tests**

Run:

```bash
pnpm vitest run tests/unit/server/public-contract-types.test.ts
```

Expected: PASS with the new SSG manifest and router adapter public types accepted, while unsupported `renderToString()` and direct `GenerateStaticSiteOptions.router` fields remain rejected by `@ts-expect-error`.

- [x] **Step 3: Run TypeScript typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [x] **Step 4: Rebuild package artifacts**

Run:

```bash
pnpm build
```

Expected: PASS and generated server subpath declarations include `resolveStaticAssets`, `createStaticRoutesFromRouter`, and their public types.

- [x] **Step 5: Run package export integration checks**

Run:

```bash
pnpm vitest run --config vitest.package.config.ts tests/integration/package-exports.test.ts
```

Expected: PASS for ESM and CJS imports of the expanded server subpath.

- [x] **Step 6: Check formatting and lint-adjacent whitespace**

Run:

```bash
git diff --check
```

Expected: no output and exit code 0.

- [x] **Step 7: Review final diff**

Run:

```bash
git status --short
git diff --stat HEAD
```

Expected: either a clean worktree after the task commits, or only intentional final validation artifacts. No files outside the SSR/SSG manifest/router-aware scope are modified.

- [x] **Step 8: Commit any final validation-only adjustments**

If Step 7 shows intentional uncommitted changes from formatting or rebuilt package artifacts, run:

```bash
git add src/server tests/unit/server tests/integration/package-exports.test.ts docs/package-usage.md docs/api.md docs/api.zh-CN.md docs/roadmap.md docs/project-status.md docs/project-status.zh-CN.md readme.md readme.zh-CN.md
git commit -m "chore: finalize manifest router ssg integration"
```

Expected: no commit is created when Step 7 is already clean; otherwise one final scoped cleanup commit is created.

## Self-Review Notes

- Spec coverage: Task 1 covers deterministic manifest asset tags; Task 2 covers `generateStaticSite()` manifest shell integration and partial option rejection; Task 3 covers router-aware SSG adapter behavior; Task 4 covers package exports; Task 5 covers docs; Task 6 covers validation.
- Deferred boundaries: `renderToString()` remains unchanged except for tests confirming its existing rejection behavior. The plan does not add memory history, router guards, nested routes, redirects, lazy components, auth, permissions, filesystem output, route crawling, Vite plugin behavior, or router-aware hydration.
- Type consistency: `StaticAssetManifest`, `StaticAssetTags`, `ResolveStaticAssetOptions`, and `StaticRouterOptions` are exported from `@italone/solace/server`; route records and normalized route types remain rooted in the existing beta router contract.
