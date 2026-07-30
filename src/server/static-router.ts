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
  if (!Array.isArray(options?.routes)) {
    throw new TypeError("Static router routes must be an array");
  }

  if (!Array.isArray(options.paths) || options.paths.length === 0) {
    throw new TypeError("Static router paths must be a non-empty array");
  }
}

function resolveStaticRouterPath(matcher: Matcher, rawFullPath: string): RouteLocationNormalized {
  const searchIndex = rawFullPath.indexOf("?");
  const rawPath = searchIndex === -1 ? rawFullPath : rawFullPath.slice(0, searchIndex);
  const rawSearch = searchIndex === -1 ? "" : rawFullPath.slice(searchIndex);
  const resolved = matcher.resolve(rawPath || "/");
  const query = parseQuery(rawSearch);
  const fullPath = `${resolved.path}${stringifyQuery(query)}`;

  return {
    ...resolved,
    fullPath,
    query,
  };
}
