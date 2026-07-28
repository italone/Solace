import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import type { RouteRecord, RouterOptions } from "../../../src";

const Home = () => h("div", null, "home");

function acceptRouteRecord(record: RouteRecord): RouteRecord {
  return record;
}

function acceptRouterOptions(options: RouterOptions): RouterOptions {
  return options;
}

acceptRouteRecord({ path: "/", component: Home });

// @ts-expect-error nested route records are not part of the router beta contract
acceptRouteRecord({ path: "/nested", component: Home, children: [] });

// @ts-expect-error route guards are not part of the router beta contract
acceptRouteRecord({ path: "/guarded", component: Home, beforeEnter: () => true });

// @ts-expect-error redirects are not part of the router beta contract
acceptRouteRecord({ path: "/redirect", component: Home, redirect: "/" });

// @ts-expect-error route meta is not part of the router beta contract
acceptRouteRecord({ path: "/meta", component: Home, meta: {} });

// @ts-expect-error named routes are not part of the router beta contract
acceptRouteRecord({ path: "/named", component: Home, name: "home" });

// @ts-expect-error scroll behavior is not part of the router beta contract
acceptRouterOptions({ history: {} as never, routes: [], scrollBehavior: () => undefined });

describe("router public contract types", () => {
  it("keeps deferred route fields out of the beta types", () => {
    expect(true).toBe(true);
  });
});
