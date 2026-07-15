import { describe, expect, it } from "vitest";

import { createApp, h, inject } from "../../../src/index";
import type { Plugin } from "../../../src/index";

describe("createApp", () => {
  it("mounts a root function component", () => {
    const container = document.createElement("div");
    const App = () => h("p", null, "hello app");

    createApp(App).mount(container);

    expect(container.innerHTML).toBe("<p>hello app</p>");
  });

  it("mounts a root vnode", () => {
    const container = document.createElement("div");

    createApp(h("span", null, "hello vnode")).mount(container);

    expect(container.innerHTML).toBe("<span>hello vnode</span>");
  });

  it("installs function plugins with options", () => {
    const container = document.createElement("div");
    const AppRoot = () => h("p", null, "mounted");
    const calls: unknown[][] = [];
    const app = createApp(AppRoot);

    app.use(
      (installedApp, ...options) => {
        calls.push([installedApp, ...options]);
      },
      "enabled",
      1,
    );
    app.mount(container);

    expect(calls).toEqual([[app, "enabled", 1]]);
    expect(container.innerHTML).toBe("<p>mounted</p>");
  });

  it("installs object plugins with options", () => {
    const app = createApp(() => h("p", null, "mounted"));
    const calls: unknown[][] = [];
    const plugin = {
      install(installedApp: unknown, ...options: unknown[]) {
        calls.push([installedApp, ...options]);
      },
    };

    app.use(plugin, { enabled: true });

    expect(calls).toEqual([[app, { enabled: true }]]);
  });

  it("returns the app from use and installs each plugin once per app", () => {
    const app = createApp(() => h("p", null, "mounted"));
    let calls = 0;
    const plugin = () => {
      calls += 1;
    };

    const returned = app.use(plugin).use(plugin);

    expect(returned).toBe(app);
    expect(calls).toBe(1);
  });

  it("tracks installed plugins per app instance", () => {
    const firstApp = createApp(() => h("p", null, "first"));
    const secondApp = createApp(() => h("p", null, "second"));
    let calls = 0;
    const plugin = () => {
      calls += 1;
    };

    firstApp.use(plugin);
    secondApp.use(plugin);

    expect(calls).toBe(2);
  });

  it("provides app-level values to the root component", () => {
    const container = document.createElement("div");
    const AppRoot = () => {
      const theme = inject("theme", "light");

      return () => h("span", null, String(theme));
    };

    createApp(AppRoot).provide("theme", "dark").mount(container);

    expect(container.innerHTML).toBe("<span>dark</span>");
  });

  it("allows plugins to provide app-level values", () => {
    const container = document.createElement("div");
    const plugin: Plugin = (app) => {
      app.provide("message", "from plugin");
    };
    const AppRoot = () => {
      const message = inject("message", "missing");

      return () => h("span", null, String(message));
    };

    createApp(AppRoot).use(plugin).mount(container);

    expect(container.innerHTML).toBe("<span>from plugin</span>");
  });

  it("returns the app from provide for chaining", () => {
    const app = createApp(() => h("p", null, "mounted"));

    expect(app.provide("theme", "dark")).toBe(app);
  });
});
