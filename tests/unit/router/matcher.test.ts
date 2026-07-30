import { describe, expect, it } from "vitest";

import { h } from "../../../src/index";
import { createMatcher } from "../../../src/router/matcher";
import type { RouteRecord } from "../../../src/router/types";

const Home = () => h("div", null, "home");
const User = Home;
const Settings = Home;
const NotFound = Home;

function lastMatched(match: { matched: RouteRecord[] }): RouteRecord | undefined {
  return match.matched[match.matched.length - 1];
}

describe("router matcher", () => {
  const routes: RouteRecord[] = [
    { path: "/users/:id", component: User },
    { path: "/users/settings", component: Settings },
    { path: "/", component: Home },
    { path: "/:pathMatch(.*)*", component: NotFound },
  ];

  it("matches static routes before dynamic routes", () => {
    const matcher = createMatcher(routes);
    const match = matcher.resolve("/users/settings");

    expect(lastMatched(match)?.path).toBe("/users/settings");
    expect(match.params).toEqual({});
  });

  it("extracts dynamic params", () => {
    const matcher = createMatcher(routes);
    const match = matcher.resolve("/users/42");

    expect(lastMatched(match)?.path).toBe("/users/:id");
    expect(match.params).toEqual({ id: "42" });
  });

  it("normalizes trailing slashes", () => {
    const matcher = createMatcher(routes);

    expect(matcher.resolve("/users/42/").params).toEqual({ id: "42" });
  });

  it("matches wildcard not found route last", () => {
    const matcher = createMatcher(routes);
    const match = matcher.resolve("/missing/path");

    expect(lastMatched(match)?.path).toBe("/:pathMatch(.*)*");
    expect(match.params).toEqual({ pathMatch: "missing/path" });
  });

  it("matches nested child routes with a parent chain", () => {
    const Dashboard = () => h("section", null, "dashboard");
    const DashboardSettings = () => h("p", null, "settings");
    const matcher = createMatcher([
      {
        path: "/dashboard",
        component: Dashboard,
        children: [{ path: "settings", component: DashboardSettings }],
      },
    ]);

    const match = matcher.resolve("/dashboard/settings");

    expect(match.matched.map((record) => record.path)).toEqual(["/dashboard", "settings"]);
    expect(match.params).toEqual({});
  });

  it("matches index children at the parent path", () => {
    const Dashboard = () => h("section", null, "dashboard");
    const DashboardHome = () => h("p", null, "home");
    const matcher = createMatcher([
      {
        path: "/dashboard",
        component: Dashboard,
        children: [{ path: "", component: DashboardHome }],
      },
    ]);

    const match = matcher.resolve("/dashboard");

    expect(match.matched.map((record) => record.path)).toEqual(["/dashboard", ""]);
    expect(match.params).toEqual({});
  });

  it("keeps absolute children in the parent chain", () => {
    const AppLayout = () => h("section", null, "app");
    const Account = () => h("p", null, "account");
    const matcher = createMatcher([
      {
        path: "/app",
        component: AppLayout,
        children: [{ path: "/account", component: Account }],
      },
    ]);

    const match = matcher.resolve("/account");

    expect(match.matched.map((record) => record.path)).toEqual(["/app", "/account"]);
    expect(match.params).toEqual({});
  });

  it("merges parent and child params with child params taking precedence", () => {
    const Team = () => h("section", null, "team");
    const UserProfile = () => h("p", null, "user");
    const matcher = createMatcher([
      {
        path: "/teams/:id",
        component: Team,
        children: [{ path: "users/:id", component: UserProfile }],
      },
    ]);

    const match = matcher.resolve("/teams/platform/users/42");

    expect(match.matched.map((record) => record.path)).toEqual(["/teams/:id", "users/:id"]);
    expect(match.params).toEqual({ id: "42" });
  });

  it("rejects deferred param path syntax", () => {
    expect(() => createMatcher([{ path: "/users/:id?", component: User }])).toThrow(
      /Deferred router path syntax/,
    );
    expect(() => createMatcher([{ path: "/users/:ids+", component: User }])).toThrow(
      /Deferred router path syntax/,
    );
    expect(() => createMatcher([{ path: "/users/:id(\\d+)", component: User }])).toThrow(
      /Deferred router path syntax/,
    );
  });
});
