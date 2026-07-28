import type { Provides } from "../component/provide";
import type { RenderToStringSource } from "./render-to-string";
import { renderToString } from "./render-to-string";

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

export interface GenerateStaticSiteOptions {
  routes: StaticRoute[];
  shell?: (page: {
    path: string;
    body: string;
    styles: string[];
    context: Record<string, unknown>;
  }) => string;
}

export interface GenerateStaticSiteResult {
  pages: StaticPage[];
}

export function generateStaticSite(options: GenerateStaticSiteOptions): GenerateStaticSiteResult {
  assertNoDeferredIntegrationOptions(options);
  assertValidRoutes(options.routes);

  const seenPaths = new Set<string>();
  const pages = options.routes.map((route) => {
    if (!route.path.startsWith("/")) {
      throw new TypeError(`SSG route path must start with "/": ${route.path}`);
    }

    if (seenPaths.has(route.path)) {
      throw new TypeError(`Duplicate SSG route path: ${route.path}`);
    }

    seenPaths.add(route.path);

    const context = route.context ?? {};
    const rendered = renderToString(route.source, {
      context,
      provides: route.provides,
    });
    const body = rendered.html;
    const html = options.shell
      ? options.shell({
          path: route.path,
          body,
          styles: rendered.styles,
          context,
        })
      : body;

    return {
      path: route.path,
      html,
      body,
      styles: rendered.styles,
    };
  });

  return { pages };
}

function assertValidRoutes(routes: StaticRoute[]): void {
  if (!Array.isArray(routes) || routes.length === 0) {
    throw new TypeError("SSG routes must be a non-empty array");
  }
}

function assertNoDeferredIntegrationOptions(options: GenerateStaticSiteOptions): void {
  if (hasOwn(options, "manifest") || hasOwn(options, "clientEntry")) {
    throw new TypeError(
      "SSG manifest integration is deferred; compose assets in an app-local shell or adapter.",
    );
  }

  if (hasOwn(options, "router")) {
    throw new TypeError(
      "Router-aware SSG integration is deferred; pass explicit route sources instead.",
    );
  }
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
