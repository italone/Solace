import type { RouteRecord, Router } from "../router/types";
import {
  serializeRouterSnapshot,
  type RouteRecordIdentity,
  type RouterSnapshot,
} from "../router/snapshot";
import { createRouterServerContext, type RouterServerContext } from "./router-context";

export interface RouterSSROptions {
  url: string;
  routes: RouteRecord[];
  identifyRecord: RouteRecordIdentity;
  configure?: (router: Router) => void;
}

export interface ResolvedRouterSSR {
  context: RouterServerContext;
  router: RouterServerContext["router"];
  route: RouterServerContext["route"];
  snapshot: RouterSnapshot;
  provides: RouterServerContext["provides"];
}

const ROUTER_OPTION_KEYS = new Set(["url", "routes", "identifyRecord", "configure"]);

export function assertRouterSSROption(router: unknown): asserts router is RouterSSROptions {
  if (router === null || typeof router !== "object" || Array.isArray(router)) {
    throw new TypeError("SSR router option must be an object");
  }
  const record = router as Record<string, unknown>;
  const unknownKey = Reflect.ownKeys(record).find(
    (key) => typeof key !== "string" || !ROUTER_OPTION_KEYS.has(key),
  );
  if (unknownKey !== undefined) {
    throw new TypeError(`Unknown SSR router option: ${String(unknownKey)}`);
  }
  if (typeof record.url !== "string") {
    throw new TypeError("SSR router url must be a string");
  }
  if (!Array.isArray(record.routes)) {
    throw new TypeError("SSR router routes must be an array");
  }
  if (typeof record.identifyRecord !== "function") {
    throw new TypeError("SSR router identifyRecord must be a function");
  }
  if (record.configure !== undefined && typeof record.configure !== "function") {
    throw new TypeError("SSR router configure must be a function");
  }
}

export async function resolveRouterSSR(options: RouterSSROptions): Promise<ResolvedRouterSSR> {
  assertRouterSSROption(options);
  const context = await createRouterServerContext(options);
  return {
    context,
    router: context.router,
    route: context.route,
    snapshot: context.snapshot,
    provides: context.provides,
  };
}

export function buildSnapshotScript(snapshot: RouterSnapshot): string {
  const payload = serializeRouterSnapshot(snapshot).replace(/<\/(script)/gi, "<\\/$1");
  return (
    `<script id="__solace-router-snapshot">` +
    `window.__SOLACE_ROUTER_SNAPSHOT__=${payload};` +
    `</script>`
  );
}
