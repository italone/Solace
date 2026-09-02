import { afterEach, describe, expect, it } from "vitest";

import { h } from "../../../src/index";
import {
  clearDevtoolsListeners,
  onDevtoolsEvent,
  type DevtoolsEvent,
} from "../../../src/devtools/events";
import { createRouter } from "../../../src/router/router";
import type { RouterHistory } from "../../../src/router/types";

const component = () => h("p", null, "x");

function createMemoryHistory(initial = "/"): RouterHistory {
  let current = initial;
  const listeners = new Set<() => void>();

  return {
    location: () => current,
    push(path) {
      current = path;
    },
    replace(path) {
      current = path;
    },
    listen(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    back: () => undefined,
    forward: () => undefined,
  };
}

interface NavigationEvent {
  type: "router:navigation";
  to: string;
  from: string;
  status: "start" | "success" | "redirect" | "error" | "cancelled";
}

function navigationEvents(events: DevtoolsEvent[]): NavigationEvent[] {
  return events.filter((event): event is NavigationEvent => event.type === "router:navigation");
}

function recordEvents(): { events: DevtoolsEvent[]; stop: () => void } {
  const events: DevtoolsEvent[] = [];
  const stop = onDevtoolsEvent((event) => {
    events.push(event);
  });

  return { events, stop };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  clearDevtoolsListeners();
});

describe("router navigation devtools events", () => {
  it("emits start then success for a successful push", async () => {
    const { events, stop } = recordEvents();
    const router = createRouter({
      history: createMemoryHistory("/"),
      routes: [
        { path: "/", component },
        { path: "/about", component },
      ],
    });

    await router.push("/about");
    stop();

    const navigations = navigationEvents(events);
    expect(navigations).toEqual([
      { type: "router:navigation", to: "/about", from: "/", status: "start" },
      { type: "router:navigation", to: "/about", from: "/", status: "success" },
    ]);
  });

  it("emits exactly one terminal redirect event for a record redirect", async () => {
    const { events, stop } = recordEvents();
    const router = createRouter({
      history: createMemoryHistory("/"),
      routes: [
        { path: "/", component },
        { path: "/b", redirect: "/c", component },
        { path: "/c", component },
      ],
    });

    await router.push("/b");
    stop();

    const navigations = navigationEvents(events);
    const terminals = navigations.filter((event) => event.status !== "start");
    expect(terminals).toEqual([
      { type: "router:navigation", to: "/c", from: "/b", status: "redirect" },
    ]);
  });

  it("emits a cancelled terminal event when a beforeEnter guard returns false", async () => {
    const { events, stop } = recordEvents();
    const router = createRouter({
      history: createMemoryHistory("/"),
      routes: [
        { path: "/", component },
        { path: "/a", component, beforeEnter: () => false },
      ],
    });

    await router.push("/a");
    stop();

    const navigations = navigationEvents(events);
    const terminals = navigations.filter((event) => event.status !== "start");
    expect(terminals).toEqual([
      { type: "router:navigation", to: "/a", from: "/", status: "cancelled" },
    ]);
  });

  it("emits a cancelled terminal event when initial settlement is cancelled", async () => {
    const { events, stop } = recordEvents();
    const router = createRouter({
      history: createMemoryHistory("/blocked"),
      routes: [
        { path: "/", component },
        { path: "/blocked", component, beforeEnter: () => false },
      ],
    });

    await expect(router.isReady()).rejects.toBeTruthy();
    await settle();
    stop();

    const terminals = navigationEvents(events).filter((event) => event.status !== "start");
    expect(terminals).toEqual([
      { type: "router:navigation", to: "/blocked", from: "/blocked", status: "cancelled" },
    ]);
  });

  it("emits an error terminal event when a guard throws", async () => {
    const { events, stop } = recordEvents();
    const router = createRouter({
      history: createMemoryHistory("/"),
      routes: [
        { path: "/", component },
        {
          path: "/a",
          component,
          beforeEnter: () => {
            throw new Error("blocked");
          },
        },
      ],
    });

    await expect(router.push("/a")).rejects.toBeTruthy();
    stop();

    const terminals = navigationEvents(events).filter((event) => event.status !== "start");
    expect(terminals).toEqual([
      { type: "router:navigation", to: "/a", from: "/", status: "error" },
    ]);
  });

  it("emits an error terminal event when the target route cannot be resolved", async () => {
    const { events, stop } = recordEvents();
    const router = createRouter({
      history: createMemoryHistory("/"),
      routes: [{ path: "/", component }],
    });

    await expect(router.push("/about#section")).rejects.toBeTruthy();
    stop();

    const terminals = navigationEvents(events).filter((event) => event.status !== "start");
    expect(terminals).toEqual([
      { type: "router:navigation", to: "/about#section", from: "/", status: "error" },
    ]);
  });

  it("emits exactly one terminal event per navigation", async () => {
    const { events, stop } = recordEvents();
    const router = createRouter({
      history: createMemoryHistory("/"),
      routes: [
        { path: "/", component },
        { path: "/about", component },
        { path: "/b", redirect: "/c", component },
        { path: "/c", component },
      ],
    });

    await router.push("/about");
    await router.push("/b");
    await router.push("/");
    stop();

    const navigations = navigationEvents(events);
    const terminals = navigations.filter((event) => event.status !== "start");
    expect(terminals).toHaveLength(3);
    expect(navigations.filter((event) => event.status === "start")).toHaveLength(3);
  });

  it("emits only string payloads with the documented properties", async () => {
    const { events, stop } = recordEvents();
    const router = createRouter({
      history: createMemoryHistory("/"),
      routes: [
        { path: "/", component },
        { path: "/about", component },
      ],
    });

    await router.push("/about");
    stop();

    for (const event of navigationEvents(events)) {
      expect(typeof event.to).toBe("string");
      expect(typeof event.from).toBe("string");
      expect(Object.keys(event).sort()).toEqual(["from", "status", "to", "type"]);
    }
  });

  it("emits no events for a same-path push no-op", async () => {
    const { events, stop } = recordEvents();
    const router = createRouter({
      history: createMemoryHistory("/"),
      routes: [
        { path: "/", component },
        { path: "/about", component },
      ],
    });

    await router.push("/");
    stop();

    expect(navigationEvents(events)).toEqual([]);
  });

  it("does not leak events to unsubscribed listeners", async () => {
    const first = recordEvents();
    const router = createRouter({
      history: createMemoryHistory("/"),
      routes: [
        { path: "/", component },
        { path: "/about", component },
      ],
    });

    first.stop();

    await router.push("/about");

    const second = recordEvents();
    await router.push("/");
    second.stop();

    expect(navigationEvents(first.events)).toEqual([]);
    expect(navigationEvents(second.events)).toEqual([
      { type: "router:navigation", to: "/", from: "/about", status: "start" },
      { type: "router:navigation", to: "/", from: "/about", status: "success" },
    ]);
  });
});
