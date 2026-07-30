import { describe, expect, it } from "vitest";

import { createRouter, h, lazyRoute } from "../../../src";
import type {
  NavigationGuard,
  RouteComponent,
  RouteLocationRaw,
  RouteRecord,
  RouterOptions,
} from "../../../src";
import type { RouterHistory } from "../../../src/router/types";

const Home = () => h("div", null, "home");
const lazyHome: RouteComponent = lazyRoute(() => Promise.resolve(Home));
const guarded: NavigationGuard = (to, from) => {
  if (to.fullPath === from.fullPath) {
    return false;
  }

  return true;
};

function acceptRouteRecord(record: RouteRecord): RouteRecord {
  return record;
}

function acceptRouterOptions(options: RouterOptions): RouterOptions {
  return options;
}

function acceptRouteLocationRaw(location: RouteLocationRaw): RouteLocationRaw {
  return location;
}

acceptRouteRecord({ path: "/", component: Home });
acceptRouteRecord({
  path: "/dashboard",
  component: Home,
  meta: { requiresAuth: true },
  beforeEnter: guarded,
  children: [
    { path: "", component: Home },
    { path: "settings", component: lazyHome },
  ],
});
acceptRouteRecord({ path: "/legacy", redirect: "/dashboard" });
acceptRouteRecord({ path: "/lazy", component: lazyHome });
acceptRouteLocationRaw("/");
acceptRouteLocationRaw({ path: "/", query: { tab: "profile" } });

const history: RouterHistory = {
  location: () => "/",
  push: () => undefined,
  replace: () => undefined,
  listen: () => () => undefined,
  back: () => undefined,
  forward: () => undefined,
};
const router = createRouter({
  history,
  routes: [{ path: "/", component: Home }],
});
const pushed = router.push("/");
pushed.then((route) => route.fullPath);

// @ts-expect-error named routes are not part of the router beta contract
acceptRouteRecord({ path: "/named", component: Home, name: "home" });

// @ts-expect-error aliases are not part of the router beta contract
acceptRouteRecord({ path: "/alias", component: Home, alias: "/a" });

// @ts-expect-error route props mapping is not part of the router beta contract
acceptRouteRecord({ path: "/props", component: Home, props: true });

// @ts-expect-error scroll behavior is not part of the router beta contract
acceptRouterOptions({ history, routes: [], scrollBehavior: () => undefined });

// @ts-expect-error named locations are not part of the router beta contract
acceptRouteLocationRaw({ name: "home" });

// @ts-expect-error hash locations are not part of the router beta contract
acceptRouteLocationRaw({ path: "/", hash: "#section" });

// @ts-expect-error params locations are not part of the router beta contract
acceptRouteLocationRaw({ path: "/users/1", params: { id: "1" } });

// @ts-expect-error object locations must include a string path
acceptRouteLocationRaw({ query: { tab: "profile" } });

describe("router public contract types", () => {
  it("keeps the widened beta route fields typed", () => {
    expect(true).toBe(true);
  });
});
