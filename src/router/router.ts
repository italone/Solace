import type { App } from "../app";
import { inject } from "../component/provide";
import { ref } from "../reactivity/ref";
import { createMatcher } from "./matcher";
import { parseQuery, stringifyQuery } from "./query";
import type {
  RouteLocationNormalized,
  RouteLocationRaw,
  RouteRecord,
  Router,
  RouterOptions,
} from "./types";

export const routerKey = Symbol("Solace.router");
export const routeKey = Symbol("Solace.route");
export const routerViewDepthKey = Symbol("Solace.routerViewDepth");

export class RouterNavigationError extends Error {
  constructor(
    message: string,
    readonly type: "redirect-loop" | "guard-rejected" | "lazy-load-failed",
    readonly from: RouteLocationNormalized,
    readonly to: RouteLocationNormalized,
  ) {
    super(message);
    this.name = "RouterNavigationError";
  }
}

const allowedRouteRecordFields = new Set([
  "path",
  "component",
  "children",
  "redirect",
  "beforeEnter",
  "meta",
]);

export function createRouter(options: RouterOptions): Router {
  assertRouterOptionsContract(options);
  const matcher = createMatcher(options.routes);
  const redirectLimit = 16;
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
    async push(to: RouteLocationRaw) {
      return navigate(to, "push");
    },
    async replace(to: RouteLocationRaw) {
      return navigate(to, "replace");
    },
    back: () => options.history.back(),
    forward: () => options.history.forward(),
    resolve: resolveLocation,
    beforeEach() {
      return () => undefined;
    },
  };

  return router;

  async function navigate(
    to: RouteLocationRaw,
    mode: "push" | "replace",
  ): Promise<RouteLocationNormalized> {
    const from = currentRoute.value;
    const redirected = resolveRedirects(resolveLocation(to), from);

    if (mode === "replace") {
      options.history.replace(redirected.fullPath);
    } else {
      options.history.push(redirected.fullPath);
    }

    currentRoute.value = redirected;
    return redirected;
  }

  function resolveRedirects(
    initial: RouteLocationNormalized,
    from: RouteLocationNormalized,
  ): RouteLocationNormalized {
    let target = initial;
    let redirectedFrom: RouteLocationNormalized | undefined;
    let redirects = 0;

    while (true) {
      const redirect = getLastMatchedRecord(target)?.redirect;
      if (redirect === undefined) {
        return redirectedFrom === undefined ? target : { ...target, redirectedFrom };
      }

      if (redirects >= redirectLimit) {
        throw new RouterNavigationError(
          "Router redirect loop detected",
          "redirect-loop",
          from,
          target,
        );
      }

      if (redirectedFrom === undefined) {
        redirectedFrom = target;
      }

      target = resolveLocation(typeof redirect === "function" ? redirect(target) : redirect);
      redirects += 1;
    }
  }

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

function getLastMatchedRecord(route: RouteLocationNormalized): RouteRecord | undefined {
  return route.matched[route.matched.length - 1];
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

  assertRouterLocationContract(to);
  return `${to.path}${stringifyQuery(to.query)}`;
}

function assertRouterOptionsContract(options: RouterOptions): void {
  for (const key of Object.keys(options)) {
    if (key !== "history" && key !== "routes") {
      throw new TypeError(`Deferred router option is not part of the beta contract: ${key}`);
    }
  }

  if (!Array.isArray(options.routes)) {
    throw new TypeError("Router routes must be an array");
  }

  for (const route of options.routes) {
    assertRouteRecordContract(route);
  }
}

function assertRouteRecordContract(route: RouteRecord): void {
  for (const key of Object.keys(route)) {
    if (!allowedRouteRecordFields.has(key)) {
      throw new TypeError(
        `Deferred router route record field is not part of the beta contract: ${key}`,
      );
    }
  }

  if (typeof route.path !== "string") {
    throw new TypeError("Router route record path must be a string");
  }

  if (route.children !== undefined) {
    if (!Array.isArray(route.children)) {
      throw new TypeError("Router route record children must be an array");
    }

    for (const child of route.children) {
      assertRouteRecordContract(child);
    }
  }
}

function assertRouterLocationContract(location: {
  path?: unknown;
  query?: unknown;
}): asserts location is {
  path: string;
  query?: unknown;
} {
  for (const key of Object.keys(location)) {
    if (key !== "path" && key !== "query") {
      throw new TypeError(
        `Deferred router location field is not part of the beta contract: ${key}`,
      );
    }
  }

  if (typeof location.path !== "string") {
    throw new TypeError("Router location path must be a string");
  }
}
