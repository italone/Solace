import { describe, expect, it } from "vitest";

import { h } from "../../../src/index";
import { createMatcher } from "../../../src/router/matcher";
import type { RouteRecord } from "../../../src/router/types";

const Home = () => h("div", null, "home");
const User = Home;
const Settings = Home;
const NotFound = Home;

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

    expect(match.matched?.path).toBe("/users/settings");
    expect(match.params).toEqual({});
  });

  it("extracts dynamic params", () => {
    const matcher = createMatcher(routes);
    const match = matcher.resolve("/users/42");

    expect(match.matched?.path).toBe("/users/:id");
    expect(match.params).toEqual({ id: "42" });
  });

  it("normalizes trailing slashes", () => {
    const matcher = createMatcher(routes);

    expect(matcher.resolve("/users/42/").params).toEqual({ id: "42" });
  });

  it("matches wildcard not found route last", () => {
    const matcher = createMatcher(routes);
    const match = matcher.resolve("/missing/path");

    expect(match.matched?.path).toBe("/:pathMatch(.*)*");
    expect(match.params).toEqual({ pathMatch: "missing/path" });
  });
});
