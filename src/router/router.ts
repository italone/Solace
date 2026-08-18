import type { App } from "../app";
import { inject } from "../component/provide";
import { ref } from "../reactivity/ref";
import {
  historyHrefFormatterKey,
  hasHistoryHrefFormatter,
  routerHrefFormatterKey,
  type RouterHrefFormatter,
} from "./internal";
import { createMatcher } from "./matcher";
import { preloadLazyRouteComponent } from "./lazy";
import { parseQuery, stringifyQuery } from "./query";
import type {
  LazyRouteComponent,
  NavigationGuard,
  RouteLocationNormalized,
  RouteLocationRaw,
  RouteParamInputValue,
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

const allowedRouteRecordFields = new Set([
  "path",
  "name",
  "component",
  "children",
  "redirect",
  "beforeEnter",
  "meta",
  "alias",
  "props",
]);
const requiredHistoryMethods = [
  "location",
  "push",
  "replace",
  "listen",
  "back",
  "forward",
] as const;
const deferredAuthPermissionFields = new Set(["auth", "permissions"]);

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
      try {
        const initial = resolveLocation(options.history.location());
        const finalRoute = await resolveNavigation(initial, from);

        if (finalRoute === false) {
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

        currentRoute.value = finalRoute;
        await applyScrollBehavior(finalRoute, from, activeNavigationId);
        return finalRoute;
      } catch (error) {
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
    const initial = resolveLocation(to);
    const activeNavigationId = ++navigationId;
    const from = currentRoute.value;

    if (initial.fullPath === from.fullPath) {
      return from;
    }

    const finalRoute = await resolveNavigation(initial, from);

    if (finalRoute === false) {
      return from;
    }

    if (activeNavigationId !== navigationId) {
      return currentRoute.value;
    }

    if (finalRoute.fullPath === from.fullPath) {
      return from;
    }

    const lazyComponents = getLazyRouteComponents(finalRoute);
    if (lazyComponents.length > 0) {
      await preloadLazyRouteComponents(lazyComponents, from, finalRoute);

      if (activeNavigationId !== navigationId) {
        return currentRoute.value;
      }
    }

    writeHistory(() => {
      if (mode === "replace") {
        options.history.replace(finalRoute.fullPath);
      } else {
        options.history.push(finalRoute.fullPath);
      }
    });

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

function assertRouterOptionsContract(options: RouterOptions): void {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Router options must be an object");
  }

  for (const key of Object.keys(options)) {
    if (deferredAuthPermissionFields.has(key)) {
      throw new TypeError(
        `Router ${key} integration is not part of the beta contract; use application guards and backend authorization instead: ${key}`,
      );
    }

    if (key !== "history" && key !== "routes" && key !== "scrollBehavior") {
      throw new TypeError(`Deferred router option is not part of the beta contract: ${key}`);
    }
  }

  assertRouterHistoryContract(options.history);
  assertRouterScrollBehaviorContract(options.scrollBehavior);

  if (!Array.isArray(options.routes)) {
    throw new TypeError("Router routes must be an array");
  }

  for (const route of options.routes) {
    assertRouteRecordContract(route);
  }
}

function assertRouterScrollBehaviorContract(scrollBehavior: RouterOptions["scrollBehavior"]): void {
  if (scrollBehavior === undefined || typeof scrollBehavior === "function") {
    return;
  }

  throw new TypeError("Router scrollBehavior must be a function");
}

function assertRouterHistoryContract(history: unknown): void {
  if (history === null || typeof history !== "object" || Array.isArray(history)) {
    throw new TypeError("Router history must be an object");
  }

  for (const method of requiredHistoryMethods) {
    if (typeof (history as Record<string, unknown>)[method] !== "function") {
      throw new TypeError(`Router history must implement ${method}()`);
    }
  }
}

function assertRouteRecordContract(route: RouteRecord): void {
  if (route === null || typeof route !== "object" || Array.isArray(route)) {
    throw new TypeError("Router route record must be an object");
  }

  for (const key of Object.keys(route)) {
    if (deferredAuthPermissionFields.has(key)) {
      throw new TypeError(
        `Router route record ${key} integration is not part of the beta contract; use route meta as developer-owned data and backend authorization for enforcement instead: ${key}`,
      );
    }

    if (!allowedRouteRecordFields.has(key)) {
      throw new TypeError(
        `Deferred router route record field is not part of the beta contract: ${key}`,
      );
    }
  }

  if (typeof route.path !== "string") {
    throw new TypeError("Router route record path must be a string");
  }

  assertRouteRecordNameContract(route.name);
  assertRouteRecordAliasContract(route.alias);
  assertRouteRecordPropsContract(route.props);
  assertRouteRecordComponentContract(route.component);
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

function assertRouteRecordComponentContract(component: RouteRecord["component"]): void {
  if (
    component === undefined ||
    component === null ||
    typeof component === "function" ||
    isLazyRouteComponent(component)
  ) {
    return;
  }

  throw new TypeError("Router route record component must be a function or lazyRoute component");
}

function isLazyRouteComponent(component: unknown): component is LazyRouteComponent {
  return (
    typeof component === "object" &&
    component !== null &&
    "__solaceLazyRouteComponent" in component &&
    component.__solaceLazyRouteComponent === true &&
    "load" in component &&
    typeof component.load === "function"
  );
}

function assertRouteRecordRedirectContract(redirect: RouteRecord["redirect"]): void {
  if (redirect === undefined || typeof redirect === "function") {
    return;
  }

  if (typeof redirect === "string") {
    normalizeRawLocation(redirect);
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

  if (Array.isArray(beforeEnter)) {
    for (let index = 0; index < beforeEnter.length; index += 1) {
      if (typeof beforeEnter[index] !== "function") {
        throw new TypeError("Router route record beforeEnter must be a function or function array");
      }
    }

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

function assertRouteRecordNameContract(name: RouteRecord["name"]): void {
  if (name === undefined) {
    return;
  }

  if (typeof name !== "string" || name.length === 0) {
    throw new TypeError("Router route record name must be a non-empty string");
  }
}

function assertRouteRecordAliasContract(alias: RouteRecord["alias"]): void {
  if (alias === undefined || typeof alias === "string") {
    return;
  }

  if (!Array.isArray(alias)) {
    throw new TypeError("Router route record alias must be a string or string array");
  }

  for (const value of alias) {
    if (typeof value !== "string") {
      throw new TypeError("Router route record alias must be a string or string array");
    }
  }
}

function assertRouteRecordPropsContract(props: RouteRecord["props"]): void {
  if (props === undefined || typeof props === "boolean" || typeof props === "function") {
    return;
  }

  if (
    typeof props === "object" &&
    props !== null &&
    !Array.isArray(props) &&
    Object.getPrototypeOf(props) === Object.prototype
  ) {
    return;
  }

  throw new TypeError("Router route record props must be a boolean, function, or plain object");
}

function assertRouterLocationContract(location: {
  path?: unknown;
  name?: unknown;
  params?: unknown;
  query?: unknown;
}): asserts location is {
  path: string;
  query?: unknown;
} {
  for (const key of Object.keys(location)) {
    const isNamedLocation = "name" in location;
    const isAllowedPathKey = !isNamedLocation && (key === "path" || key === "query");
    const isAllowedNamedKey =
      isNamedLocation && (key === "name" || key === "query" || key === "params");
    if (!isAllowedPathKey && !isAllowedNamedKey) {
      throw new TypeError(
        `Deferred router location field is not part of the beta contract: ${key}`,
      );
    }
  }

  if ("name" in location) {
    assertRouterNamedLocationContract(location);
    return;
  }

  assertRouterPathLocationContract(location);
}

function assertRouterPathLocationContract(location: {
  path?: unknown;
  name?: unknown;
  params?: unknown;
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

  assertRouterLocationPathHasNoHash(location.path);
  assertRouterLocationIsRelative(location.path);
  assertRouterObjectLocationPathHasNoQuery(location.path);

  if (
    location.query !== undefined &&
    (typeof location.query !== "object" || location.query === null || Array.isArray(location.query))
  ) {
    throw new TypeError("Router location query must be an object");
  }

  if (location.query !== undefined) {
    assertRouterLocationQueryObjectContract(location.query);
    assertRouterLocationQueryContract(location.query);
  }
}

function assertRouterNamedLocationContract(location: {
  name?: unknown;
  params?: unknown;
  query?: unknown;
}): asserts location is {
  name: string;
  params?: Record<string, RouteParamInputValue>;
  query?: unknown;
} {
  for (const key of Object.keys(location)) {
    if (key !== "name" && key !== "query" && key !== "params") {
      throw new TypeError(
        `Deferred router location field is not part of the beta contract: ${key}`,
      );
    }
  }

  if (typeof location.name !== "string" || location.name === "") {
    throw new TypeError("Router location name must be a non-empty string");
  }

  if (location.params !== undefined) {
    if (
      typeof location.params !== "object" ||
      location.params === null ||
      Array.isArray(location.params)
    ) {
      throw new TypeError("Router location params must be a plain object");
    }

    for (const value of Object.values(location.params)) {
      if (typeof value === "string" || typeof value === "number") {
        continue;
      }

      throw new TypeError("Router named route params must be strings or numbers");
    }
  }

  if (
    location.query !== undefined &&
    (typeof location.query !== "object" || location.query === null || Array.isArray(location.query))
  ) {
    throw new TypeError("Router location query must be an object");
  }

  if (location.query !== undefined) {
    assertRouterLocationQueryObjectContract(location.query);
    assertRouterLocationQueryContract(location.query);
  }
}

function assertRouterLocationQueryObjectContract(query: object): void {
  const prototype = Object.getPrototypeOf(query);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Router location query must be a plain object");
  }
}

function assertRouterLocationQueryContract(query: object): void {
  for (const value of Object.values(query)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        assertRouterLocationQueryValueContract(item);
      }
    } else {
      assertRouterLocationQueryValueContract(value);
    }
  }
}

function assertRouterLocationQueryValueContract(value: unknown): void {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return;
  }

  throw new TypeError("Router location query value must be a primitive or primitive array");
}

function assertRouterLocationPathHasNoHash(path: string): void {
  if (path.includes("#")) {
    throw new TypeError("Router location hash fragments are not part of the beta contract");
  }
}

function assertRouterLocationIsRelative(path: string): void {
  if (path.startsWith("//") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(path)) {
    throw new TypeError("Router location must be a relative path");
  }
}

function assertRouterObjectLocationPathHasNoQuery(path: string): void {
  if (path.includes("?")) {
    throw new TypeError("Router object location paths must not include query strings");
  }
}
