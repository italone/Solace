import type { App } from "../app";
import { inject } from "../component/provide";
import { ref } from "../reactivity/ref";
import { createMatcher } from "./matcher";
import { parseQuery, stringifyQuery } from "./query";
import type {
  NavigationGuard,
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
  const beforeEachGuards: NavigationGuard[] = [];
  let stopListening: (() => void) | null = null;
  let navigationId = 0;
  const currentRoute = ref(resolveLocation(options.history.location()));

  const router: Router = {
    currentRoute,
    install(app: App) {
      app.provide(routerKey, router);
      app.provide(routeKey, currentRoute);
      stopListening?.();
      stopListening = options.history.listen(() => {
        void settleHistoryLocation();
      });
      void settleHistoryLocation();
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
    beforeEach(guard: NavigationGuard) {
      beforeEachGuards.push(guard);

      return () => {
        const index = beforeEachGuards.indexOf(guard);
        if (index >= 0) {
          beforeEachGuards.splice(index, 1);
        }
      };
    },
  };

  return router;

  async function navigate(
    to: RouteLocationRaw,
    mode: "push" | "replace",
  ): Promise<RouteLocationNormalized> {
    const initial = resolveLocation(to);
    const activeNavigationId = ++navigationId;
    const from = currentRoute.value;
    const finalRoute = await resolveNavigation(initial, from);

    if (finalRoute === false) {
      return from;
    }

    if (activeNavigationId !== navigationId) {
      return currentRoute.value;
    }

    if (mode === "replace") {
      options.history.replace(finalRoute.fullPath);
    } else {
      options.history.push(finalRoute.fullPath);
    }

    currentRoute.value = finalRoute;
    return finalRoute;
  }

  async function resolveNavigation(
    initial: RouteLocationNormalized,
    from: RouteLocationNormalized,
    state: RedirectState = { count: 0 },
  ): Promise<RouteLocationNormalized | false> {
    const redirected = resolveRedirects(initial, from, state);
    const guarded = await runGuards(redirected, from);

    if (guarded === false) {
      return false;
    }

    if (guarded === true) {
      return redirected;
    }

    if (state.count >= redirectLimit) {
      throw new RouterNavigationError(
        "Router redirect loop detected",
        "redirect-loop",
        from,
        redirected,
      );
    }

    if (state.redirectedFrom === undefined) {
      state.redirectedFrom = redirected;
    }

    let guardRedirect: RouteLocationNormalized;
    try {
      guardRedirect = resolveLocation(guarded);
    } catch {
      throw new RouterNavigationError("Router guard rejected", "guard-rejected", from, redirected);
    }

    state.count += 1;
    return resolveNavigation(guardRedirect, from, state);
  }

  async function settleHistoryLocation(): Promise<void> {
    const activeNavigationId = ++navigationId;
    const from = currentRoute.value;
    const initial = resolveLocation(options.history.location());
    const finalRoute = await resolveNavigation(initial, from);

    if (activeNavigationId !== navigationId) {
      return;
    }

    if (finalRoute === false) {
      if (options.history.location() !== from.fullPath) {
        options.history.replace(from.fullPath);
      }
      return;
    }

    if (finalRoute.fullPath !== initial.fullPath) {
      options.history.replace(finalRoute.fullPath);
    }

    currentRoute.value = finalRoute;
  }

  function resolveRedirects(
    initial: RouteLocationNormalized,
    from: RouteLocationNormalized,
    state: RedirectState,
  ): RouteLocationNormalized {
    let target = initial;

    while (true) {
      const redirect = getLastMatchedRecord(target)?.redirect;
      if (redirect === undefined) {
        return state.redirectedFrom === undefined
          ? target
          : { ...target, redirectedFrom: state.redirectedFrom };
      }

      if (state.count >= redirectLimit) {
        throw new RouterNavigationError(
          "Router redirect loop detected",
          "redirect-loop",
          from,
          target,
        );
      }

      if (state.redirectedFrom === undefined) {
        state.redirectedFrom = target;
      }

      target = resolveLocation(typeof redirect === "function" ? redirect(target) : redirect);
      state.count += 1;
    }
  }

  async function runGuards(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
  ): Promise<true | false | RouteLocationRaw> {
    const guards = [
      ...beforeEachGuards,
      ...to.matched.flatMap((record) => normalizeGuards(record.beforeEnter)),
    ];

    try {
      for (const guard of guards) {
        const result = await guard(to, from);

        if (result === false) {
          return false;
        }

        if (result !== undefined && result !== true) {
          return result;
        }
      }
    } catch {
      throw new RouterNavigationError("Router guard rejected", "guard-rejected", from, to);
    }

    return true;
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

interface RedirectState {
  count: number;
  redirectedFrom?: RouteLocationNormalized;
}

function getLastMatchedRecord(route: RouteLocationNormalized): RouteRecord | undefined {
  return route.matched[route.matched.length - 1];
}

function normalizeGuards(guards: RouteRecord["beforeEnter"]): NavigationGuard[] {
  if (guards === undefined) {
    return [];
  }

  return Array.isArray(guards) ? guards : [guards];
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

  assertRouteRecordRedirectContract(route.redirect);
  assertRouteRecordBeforeEnterContract(route.beforeEnter);
  assertRouteRecordMetaContract(route.meta);

  if (route.children !== undefined) {
    if (!Array.isArray(route.children)) {
      throw new TypeError("Router route record children must be an array");
    }

    for (const child of route.children) {
      assertRouteRecordContract(child);
    }
  }
}

function assertRouteRecordRedirectContract(redirect: RouteRecord["redirect"]): void {
  if (redirect === undefined || typeof redirect === "string" || typeof redirect === "function") {
    return;
  }

  if (typeof redirect === "object" && redirect !== null && !Array.isArray(redirect)) {
    assertRouterLocationContract(redirect);
    return;
  }

  throw new TypeError(
    "Router route record redirect must be a string, object location, or function",
  );
}

function assertRouteRecordBeforeEnterContract(beforeEnter: RouteRecord["beforeEnter"]): void {
  if (beforeEnter === undefined || typeof beforeEnter === "function") {
    return;
  }

  if (Array.isArray(beforeEnter) && beforeEnter.every((guard) => typeof guard === "function")) {
    return;
  }

  throw new TypeError("Router route record beforeEnter must be a function or function array");
}

function assertRouteRecordMetaContract(meta: RouteRecord["meta"]): void {
  if (meta === undefined || (typeof meta === "object" && meta !== null && !Array.isArray(meta))) {
    return;
  }

  throw new TypeError("Router route record meta must be an object");
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

  if (
    location.query !== undefined &&
    (typeof location.query !== "object" || location.query === null || Array.isArray(location.query))
  ) {
    throw new TypeError("Router location query must be an object");
  }
}
