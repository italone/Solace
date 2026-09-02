import type { App } from "../app";
import type { DevtoolsEvent } from "../devtools/events";
import { emitDevtoolsEvent, hasDevtoolsListeners } from "../devtools/events";
import { inject } from "../component/provide";
import { ref } from "../reactivity/ref";
import { isThenable } from "../shared/utils";
import {
  historyHrefFormatterKey,
  hasHistoryHrefFormatter,
  routerHrefFormatterKey,
  type RouterHrefFormatter,
} from "./internal";
import { createMatcher } from "./matcher";
import { preloadLazyRouteComponent } from "./lazy";
import { parseQuery, stringifyQuery } from "./query";
import {
  assertRouterLocationContract,
  assertRouterLocationIsRelative,
  assertRouterLocationPathHasNoHash,
  assertRouterNamedLocationContract,
  assertRouterOptionsContract,
  isLazyRouteComponent,
} from "./contract";
import type {
  LazyRouteComponent,
  NavigationGuard,
  RouteLocationNormalized,
  RouteLocationRaw,
  RouteRecord,
  Router,
  RouterOptions,
  RouterScrollPosition,
} from "./types";

export const routerKey = Symbol("Solace.router");
export const routeKey = Symbol("Solace.route");
export const routerViewDepthKey = Symbol("Solace.routerViewDepth");

export class RouterNavigationError extends Error {
  constructor(
    message: string,
    readonly type:
      | "redirect-loop"
      | "redirect-rejected"
      | "guard-rejected"
      | "guard-cancelled"
      | "lazy-load-failed",
    readonly from: RouteLocationNormalized,
    readonly to: RouteLocationNormalized,
  ) {
    super(message);
    this.name = "RouterNavigationError";
  }
}

type NavigationStatus = Extract<DevtoolsEvent, { type: "router:navigation" }>["status"];

function emitNavigationDevtoolsEvent(to: string, from: string, status: NavigationStatus): void {
  if (!hasDevtoolsListeners()) {
    return;
  }

  emitDevtoolsEvent({ type: "router:navigation", to, from, status });
}

function emitNavigationTerminalEvent(
  finalRoute: RouteLocationNormalized,
  initial: RouteLocationNormalized,
  from: RouteLocationNormalized,
): void {
  if (finalRoute.redirectedFrom !== undefined && finalRoute.fullPath !== initial.fullPath) {
    emitNavigationDevtoolsEvent(finalRoute.fullPath, initial.fullPath, "redirect");
    return;
  }

  emitNavigationDevtoolsEvent(finalRoute.fullPath, from.fullPath, "success");
}

export function createRouter(options: RouterOptions): Router {
  assertRouterOptionsContract(options);
  const matcher = createMatcher(options.routes);
  const redirectLimit = 16;
  const beforeEachGuards: NavigationGuard[] = [];
  let stopListening: (() => void) | null = null;
  let hasStartedHistorySettlement = false;
  let readinessPromise: Promise<RouteLocationNormalized> | null = null;
  let isWritingHistory = false;
  let navigationId = 0;
  const currentRoute = ref(resolveInitialHistoryLocation());

  const router: Router & RouterHrefFormatter = {
    currentRoute,
    install(app: App) {
      app.provide(routerKey, router);
      app.provide(routeKey, currentRoute);
      stopListening?.();
      const stop = options.history.listen(() => {
        if (isWritingHistory) {
          return;
        }

        if (!hasStartedHistorySettlement) {
          void startInitialSettlement().catch(() => undefined);
          return;
        }

        void settleHistoryLocation();
      });
      if (typeof stop !== "function") {
        throw new TypeError("Router history listen() must return an unsubscribe function");
      }

      stopListening = stop;
      void startInitialSettlement().catch(() => undefined);
    },
    isReady() {
      return startInitialSettlement();
    },
    isReadySync(): RouteLocationNormalized {
      const from = currentRoute.value;
      const initial = resolveLocation(options.history.location());
      emitNavigationDevtoolsEvent(initial.fullPath, from.fullPath, "start");

      let finalRoute: RouteLocationNormalized | false;
      try {
        finalRoute = resolveNavigationSync(initial, from);
      } catch (error) {
        emitNavigationDevtoolsEvent(initial.fullPath, from.fullPath, "error");
        throw error;
      }

      if (finalRoute === false) {
        emitNavigationDevtoolsEvent(initial.fullPath, from.fullPath, "cancelled");
        throw new RouterNavigationError(
          "Router initial navigation was cancelled",
          "guard-cancelled",
          from,
          initial,
        );
      }

      if (finalRoute.fullPath !== initial.fullPath) {
        writeHistory(() => options.history.replace(finalRoute.fullPath));
      }

      emitNavigationTerminalEvent(finalRoute, initial, from);
      currentRoute.value = finalRoute;
      return finalRoute;
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
      if (typeof guard !== "function") {
        throw new TypeError("Router beforeEach guard must be a function");
      }

      beforeEachGuards.push(guard);

      return () => {
        const index = beforeEachGuards.indexOf(guard);
        if (index >= 0) {
          beforeEachGuards.splice(index, 1);
        }
      };
    },
    [routerHrefFormatterKey](to: RouteLocationRaw) {
      const fullPath = resolveLocation(to).fullPath;
      return hasHistoryHrefFormatter(options.history)
        ? options.history[historyHrefFormatterKey](fullPath)
        : fullPath;
    },
  };

  return router;

  function startInitialSettlement(): Promise<RouteLocationNormalized> {
    if (readinessPromise !== null) {
      return readinessPromise;
    }

    hasStartedHistorySettlement = true;
    const activeNavigationId = ++navigationId;
    const from = currentRoute.value;
    readinessPromise = (async () => {
      let terminalEmitted = false;
      let toPath = options.history.location();
      try {
        const initial = resolveLocation(toPath);
        toPath = initial.fullPath;
        emitNavigationDevtoolsEvent(initial.fullPath, from.fullPath, "start");
        const finalRoute = await resolveNavigation(initial, from);

        if (finalRoute === false) {
          emitNavigationDevtoolsEvent(initial.fullPath, from.fullPath, "cancelled");
          terminalEmitted = true;
          throw new RouterNavigationError(
            "Router initial navigation was cancelled",
            "guard-cancelled",
            from,
            initial,
          );
        }

        if (activeNavigationId !== navigationId) {
          return currentRoute.value;
        }

        if (finalRoute.fullPath !== initial.fullPath) {
          writeHistory(() => options.history.replace(finalRoute.fullPath));
        }

        emitNavigationTerminalEvent(finalRoute, initial, from);
        terminalEmitted = true;
        currentRoute.value = finalRoute;
        await applyScrollBehavior(finalRoute, from, activeNavigationId);
        return finalRoute;
      } catch (error) {
        if (!terminalEmitted) {
          emitNavigationDevtoolsEvent(toPath, from.fullPath, "error");
        }

        if (activeNavigationId === navigationId && options.history.location() !== from.fullPath) {
          writeHistory(() => options.history.replace(from.fullPath));
        }

        throw error;
      }
    })();

    return readinessPromise;
  }

  async function navigate(
    to: RouteLocationRaw,
    mode: "push" | "replace",
  ): Promise<RouteLocationNormalized> {
    const from = currentRoute.value;

    let initial: RouteLocationNormalized;
    try {
      initial = resolveLocation(to);
    } catch (error) {
      emitNavigationDevtoolsEvent(typeof to === "string" ? to : "", from.fullPath, "error");
      throw error;
    }

    const activeNavigationId = ++navigationId;

    if (initial.fullPath === from.fullPath) {
      return from;
    }

    emitNavigationDevtoolsEvent(initial.fullPath, from.fullPath, "start");

    let finalRoute: RouteLocationNormalized | false;
    try {
      finalRoute = await resolveNavigation(initial, from);

      if (finalRoute === false) {
        emitNavigationDevtoolsEvent(initial.fullPath, from.fullPath, "cancelled");
        return from;
      }

      const resolved = finalRoute;

      if (activeNavigationId !== navigationId) {
        return currentRoute.value;
      }

      if (resolved.fullPath === from.fullPath) {
        emitNavigationTerminalEvent(resolved, initial, from);
        return from;
      }

      const lazyComponents = getLazyRouteComponents(resolved);
      if (lazyComponents.length > 0) {
        await preloadLazyRouteComponents(lazyComponents, from, resolved);

        if (activeNavigationId !== navigationId) {
          return currentRoute.value;
        }
      }

      writeHistory(() => {
        if (mode === "replace") {
          options.history.replace(resolved.fullPath);
        } else {
          options.history.push(resolved.fullPath);
        }
      });
    } catch (error) {
      emitNavigationDevtoolsEvent(initial.fullPath, from.fullPath, "error");
      throw error;
    }

    emitNavigationTerminalEvent(finalRoute, initial, from);
    currentRoute.value = finalRoute;
    await applyScrollBehavior(finalRoute, from, activeNavigationId);
    return finalRoute;
  }

  async function resolveNavigation(
    initial: RouteLocationNormalized,
    from: RouteLocationNormalized,
    state: RedirectState = { count: 0 },
  ): Promise<RouteLocationNormalized | false> {
    const redirected = resolveRedirects(initial, from, state);

    if (state.redirectedFrom !== undefined && redirected.fullPath === from.fullPath) {
      return redirected;
    }

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

  function getLazyRouteComponents(to: RouteLocationNormalized): LazyRouteComponent[] {
    return to.matched.flatMap((record) =>
      isLazyRouteComponent(record.component) ? [record.component] : [],
    );
  }

  async function preloadLazyRouteComponents(
    lazyComponents: LazyRouteComponent[],
    from: RouteLocationNormalized,
    to: RouteLocationNormalized,
  ): Promise<void> {
    try {
      await Promise.all(lazyComponents.map((component) => preloadLazyRouteComponent(component)));
    } catch {
      throw new RouterNavigationError(
        "Lazy route component failed to load",
        "lazy-load-failed",
        from,
        to,
      );
    }
  }

  async function settleHistoryLocation(): Promise<void> {
    hasStartedHistorySettlement = true;
    const activeNavigationId = ++navigationId;
    const from = currentRoute.value;
    let initial: RouteLocationNormalized;
    let finalRoute: RouteLocationNormalized | false;

    try {
      initial = resolveLocation(options.history.location());
      if (initial.fullPath === from.fullPath) {
        return;
      }

      finalRoute = await resolveNavigation(initial, from);
    } catch {
      if (activeNavigationId === navigationId && options.history.location() !== from.fullPath) {
        writeHistory(() => options.history.replace(from.fullPath));
      }
      return;
    }

    if (activeNavigationId !== navigationId) {
      return;
    }

    if (finalRoute === false) {
      if (options.history.location() !== from.fullPath) {
        writeHistory(() => options.history.replace(from.fullPath));
      }
      return;
    }

    if (finalRoute.fullPath === from.fullPath) {
      if (options.history.location() !== from.fullPath) {
        writeHistory(() => options.history.replace(from.fullPath));
      }
      return;
    }

    if (finalRoute.fullPath !== initial.fullPath) {
      writeHistory(() => options.history.replace(finalRoute.fullPath));
    }

    currentRoute.value = finalRoute;
    await applyScrollBehavior(finalRoute, from, activeNavigationId);
  }

  async function applyScrollBehavior(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    activeNavigationId: number,
  ): Promise<void> {
    if (options.scrollBehavior === undefined) {
      return;
    }

    const position = await options.scrollBehavior(to, from);
    if (activeNavigationId !== navigationId) {
      return;
    }

    if (position === undefined || position === false) {
      return;
    }

    const scrollTo = (globalThis as { scrollTo?: (options: RouterScrollPosition) => void })
      .scrollTo;
    if (typeof scrollTo === "function") {
      scrollTo(position);
    }
  }

  function writeHistory(write: () => void): void {
    isWritingHistory = true;
    try {
      write();
    } finally {
      isWritingHistory = false;
    }
  }

  function resolveRedirects(
    initial: RouteLocationNormalized,
    from: RouteLocationNormalized,
    state: RedirectState,
  ): RouteLocationNormalized {
    let target = initial;

    while (true) {
      const redirect = getFirstMatchedRedirect(target);
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

      try {
        target = resolveLocation(typeof redirect === "function" ? redirect(target) : redirect);
      } catch {
        throw new RouterNavigationError(
          "Router redirect rejected",
          "redirect-rejected",
          from,
          target,
        );
      }
      state.count += 1;
    }
  }

  function resolveNavigationSync(
    initial: RouteLocationNormalized,
    from: RouteLocationNormalized,
    state: RedirectState = { count: 0 },
  ): RouteLocationNormalized | false {
    const redirected = resolveRedirects(initial, from, state);

    if (state.redirectedFrom !== undefined && redirected.fullPath === from.fullPath) {
      return redirected;
    }

    const guarded = runGuardsSync(redirected, from);

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
    return resolveNavigationSync(guardRedirect, from, state);
  }

  function runGuardsSync(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
  ): true | false | RouteLocationRaw {
    const guards = [
      ...beforeEachGuards,
      ...to.matched.flatMap((record) => normalizeGuards(record.beforeEnter)),
    ];

    try {
      for (const guard of guards) {
        const result = guard(to, from);

        if (isThenable(result)) {
          throw new TypeError(
            "Synchronous router settlement requires synchronous guards; use the async SSR entry",
          );
        }

        if (result === false) {
          return false;
        }

        if (result !== undefined && result !== true) {
          return result;
        }
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("synchronous guards")) {
        throw error;
      }

      throw new RouterNavigationError("Router guard rejected", "guard-rejected", from, to);
    }

    return true;
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
    if (typeof to === "object" && to !== null && !Array.isArray(to) && "name" in to) {
      assertRouterNamedLocationContract(to);
      const match = matcher.resolveByName(to.name, to.params);
      const query =
        to.query === undefined ? parseQuery("") : parseQuery(stringifyQuery(to.query).slice(1));
      const search = stringifyQuery(query);

      return {
        path: match.path,
        fullPath: `${match.path}${search}`,
        query,
        params: match.params,
        matched: match.matched,
        name: match.name ?? to.name,
      };
    }

    const fullPath = normalizeRawLocation(to);
    const [rawPath, rawSearch] = splitLocationPathAndSearch(fullPath);
    const match = matcher.resolve(rawPath || "/");
    const query = parseQuery(rawSearch);
    const search = stringifyQuery(query);

    return {
      path: match.path,
      fullPath: `${match.path}${search}`,
      query,
      params: match.params,
      matched: match.matched,
      name: match.name,
    };
  }

  function resolveInitialHistoryLocation(): RouteLocationNormalized {
    try {
      return resolveLocation(options.history.location());
    } catch {
      return resolveLocation("/");
    }
  }
}

interface RedirectState {
  count: number;
  redirectedFrom?: RouteLocationNormalized;
}

function getFirstMatchedRedirect(route: RouteLocationNormalized): RouteRecord["redirect"] {
  return route.matched.find((record) => record.redirect !== undefined)?.redirect;
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
    assertRouterLocationIsRelative(to);
    assertRouterLocationPathHasNoHash(to);
    return to === "" ? "/" : to;
  }

  if (to === null || typeof to !== "object" || Array.isArray(to)) {
    throw new TypeError("Router location must be a string or object");
  }

  assertRouterLocationContract(to);
  return `${to.path}${stringifyQuery(to.query)}`;
}

function splitLocationPathAndSearch(fullPath: string): [string, string] {
  const queryStart = fullPath.indexOf("?");
  if (queryStart === -1) {
    return [fullPath, ""];
  }

  return [fullPath.slice(0, queryStart), fullPath.slice(queryStart + 1)];
}
