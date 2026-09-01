import type { Provides } from "../component/provide";
import type { RenderToStringAsyncSource, RenderToStringSource } from "./render-to-string";
import { renderToString, renderToStringAsync } from "./render-to-string";
import { assertRouterSSGOption, type RouterSSGOptions } from "./router-ssr";
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

export interface AsyncStaticRoute extends Omit<StaticRoute, "source"> {
  source: RenderToStringAsyncSource;
  router?: RouterSSGOptions;
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

export interface GenerateStaticSiteAsyncOptions extends Omit<GenerateStaticSiteOptions, "routes"> {
  routes: readonly AsyncStaticRoute[];
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
    assertStaticRoutePath(route.path, seenPaths);

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

    if (typeof html !== "string") {
      throw new TypeError("SSG shell must return a string");
    }

    return {
      path: route.path,
      html,
      body,
      styles,
    };
  });

  return { pages };
}

export async function generateStaticSiteAsync(
  options: GenerateStaticSiteAsyncOptions,
): Promise<GenerateStaticSiteResult> {
  assertNoDeferredIntegrationOptions(options);
  assertValidRoutes(options.routes);

  const assets = resolveStaticSiteAssets(options);
  const seenPaths = new Set<string>();
  const pages: StaticPage[] = [];

  for (const route of options.routes) {
    assertAsyncRouteIntegrationOptions(route);
    assertStaticRouteContext(route.context);
    assertStaticRouteProvides(route.provides);
    assertStaticRoutePath(route.path, seenPaths);

    const context = { ...(route.context ?? {}) };
    const rendered =
      route.router !== undefined
        ? await renderToStringAsync(route.source, {
            router: { url: route.path, ...route.router },
          })
        : await renderToStringAsync(route.source, {
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

    if (typeof html !== "string") {
      throw new TypeError("SSG shell must return a string");
    }

    pages.push({ path: route.path, html, body, styles });
  }

  return { pages };
}

function assertValidRoutes(routes: readonly (StaticRoute | AsyncStaticRoute)[]): void {
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

function assertStaticRouteRecord(route: unknown): asserts route is StaticRoute | AsyncStaticRoute {
  if (route === null || typeof route !== "object" || Array.isArray(route)) {
    throw new TypeError("SSG route must be an object");
  }
}

function assertNoDeferredIntegrationOptions(
  options: GenerateStaticSiteOptions | GenerateStaticSiteAsyncOptions,
): void {
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

  const unknownKey = Reflect.ownKeys(options).find(
    (key) =>
      key !== "routes" &&
      key !== "shell" &&
      key !== "manifest" &&
      key !== "clientEntry" &&
      key !== "base",
  );
  if (unknownKey !== undefined) {
    throw new TypeError(`Unknown SSG option: ${String(unknownKey)}`);
  }
}

function resolveStaticSiteAssets(
  options: GenerateStaticSiteOptions | GenerateStaticSiteAsyncOptions,
): StaticAssetTags {
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

function assertNoDeferredRouteIntegrationOptions(route: StaticRoute | AsyncStaticRoute): void {
  if (hasOwn(route, "manifest") || hasOwn(route, "clientEntry")) {
    throw new TypeError(
      "SSG route manifest integration is deferred; compose assets in an app-local shell or adapter.",
    );
  }

  if (hasOwn(route, "router")) {
    throw new TypeError(
      "Router-aware SSG route integration is deferred on the synchronous entry; use generateStaticSiteAsync().",
    );
  }

  const unknownKey = Reflect.ownKeys(route).find(
    (key) => key !== "path" && key !== "source" && key !== "context" && key !== "provides",
  );
  if (unknownKey !== undefined) {
    throw new TypeError(`Unknown SSG route field: ${String(unknownKey)}`);
  }
}

function assertAsyncRouteIntegrationOptions(route: AsyncStaticRoute): void {
  if (hasOwn(route, "manifest") || hasOwn(route, "clientEntry")) {
    throw new TypeError(
      "SSG route manifest integration is deferred; compose assets in an app-local shell or adapter.",
    );
  }

  if (route.router !== undefined) {
    assertRouterSSGOption(route.router);
  }

  const unknownKey = Reflect.ownKeys(route).find(
    (key) =>
      key !== "path" &&
      key !== "source" &&
      key !== "context" &&
      key !== "provides" &&
      key !== "router",
  );
  if (unknownKey !== undefined) {
    throw new TypeError(`Unknown SSG route field: ${String(unknownKey)}`);
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

function assertStaticRoutePath(path: unknown, seenPaths: Set<string>): asserts path is string {
  if (typeof path !== "string") {
    throw new TypeError("SSG route path must be a string");
  }

  if (!path.startsWith("/")) {
    throw new TypeError(`SSG route path must start with "/": ${path}`);
  }

  if (seenPaths.has(path)) {
    throw new TypeError(`Duplicate SSG route path: ${path}`);
  }

  seenPaths.add(path);
}
