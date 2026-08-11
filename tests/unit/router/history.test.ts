import { describe, expect, it, vi } from "vitest";

import {
  createMemoryHistory,
  createWebHashHistory,
  createWebHistory,
} from "../../../src/router/history";

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

  it("normalizes web history locations and write targets", () => {
    window.history.replaceState(null, "", "/users/1/?tab=profile");
    const history = createWebHistory();

    expect(history.location()).toBe("/users/1?tab=profile");

    history.push("/settings/");
    expect(window.location.pathname).toBe("/settings");
    expect(history.location()).toBe("/settings");

    history.replace("relative/");
    expect(window.location.pathname).toBe("/relative");
    expect(history.location()).toBe("/relative");
  });

  it("notifies listeners on popstate", () => {
    const history = createWebHistory();
    const listener = vi.fn();
    const stop = history.listen(listener);

    window.history.pushState(null, "", "/changed");
    window.dispatchEvent(new PopStateEvent("popstate"));
    stop();
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ignores repeated popstate events for the same location", () => {
    window.history.replaceState(null, "", "/start");
    const history = createWebHistory();
    const listener = vi.fn();
    history.listen(listener);

    window.history.pushState(null, "", "/next");
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps web history listener cleanup idempotent after location changes", () => {
    window.history.replaceState(null, "", "/start");
    const history = createWebHistory();
    const listener = vi.fn();
    const stop = history.listen(listener);

    window.history.pushState(null, "", "/next");
    window.dispatchEvent(new PopStateEvent("popstate"));
    stop();
    stop();

    window.history.pushState(null, "", "/final");
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps web history listener state and cleanup independent", () => {
    window.history.replaceState(null, "", "/start");
    const history = createWebHistory();
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = history.listen(first);
    history.listen(second);

    window.history.pushState(null, "", "/next");
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.dispatchEvent(new PopStateEvent("popstate"));
    stopFirst();

    window.history.pushState(null, "", "/final");
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it("does not notify web history listeners from push or replace", () => {
    const history = createWebHistory();
    const listener = vi.fn();
    history.listen(listener);

    history.push("/pushed");
    history.replace("/replaced");

    expect(listener).not.toHaveBeenCalled();
  });

  it("notifies memory history listeners on stack changes", () => {
    const history = createMemoryHistory(["/", "/start"]);
    const listener = vi.fn();
    const stop = history.listen(listener);

    expect(history.location()).toBe("/start");

    history.push("/pushed");
    expect(history.location()).toBe("/pushed");
    expect(listener).toHaveBeenCalledTimes(1);

    history.back();
    expect(history.location()).toBe("/start");
    expect(listener).toHaveBeenCalledTimes(2);

    history.forward();
    expect(history.location()).toBe("/pushed");
    expect(listener).toHaveBeenCalledTimes(3);

    history.replace("/replaced");
    expect(history.location()).toBe("/replaced");
    expect(listener).toHaveBeenCalledTimes(4);

    stop();
  });

  it("keeps memory history at stack bounds without notifying listeners", () => {
    const history = createMemoryHistory("/only");
    const listener = vi.fn();
    history.listen(listener);

    history.back();
    history.forward();

    expect(history.location()).toBe("/only");
    expect(listener).not.toHaveBeenCalled();
  });

  it("delegates web and hash back and forward navigation", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    const forward = vi.spyOn(window.history, "forward").mockImplementation(() => undefined);

    createWebHistory().back();
    createWebHistory().forward();
    createWebHashHistory().back();
    createWebHashHistory().forward();

    expect(back).toHaveBeenCalledTimes(2);
    expect(forward).toHaveBeenCalledTimes(2);
  });

  it("rejects web history write targets with hash fragments", () => {
    const history = createWebHistory();

    expect(() => history.push("/settings#profile")).toThrow(
      TypeError("Router history target must not include hash fragments"),
    );
    expect(() => history.replace("/settings#profile")).toThrow(
      TypeError("Router history target must not include hash fragments"),
    );
  });

  it("rejects web history write targets that look like absolute URLs", () => {
    const history = createWebHistory();

    expect(() => history.push("https://example.com")).toThrow(
      TypeError("Router history target must be a relative path"),
    );
    expect(() => history.replace("//example.com")).toThrow(
      TypeError("Router history target must be a relative path"),
    );
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

  it("normalizes hash history trailing slashes and write targets", () => {
    window.history.replaceState(null, "", "/#/users/1/?tab=profile");
    const history = createWebHashHistory();

    expect(history.location()).toBe("/users/1?tab=profile");

    history.push("/settings/");
    expect(window.location.hash).toBe("#/settings");
    expect(history.location()).toBe("/settings");

    history.replace("relative/");
    expect(window.location.hash).toBe("#/relative");
    expect(history.location()).toBe("/relative");
  });

  it("deduplicates hash history events and cleans up listeners", () => {
    window.history.replaceState(null, "", "/#/start");
    const history = createWebHashHistory();
    const listener = vi.fn();
    const stop = history.listen(listener);

    window.history.pushState(null, "", "/#/next");
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.dispatchEvent(new HashChangeEvent("hashchange"));

    window.history.pushState(null, "", "/#/final");
    window.dispatchEvent(new HashChangeEvent("hashchange"));

    expect(listener).toHaveBeenCalledTimes(2);

    stop();
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("keeps hash history cleanup idempotent after location changes", () => {
    window.history.replaceState(null, "", "/#/start");
    const history = createWebHashHistory();
    const listener = vi.fn();
    const stop = history.listen(listener);

    window.history.pushState(null, "", "/#/next");
    window.dispatchEvent(new PopStateEvent("popstate"));
    stop();
    stop();

    window.history.pushState(null, "", "/#/final");
    window.dispatchEvent(new HashChangeEvent("hashchange"));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps hash history listener state and cleanup independent", () => {
    window.history.replaceState(null, "", "/#/start");
    const history = createWebHashHistory();
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = history.listen(first);
    history.listen(second);

    window.history.pushState(null, "", "/#/next");
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    stopFirst();

    window.history.pushState(null, "", "/#/final");
    window.dispatchEvent(new HashChangeEvent("hashchange"));

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it("does not notify hash history listeners from push or replace", () => {
    const history = createWebHashHistory();
    const listener = vi.fn();
    history.listen(listener);

    history.push("/pushed");
    history.replace("/replaced");

    expect(listener).not.toHaveBeenCalled();
  });

  it("rejects hash history write targets with hash fragments", () => {
    const history = createWebHashHistory();

    expect(() => history.push("/settings#profile")).toThrow(
      TypeError("Router history target must not include hash fragments"),
    );
    expect(() => history.replace("/settings#profile")).toThrow(
      TypeError("Router history target must not include hash fragments"),
    );
  });

  it("rejects hash history write targets that look like absolute URLs", () => {
    const history = createWebHashHistory();

    expect(() => history.push("https://example.com")).toThrow(
      TypeError("Router history target must be a relative path"),
    );
    expect(() => history.replace("//example.com")).toThrow(
      TypeError("Router history target must be a relative path"),
    );
  });
});
