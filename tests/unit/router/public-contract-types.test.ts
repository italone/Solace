import { describe, expect, it } from "vitest";

import { createMemoryHistory, createRouter, h, lazyRoute } from "../../../src";
import type {
  NavigationGuard,
  Router,
  RouterHistory,
  RouteComponent,
  RouteLocationRaw,
  RouteParamInputValue,
  RouteParamsInput,
  RouteProps,
  RouteRecord,
  RouteRecordName,
  RouterScrollBehavior,
  RouterScrollPosition,
  RouterOptions,
} from "../../../src";

const Home = () => h("div", null, "home");
const lazyHome: RouteComponent = lazyRoute(() => Promise.resolve(Home));
const routeName: RouteRecordName = "user";
const routeParamValue: RouteParamInputValue = 42;
const routeParams: RouteParamsInput = { id: routeParamValue };
const routeProps: RouteProps = (route) => ({ id: route.params.id });
const scrollPosition: RouterScrollPosition = { left: 0, top: 100, behavior: "smooth" };
const scrollBehavior: RouterScrollBehavior = (to, from) => {
  if (to.fullPath === from.fullPath) {
    return false;
  }

  return scrollPosition;
};
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

function acceptRouterHistory(history: RouterHistory): RouterHistory {
  return history;
}

function acceptRouterContract(router: Router): Router {
  return router;
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
acceptRouteRecord({ path: "/named/:id", component: Home, name: routeName, props: routeProps });
acceptRouteRecord({ path: "/alias", component: Home, alias: ["/a", "relative-a"] });
acceptRouteRecord({ path: "/props-true/:id", component: Home, props: true });
acceptRouteRecord({ path: "/props-object", component: Home, props: { mode: "static" } });
acceptRouteRecord({
  path: "/group",
  component: null,
  children: [{ path: "child", component: Home }],
});

// @ts-expect-error route record auth integration is not part of the router beta contract
acceptRouteRecord({ path: "/admin", component: Home, auth: () => true });

// @ts-expect-error route record permissions integration is not part of the router beta contract
acceptRouteRecord({ path: "/admin", component: Home, permissions: ["admin"] });

acceptRouteLocationRaw("/");
acceptRouteLocationRaw({ path: "/", query: { tab: "profile" } });
acceptRouteLocationRaw({ name: "user", params: routeParams, query: { tab: "profile" } });

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
const ready = router.isReady();
ready.then((route) => route.fullPath);
acceptRouterHistory(createMemoryHistory());
acceptRouterOptions({ history, routes: [], scrollBehavior });
acceptRouterOptions({ history, routes: [], scrollBehavior: async () => scrollPosition });
acceptRouterOptions({ history, routes: [], scrollBehavior: () => false });

// @ts-expect-error auth integration is not part of the router beta contract
acceptRouterOptions({ history, routes: [], auth: () => true });

// @ts-expect-error permissions integration is not part of the router beta contract
acceptRouterOptions({ history, routes: [], permissions: ["admin"] });

// @ts-expect-error router-aware SSR integration is not part of the router beta contract
acceptRouterOptions({ history, routes: [], ssr: true });

// @ts-expect-error hash locations are not part of the router beta contract
acceptRouteLocationRaw({ path: "/", hash: "#section" });

// @ts-expect-error path locations do not accept params
acceptRouteLocationRaw({ path: "/users/1", params: { id: "1" } });

// @ts-expect-error named locations must include a string name
acceptRouteLocationRaw({ name: 42, params: { id: "1" } });

acceptRouterHistory({
  location: () => "/",
  push: () => undefined,
  replace: () => undefined,
  listen: () => () => undefined,
  back: () => undefined,
  forward: () => undefined,
  // @ts-expect-error href formatters are internal to first-party history adapters
  href: (path: string) => path,
});

acceptRouterContract({
  currentRoute: router.currentRoute,
  install: router.install,
  push: router.push,
  replace: router.replace,
  back: router.back,
  forward: router.forward,
  resolve: router.resolve,
  beforeEach: router.beforeEach,
  isReady: router.isReady,
  // @ts-expect-error href formatting is not part of the public Router contract
  href: (path: string) => path,
});

describe("router public contract types", () => {
  it("keeps the widened beta route fields typed", () => {
    expect(true).toBe(true);
  });
});
