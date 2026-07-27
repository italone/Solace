import type { App } from "../app";
import { inject } from "../component/provide";
import { ref } from "../reactivity/ref";
import { createMatcher } from "./matcher";
import { parseQuery, stringifyQuery } from "./query";
import type { RouteLocationNormalized, RouteLocationRaw, Router, RouterOptions } from "./types";

export const routerKey = Symbol("Solace.router");
export const routeKey = Symbol("Solace.route");

export function createRouter(options: RouterOptions): Router {
  const matcher = createMatcher(options.routes);
  let stopListening: (() => void) | null = null;
  const currentRoute = ref(resolveLocation(options.history.location()));

  const router: Router = {
    currentRoute,
    install(app: App) {
      app.provide(routerKey, router);
      app.provide(routeKey, currentRoute);
      currentRoute.value = resolveLocation(options.history.location());
      stopListening?.();
      stopListening = options.history.listen(() => {
        currentRoute.value = resolveLocation(options.history.location());
      });
    },
    push(to: RouteLocationRaw) {
      const resolved = resolveLocation(to);
      options.history.push(resolved.fullPath);
      currentRoute.value = resolved;
    },
    replace(to: RouteLocationRaw) {
      const resolved = resolveLocation(to);
      options.history.replace(resolved.fullPath);
      currentRoute.value = resolved;
    },
    back: () => options.history.back(),
    forward: () => options.history.forward(),
    resolve: resolveLocation,
  };

  return router;

  function resolveLocation(to: RouteLocationRaw): RouteLocationNormalized {
    const fullPath = normalizeRawLocation(to);
    const [rawPath, rawSearch = ""] = fullPath.split("?");
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
}

export function useRouter(): Router {
  const router = inject<Router>(routerKey);
  if (router === undefined) {
    throw new Error("Router is not installed");
  }

  return router;
}

export function useRoute(): Router["currentRoute"] {
  const route = inject<Router["currentRoute"]>(routeKey);
  if (route === undefined) {
    throw new Error("Router is not installed");
  }

  return route;
}

function normalizeRawLocation(to: RouteLocationRaw): string {
  if (typeof to === "string") {
    return to === "" ? "/" : to;
  }

  return `${to.path || "/"}${stringifyQuery(to.query)}`;
}
