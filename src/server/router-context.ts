import { createMemoryHistory } from "../router/history";
import { routeKey, routerKey, createRouter } from "../router/router";
import {
  createRouterSnapshot,
  type RouteRecordIdentity,
  type RouterSnapshot,
} from "../router/snapshot";
import type { RouteLocationNormalized, RouteRecord, Router } from "../router/types";

export interface RouterServerContextOptions {
  url: string;
  routes: RouteRecord[];
  identifyRecord: RouteRecordIdentity;
  configure?: (router: Router) => void;
  provides?: ReadonlyMap<string | symbol, unknown>;
}

export interface RouterServerContext {
  router: Router;
  route: RouteLocationNormalized;
  snapshot: RouterSnapshot;
  provides: Map<string | symbol, unknown>;
}

export async function createRouterServerContext(
  options: RouterServerContextOptions,
): Promise<RouterServerContext> {
  assertOptions(options);

  const router = createRouter({
    history: createMemoryHistory(options.url),
    routes: options.routes,
  });
  const configurationResult = options.configure?.(router);
  if (isThenable(configurationResult)) {
    throw new TypeError("Router server context configure must be synchronous");
  }

  const route = await router.isReady();
  const snapshot = createRouterSnapshot(route, options.identifyRecord);
  const provides = new Map(options.provides ?? []);
  provides.set(routerKey, router);
  provides.set(routeKey, router.currentRoute);

  return { router, route, snapshot, provides };
}

function assertOptions(options: unknown): asserts options is RouterServerContextOptions {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Router server context options must be an object");
  }

  const record = options as Record<string, unknown>;
  const allowed = new Set(["url", "routes", "identifyRecord", "configure", "provides"]);
  const unknownKey = Reflect.ownKeys(record).find(
    (key) => typeof key !== "string" || !allowed.has(key),
  );
  if (unknownKey !== undefined) {
    throw new TypeError(`Unknown router server context option: ${String(unknownKey)}`);
  }
  if (typeof record.url !== "string") {
    throw new TypeError("Router server context url must be a string");
  }
  if (!Array.isArray(record.routes)) {
    throw new TypeError("Router server context routes must be an array");
  }
  if (typeof record.identifyRecord !== "function") {
    throw new TypeError("Router server context record identity must be a function");
  }
  if (record.configure !== undefined && typeof record.configure !== "function") {
    throw new TypeError("Router server context configure must be a function");
  }
  if (record.provides !== undefined && !(record.provides instanceof Map)) {
    throw new TypeError("Router server context provides must be a Map");
  }
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as { then?: unknown }).then === "function"
  );
}
