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
    if (route.matched.length === 0) {
      throw new TypeError(`Static router path did not match any route: ${path}`);
    }
    const source = resolveStaticRouteSource(route);

    return {
      path: route.fullPath,
      source,
      context: {
        route,
        ...(options.context?.(route) ?? {}),
      },
      provides: options.provides?.(route),
    };
  });
}

function assertStaticRouterOptions(options: StaticRouterOptions): void {
  if (options === null || typeof options !== "object") {
    throw new TypeError("Static router options must be an object");
  }

  for (const key of Object.keys(options)) {
    if (key !== "routes" && key !== "paths" && key !== "context" && key !== "provides") {
      throw new TypeError(`Deferred static router option is not part of the beta contract: ${key}`);
    }
  }

  if (!Array.isArray(options.routes)) {
    throw new TypeError("Static router routes must be an array");
  }

  for (const route of options.routes) {
    assertStaticRouterRouteRecord(route);
  }

  if (!Array.isArray(options.paths) || options.paths.length === 0) {
    throw new TypeError("Static router paths must be a non-empty array");
  }
}

function assertStaticRouterRouteRecord(route: RouteRecord): void {
  if (route === null || typeof route !== "object") {
    throw new TypeError("Static router route record must be an object");
  }

  for (const key of Object.keys(route)) {
    if (key !== "path" && key !== "component") {
      throw new TypeError(
        `Deferred static router route record field is not part of the beta contract: ${key}`,
      );
    }
  }

  if (typeof route.path !== "string") {
    throw new TypeError("Static router route record path must be a string");
  }

  if (typeof route.component !== "function") {
    throw new TypeError("Static router route record component must be a function");
  }
}

function resolveStaticRouterPath(matcher: Matcher, rawFullPath: string): RouteLocationNormalized {
  const searchIndex = rawFullPath.indexOf("?");
  const rawPath = searchIndex === -1 ? rawFullPath : rawFullPath.slice(0, searchIndex);
  const rawSearch = searchIndex === -1 ? "" : rawFullPath.slice(searchIndex);
  const resolved = resolveMatcherPath(matcher, rawPath || "/");
  const query = parseQuery(rawSearch);
  const fullPath = `${resolved.path}${stringifyQuery(query)}`;

  return {
    ...resolved,
    fullPath,
    query,
  };
}

function resolveStaticRouteSource(route: RouteLocationNormalized): StaticRoute["source"] {
  const matched = route.matched[route.matched.length - 1];
  const source = matched?.component;

  if (typeof source !== "function") {
    throw new TypeError("Static router matched route component must be a function");
  }

  return source;
}

function resolveMatcherPath(
  matcher: Matcher,
  path: string,
): Pick<RouteLocationNormalized, "path" | "params" | "matched"> {
  try {
    return matcher.resolve(path);
  } catch (error) {
    if (
      error instanceof URIError ||
      (error instanceof TypeError &&
        error.message === "Router path contains malformed percent encoding")
    ) {
      throw new TypeError("Static router path contains malformed percent encoding");
    }

    throw error;
  }
}
