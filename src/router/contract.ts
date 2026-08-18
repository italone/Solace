import type { LazyRouteComponent, RouteParamInputValue, RouteRecord, RouterOptions } from "./types";

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

export function assertRouterOptionsContract(options: RouterOptions): void {
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

  for (const route of options.routes) assertRouteRecordContract(route);
}

function assertRouterScrollBehaviorContract(scrollBehavior: RouterOptions["scrollBehavior"]): void {
  if (scrollBehavior === undefined || typeof scrollBehavior === "function") return;
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

  if (typeof route.path !== "string")
    throw new TypeError("Router route record path must be a string");
  assertRouteRecordNameContract(route.name);
  assertRouteRecordAliasContract(route.alias);
  assertRouteRecordPropsContract(route.props);
  assertRouteRecordComponentContract(route.component);
  assertRouteRecordRedirectContract(route.redirect);
  assertRouteRecordBeforeEnterContract(route.beforeEnter);
  assertRouteRecordMetaContract(route.meta);

  if (route.children !== undefined) {
    if (!Array.isArray(route.children))
      throw new TypeError("Router route record children must be an array");
    for (const child of route.children) assertRouteRecordContract(child);
  }
}

function assertRouteRecordComponentContract(component: RouteRecord["component"]): void {
  if (
    component === undefined ||
    component === null ||
    typeof component === "function" ||
    isLazyRouteComponent(component)
  )
    return;
  throw new TypeError("Router route record component must be a function or lazyRoute component");
}

export function isLazyRouteComponent(component: unknown): component is LazyRouteComponent {
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
  if (redirect === undefined || typeof redirect === "function") return;
  if (typeof redirect === "string") {
    assertRouterLocationIsRelative(redirect);
    assertRouterLocationPathHasNoHash(redirect);
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
  if (beforeEnter === undefined || typeof beforeEnter === "function") return;
  if (Array.isArray(beforeEnter)) {
    for (const guard of beforeEnter) {
      if (typeof guard !== "function")
        throw new TypeError("Router route record beforeEnter must be a function or function array");
    }
    return;
  }
  throw new TypeError("Router route record beforeEnter must be a function or function array");
}

function assertRouteRecordMetaContract(meta: RouteRecord["meta"]): void {
  if (meta === undefined || (typeof meta === "object" && meta !== null && !Array.isArray(meta)))
    return;
  throw new TypeError("Router route record meta must be an object");
}

function assertRouteRecordNameContract(name: RouteRecord["name"]): void {
  if (name === undefined) return;
  if (typeof name !== "string" || name.length === 0)
    throw new TypeError("Router route record name must be a non-empty string");
}

function assertRouteRecordAliasContract(alias: RouteRecord["alias"]): void {
  if (alias === undefined || typeof alias === "string") return;
  if (!Array.isArray(alias))
    throw new TypeError("Router route record alias must be a string or string array");
  for (const value of alias)
    if (typeof value !== "string")
      throw new TypeError("Router route record alias must be a string or string array");
}

function assertRouteRecordPropsContract(props: RouteRecord["props"]): void {
  if (props === undefined || typeof props === "boolean" || typeof props === "function") return;
  if (
    typeof props === "object" &&
    props !== null &&
    !Array.isArray(props) &&
    Object.getPrototypeOf(props) === Object.prototype
  )
    return;
  throw new TypeError("Router route record props must be a boolean, function, or plain object");
}

export function assertRouterLocationContract(location: {
  path?: unknown;
  name?: unknown;
  params?: unknown;
  query?: unknown;
}): asserts location is { path: string; query?: unknown } {
  for (const key of Object.keys(location)) {
    const isNamedLocation = "name" in location;
    const isAllowedPathKey = !isNamedLocation && (key === "path" || key === "query");
    const isAllowedNamedKey =
      isNamedLocation && (key === "name" || key === "query" || key === "params");
    if (!isAllowedPathKey && !isAllowedNamedKey)
      throw new TypeError(
        `Deferred router location field is not part of the beta contract: ${key}`,
      );
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
}): asserts location is { path: string; query?: unknown } {
  for (const key of Object.keys(location)) {
    if (key !== "path" && key !== "query")
      throw new TypeError(
        `Deferred router location field is not part of the beta contract: ${key}`,
      );
  }
  if (typeof location.path !== "string")
    throw new TypeError("Router location path must be a string");
  assertRouterLocationPathHasNoHash(location.path);
  assertRouterLocationIsRelative(location.path);
  assertRouterObjectLocationPathHasNoQuery(location.path);
  assertQueryContract(location.query);
}

export function assertRouterNamedLocationContract(location: {
  name?: unknown;
  params?: unknown;
  query?: unknown;
}): asserts location is {
  name: string;
  params?: Record<string, RouteParamInputValue>;
  query?: unknown;
} {
  for (const key of Object.keys(location)) {
    if (key !== "name" && key !== "query" && key !== "params")
      throw new TypeError(
        `Deferred router location field is not part of the beta contract: ${key}`,
      );
  }
  if (typeof location.name !== "string" || location.name === "")
    throw new TypeError("Router location name must be a non-empty string");
  if (location.params !== undefined) {
    if (
      typeof location.params !== "object" ||
      location.params === null ||
      Array.isArray(location.params)
    )
      throw new TypeError("Router location params must be a plain object");
    for (const value of Object.values(location.params))
      if (typeof value !== "string" && typeof value !== "number")
        throw new TypeError("Router named route params must be strings or numbers");
  }
  assertQueryContract(location.query);
}

function assertQueryContract(query: unknown): void {
  if (query === undefined) return;
  if (typeof query !== "object" || query === null || Array.isArray(query))
    throw new TypeError("Router location query must be an object");
  const prototype = Object.getPrototypeOf(query);
  if (prototype !== Object.prototype && prototype !== null)
    throw new TypeError("Router location query must be a plain object");
  for (const value of Object.values(query)) {
    if (Array.isArray(value)) {
      for (const item of value) assertQueryValue(item);
    } else assertQueryValue(value);
  }
}

function assertQueryValue(value: unknown): void {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return;
  throw new TypeError("Router location query value must be a primitive or primitive array");
}

export function assertRouterLocationPathHasNoHash(path: string): void {
  if (path.includes("#"))
    throw new TypeError("Router location hash fragments are not part of the beta contract");
}

export function assertRouterLocationIsRelative(path: string): void {
  if (path.startsWith("//") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(path))
    throw new TypeError("Router location must be a relative path");
}

function assertRouterObjectLocationPathHasNoQuery(path: string): void {
  if (path.includes("?"))
    throw new TypeError("Router object location paths must not include query strings");
}
