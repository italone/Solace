import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);

describe("package exports", () => {
  it("builds root and JSX runtime artifacts", () => {
    expect(existsSync(resolve(root, "dist/index.js"))).toBe(true);
    expect(existsSync(resolve(root, "dist/index.cjs"))).toBe(true);
    expect(existsSync(resolve(root, "dist/index.d.ts"))).toBe(true);
    expect(existsSync(resolve(root, "dist/jsx-runtime.js"))).toBe(true);
    expect(existsSync(resolve(root, "dist/jsx-runtime.d.ts"))).toBe(true);
    expect(existsSync(resolve(root, "dist/jsx-dev-runtime.js"))).toBe(true);
    expect(existsSync(resolve(root, "dist/jsx-dev-runtime.d.ts"))).toBe(true);
  });

  it("does not publish production sourcemaps", () => {
    const sourcemaps = readdirSync(resolve(root, "dist"))
      .filter((entry) => entry.endsWith(".map"))
      .sort();

    expect(sourcemaps).toEqual([]);
  });

  it("exports the public root API", async () => {
    const api = await import("solace");

    expect(api).toMatchObject({
      createApp: expect.any(Function),
      computed: expect.any(Function),
      createStore: expect.any(Function),
      defineAsyncComponent: expect.any(Function),
      defineComponent: expect.any(Function),
      effect: expect.any(Function),
      Fragment: expect.any(Symbol),
      h: expect.any(Function),
      nextTick: expect.any(Function),
      onMounted: expect.any(Function),
      onUnmounted: expect.any(Function),
      onUpdated: expect.any(Function),
      provide: expect.any(Function),
      inject: expect.any(Function),
      render: expect.any(Function),
      reactive: expect.any(Function),
      ref: expect.any(Function),
      watch: expect.any(Function),
      watchEffect: expect.any(Function),
    });
  });

  it("does not expose internal runtime helpers from the package root", async () => {
    const api = await import("solace");

    expect(api).not.toHaveProperty("clearDevtoolsListeners");
    expect(api).not.toHaveProperty("createComponentInstance");
    expect(api).not.toHaveProperty("createDevtoolsRecorder");
    expect(api).not.toHaveProperty("createVNode");
    expect(api).not.toHaveProperty("emitDevtoolsEvent");
    expect(api).not.toHaveProperty("onDevtoolsEvent");
    expect(api).not.toHaveProperty("queueJob");
    expect(api).not.toHaveProperty("serializeDevtoolsEvent");
    expect(api).not.toHaveProperty("setupComponent");
    expect(api).not.toHaveProperty("ShapeFlags");
  });

  it("exports the public DevTools subpath without internal emit helpers", async () => {
    const devtools = await import("solace/devtools");

    expect(devtools).toMatchObject({
      createDevtoolsRecorder: expect.any(Function),
      onDevtoolsEvent: expect.any(Function),
    });
    expect(Object.keys(devtools).sort()).toEqual(["createDevtoolsRecorder", "onDevtoolsEvent"]);
    expect(devtools).not.toHaveProperty("clearDevtoolsListeners");
    expect(devtools).not.toHaveProperty("emitDevtoolsEvent");
    expect(devtools).not.toHaveProperty("hasDevtoolsListeners");
    expect(devtools).not.toHaveProperty("serializeDevtoolsEvent");
  });

  it("exports JSX runtime entry points", async () => {
    const runtime = await import("solace/jsx-runtime");
    const devRuntime = await import("solace/jsx-dev-runtime");

    expect(runtime).toMatchObject({
      Fragment: expect.any(Symbol),
      jsx: expect.any(Function),
      jsxs: expect.any(Function),
    });
    expect(devRuntime).toMatchObject({
      Fragment: expect.any(Symbol),
      jsx: expect.any(Function),
      jsxs: expect.any(Function),
      jsxDEV: expect.any(Function),
    });
  });

  it("supports CommonJS package exports", () => {
    const api = require("solace") as Record<string, unknown>;
    const runtime = require("solace/jsx-runtime") as Record<string, unknown>;
    const devRuntime = require("solace/jsx-dev-runtime") as Record<string, unknown>;
    const devtools = require("solace/devtools") as Record<string, unknown>;

    expect(api.createApp).toEqual(expect.any(Function));
    expect(api.defineAsyncComponent).toEqual(expect.any(Function));
    expect(api.defineComponent).toEqual(expect.any(Function));
    expect(api.inject).toEqual(expect.any(Function));
    expect(api.provide).toEqual(expect.any(Function));
    expect(api.reactive).toEqual(expect.any(Function));
    expect(api.watchEffect).toEqual(expect.any(Function));
    expect(runtime.jsx).toEqual(expect.any(Function));
    expect(runtime.jsxs).toEqual(expect.any(Function));
    expect(devRuntime.jsxDEV).toEqual(expect.any(Function));
    expect(devtools.createDevtoolsRecorder).toEqual(expect.any(Function));
    expect(devtools.onDevtoolsEvent).toEqual(expect.any(Function));
    expect(devtools.clearDevtoolsListeners).toBeUndefined();
    expect(devtools.emitDevtoolsEvent).toBeUndefined();
    expect(devtools.hasDevtoolsListeners).toBeUndefined();
    expect(devtools.serializeDevtoolsEvent).toBeUndefined();
  });

  it("mounts a component with createApp", async () => {
    const { createApp, h } = await import("solace");
    const container = document.createElement("div");
    const App = () => h("p", null, "mounted");

    createApp(App).mount(container);

    expect(container.innerHTML).toBe("<p>mounted</p>");
  });
});
