import type { Provides } from "../component/provide";
import type { RenderToStringSource } from "./render-to-string";
import { renderToString } from "./render-to-string";
import {
  resolveStaticAssets,
  type StaticAssetManifest,
  type StaticAssetTags,
} from "./static-assets";

export interface StaticRoute {
  path: string;
  source: RenderToStringSource;
  context?: Record<string, unknown>;
  provides?: Provides;
}

export interface StaticPage {
  path: string;
  html: string;
  body: string;
  styles: string[];
}

export interface StaticShellPage {
  path: string;
  body: string;
  styles: readonly string[];
  assets: StaticAssetTags;
  context: Readonly<Record<string, unknown>>;
}

export interface GenerateStaticSiteOptions {
  routes: StaticRoute[];
  shell?: (page: StaticShellPage) => string;
  manifest?: StaticAssetManifest;
  clientEntry?: string;
  base?: string;
}

export interface GenerateStaticSiteResult {
  pages: StaticPage[];
}

export function generateStaticSite(options: GenerateStaticSiteOptions): GenerateStaticSiteResult {
  assertNoDeferredIntegrationOptions(options);
  assertValidRoutes(options.routes);

  const assets = resolveStaticSiteAssets(options);
  const seenPaths = new Set<string>();
  const pages = options.routes.map((route) => {
    assertNoDeferredRouteIntegrationOptions(route);
    assertStaticRouteContext(route.context);
    assertStaticRouteProvides(route.provides);

    if (typeof route.path !== "string") {
      throw new TypeError("SSG route path must be a string");
    }

    if (!route.path.startsWith("/")) {
      throw new TypeError(`SSG route path must start with "/": ${route.path}`);
    }

    if (seenPaths.has(route.path)) {
      throw new TypeError(`Duplicate SSG route path: ${route.path}`);
    }

    seenPaths.add(route.path);

    const context = { ...(route.context ?? {}) };
    const rendered = renderToString(route.source, {
      context: { ...context },
      provides: route.provides,
    });
    const body = rendered.html;
    const styles = [...rendered.styles];
    const html = options.shell
      ? options.shell({
          path: route.path,
          body,
          styles: [...styles],
          assets: cloneStaticAssetTags(assets),
          context: { ...context },
        })
      : body;

    return {
      path: route.path,
      html,
      body,
      styles,
    };
  });

  return { pages };
}

function assertValidRoutes(routes: StaticRoute[]): void {
  if (!Array.isArray(routes) || routes.length === 0) {
    throw new TypeError("SSG routes must be a non-empty array");
  }

  for (let index = 0; index < routes.length; index += 1) {
    if (!(index in routes)) {
      throw new TypeError("SSG routes must not be sparse");
    }

    assertStaticRouteRecord(routes[index]);
  }
}

function assertStaticRouteRecord(route: unknown): asserts route is StaticRoute {
  if (route === null || typeof route !== "object" || Array.isArray(route)) {
    throw new TypeError("SSG route must be an object");
  }
}

function assertNoDeferredIntegrationOptions(options: GenerateStaticSiteOptions): void {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("SSG options must be an object");
  }

  if (options.shell !== undefined && typeof options.shell !== "function") {
    throw new TypeError("SSG shell must be a function");
  }

  if ((options.manifest === undefined) !== (options.clientEntry === undefined)) {
    throw new TypeError("SSG manifest integration requires both manifest and clientEntry.");
  }

  if (hasOwn(options, "router")) {
    throw new TypeError(
      "Router-aware SSG integration is deferred; pass explicit route sources instead.",
    );
  }
}

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
  return { modulePreloads: [], stylesheets: [], scripts: [] };
}

function cloneStaticAssetTags(assets: StaticAssetTags): StaticAssetTags {
  return {
    modulePreloads: [...assets.modulePreloads],
    stylesheets: [...assets.stylesheets],
    scripts: [...assets.scripts],
  };
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function assertNoDeferredRouteIntegrationOptions(route: StaticRoute): void {
  if (hasOwn(route, "manifest") || hasOwn(route, "clientEntry")) {
    throw new TypeError(
      "SSG route manifest integration is deferred; compose assets in an app-local shell or adapter.",
    );
  }

  if (hasOwn(route, "router")) {
    throw new TypeError(
      "Router-aware SSG route integration is deferred; pass explicit route sources instead.",
    );
  }
}

function assertStaticRouteContext(
  context: unknown,
): asserts context is Record<string, unknown> | undefined {
  if (context === undefined) {
    return;
  }

  if (context === null || typeof context !== "object" || Array.isArray(context)) {
    throw new TypeError("SSG route context must be a plain object");
  }

  const prototype = Object.getPrototypeOf(context);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("SSG route context must be a plain object");
  }
}

function assertStaticRouteProvides(provides: unknown): asserts provides is Provides | undefined {
  if (provides !== undefined && !(provides instanceof Map)) {
    throw new TypeError("SSG route provides must be a Map");
  }
}
