import { describe, expect, it } from "vitest";

import { h, type RouteLocationNormalized } from "../../../src";
import { createStaticRoutesFromRouter } from "../../../src/server";
import type { StaticRouterRouteRecord } from "../../../src/server";

const Home = () => h("main", null, "home");
const User = () => h("main", null, "user");
const NotFound = () => h("main", null, "not found");

function createRoutes(): StaticRouterRouteRecord[] {
  return [
    { path: "/", component: Home },
    { path: "/users/:id", component: User },
  ];
}

describe("createStaticRoutesFromRouter", () => {
  it("turns explicit paths into static routes using matched components", () => {
    const routes = createStaticRoutesFromRouter({
      routes: createRoutes(),
      paths: ["/", "/users/42"],
    });

    expect(routes).toHaveLength(2);
    expect(routes[0]).toMatchObject({ path: "/", source: Home });
    expect(routes[1]).toMatchObject({ path: "/users/42", source: User });
  });

  it("adds normalized route context for root and parameterized query paths", () => {
    const routes = createStaticRoutesFromRouter({
      routes: createRoutes(),
      paths: ["/", "/users/42?tab=profile"],
    });

    expect(routes[0].context?.route).toEqual({
      path: "/",
      fullPath: "/",
      query: {},
      params: {},
      matched: [{ path: "/", component: Home }],
    });
    expect(routes[1].context?.route).toEqual({
      path: "/users/42",
      fullPath: "/users/42?tab=profile",
      query: { tab: "profile" },
      params: { id: "42" },
      matched: [{ path: "/users/:id", component: User }],
    });
  });

  it("shallow-merges user context after default route context and passes provides through", () => {
    const provides = new Map([[Symbol("token"), "abc"]]);
    const seenRoutes: RouteLocationNormalized[] = [];

    const routes = createStaticRoutesFromRouter({
      routes: createRoutes(),
      paths: ["/users/42?tab=profile"],
      context(route) {
        seenRoutes.push(route);
        return { route: "overridden", title: route.params.id };
      },
      provides(route) {
        expect(route.fullPath).toBe("/users/42?tab=profile");
        return provides;
      },
    });

    expect(seenRoutes).toHaveLength(1);
    expect(routes[0].context).toEqual({ route: "overridden", title: "42" });
    expect(routes[0].provides).toBe(provides);
  });

  it("uses wildcard routes for otherwise unmatched paths", () => {
    const routes = createStaticRoutesFromRouter({
      routes: [{ path: "/:pathMatch(.*)*", component: NotFound }],
      paths: ["/missing/deep?from=ssg"],
    });

    expect(routes[0].path).toBe("/missing/deep?from=ssg");
    expect(routes[0].source).toBe(NotFound);
    expect(routes[0].context?.route).toEqual({
      path: "/missing/deep",
      fullPath: "/missing/deep?from=ssg",
      query: { from: "ssg" },
      params: { pathMatch: "missing/deep" },
      matched: [{ path: "/:pathMatch(.*)*", component: NotFound }],
    });
  });

  it("throws when a path does not match and no wildcard route exists", () => {
    const run = () =>
      createStaticRoutesFromRouter({
        routes: createRoutes(),
        paths: ["/missing"],
      });

    expect(run).toThrow(TypeError);
    expect(run).toThrow(/Static router path did not match any route: \/missing/);
  });

  it("rejects invalid adapter inputs with stable TypeErrors", () => {
    expect(() => createStaticRoutesFromRouter(null as unknown as never)).toThrow(
      /Static router options must be an object/,
    );
    expect(() => createStaticRoutesFromRouter([] as never)).toThrow(
      /Static router options must be an object/,
    );
    expect(() =>
      createStaticRoutesFromRouter({
        routes: createRoutes(),
        paths: ["/"],
        router: {},
      } as never),
    ).toThrow(/Deferred static router option is not part of the beta contract: router/);
    expect(() => createStaticRoutesFromRouter({ routes: null as never, paths: ["/"] })).toThrow(
      TypeError("Static router routes must be an array"),
    );
    expect(() => createStaticRoutesFromRouter({ routes: [], paths: [] })).toThrow(
      TypeError("Static router paths must be a non-empty array"),
    );
    expect(() =>
      createStaticRoutesFromRouter({
        routes: createRoutes(),
        paths: [42 as unknown as string],
      }),
    ).toThrow(TypeError("Static router path must be a string"));
    const sparsePaths = ["/"] as string[];
    sparsePaths.length = 2;
    expect(() =>
      createStaticRoutesFromRouter({
        routes: createRoutes(),
        paths: sparsePaths,
      }),
    ).toThrow(TypeError("Static router path must be a string"));
    expect(() =>
      createStaticRoutesFromRouter({
        routes: createRoutes(),
        paths: ["/"],
        context: "route" as never,
      }),
    ).toThrow(TypeError("Static router context must be a function"));
    expect(() =>
      createStaticRoutesFromRouter({
        routes: createRoutes(),
        paths: ["/"],
        provides: true as never,
      }),
    ).toThrow(TypeError("Static router provides must be a function"));
  });

  it("throws a stable TypeError for malformed path percent encoding", () => {
    expect(() =>
      createStaticRoutesFromRouter({
        routes: [{ path: "/users/:id", component: User }],
        paths: ["/users/%E0%A4%A"],
      }),
    ).toThrow(/Static router path contains malformed percent encoding/);
  });

  it("throws a stable TypeError for malformed query percent encoding", () => {
    expect(() =>
      createStaticRoutesFromRouter({
        routes: [{ path: "/users/:id", component: User }],
        paths: ["/users/42?tab=%E0%A4%A"],
      }),
    ).toThrow(/Static router query contains malformed percent encoding/);
  });

  it("rejects static router paths with hash fragments before matching", () => {
    expect(() =>
      createStaticRoutesFromRouter({
        routes: [{ path: "/:pathMatch(.*)*", component: NotFound }],
        paths: ["/users/42#profile"],
      }),
    ).toThrow(TypeError("Static router paths must not include hash fragments"));
  });

  it("rejects route records with non-string paths", () => {
    expect(() =>
      createStaticRoutesFromRouter({
        routes: [null as never],
        paths: ["/"],
      }),
    ).toThrow(/Static router route record must be an object/);
    expect(() =>
      createStaticRoutesFromRouter({
        routes: [[] as never],
        paths: ["/"],
      }),
    ).toThrow(/Static router route record must be an object/);

    expect(() =>
      createStaticRoutesFromRouter({
        routes: [{ path: 42, component: Home } as never],
        paths: ["/"],
      }),
    ).toThrow(/Static router route record path must be a string/);
  });

  it("rejects route records with deferred beta fields", () => {
    for (const field of ["children", "redirect", "beforeEnter", "meta", "name"]) {
      expect(() =>
        createStaticRoutesFromRouter({
          routes: [{ path: "/", component: Home, [field]: {} } as never],
          paths: ["/"],
        }),
      ).toThrow(
        new TypeError(
          `Deferred static router route record field is not part of the beta contract: ${field}`,
        ),
      );
    }
  });

  it("rejects route records with missing or non-function components", () => {
    expect(() =>
      createStaticRoutesFromRouter({
        routes: [{ path: "/" } as never],
        paths: ["/"],
      }),
    ).toThrow(/Static router route record component must be a function/);
    expect(() =>
      createStaticRoutesFromRouter({
        routes: [{ path: "/", component: "home" } as never],
        paths: ["/"],
      }),
    ).toThrow(/Static router route record component must be a function/);
  });
});
