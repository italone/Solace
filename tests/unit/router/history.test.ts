import { describe, expect, it, vi } from "vitest";

import { createWebHashHistory, createWebHistory } from "../../../src/router/history";

describe("router history", () => {
  it("reads, pushes, and replaces web history paths", () => {
    window.history.replaceState(null, "", "/start?tab=one");
    const history = createWebHistory();

    expect(history.location()).toBe("/start?tab=one");

    history.push("/next?tab=two");
    expect(window.location.pathname).toBe("/next");
    expect(window.location.search).toBe("?tab=two");

    history.replace("/final");
    expect(history.location()).toBe("/final");
  });

  it("notifies listeners on popstate", () => {
    const history = createWebHistory();
    const listener = vi.fn();
    const stop = history.listen(listener);

    window.dispatchEvent(new PopStateEvent("popstate"));
    stop();
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("normalizes hash history paths", () => {
    window.history.replaceState(null, "", "/#/users/1?tab=profile");
    const history = createWebHashHistory();

    expect(history.location()).toBe("/users/1?tab=profile");

    history.push("/settings");
    expect(window.location.hash).toBe("#/settings");
  });

  it("normalizes blank and relative hash locations", () => {
    window.history.replaceState(null, "", "/#");
    const blankHistory = createWebHashHistory();
    expect(blankHistory.location()).toBe("/");

    window.history.replaceState(null, "", "/#settings?tab=profile");
    const relativeHistory = createWebHashHistory();
    expect(relativeHistory.location()).toBe("/settings?tab=profile");
  });

  it("cleans up hash history listeners", () => {
    const history = createWebHashHistory();
    const listener = vi.fn();
    const stop = history.listen(listener);

    window.dispatchEvent(new HashChangeEvent("hashchange"));
    window.dispatchEvent(new PopStateEvent("popstate"));
    stop();
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
