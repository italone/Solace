import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);

describe("package exports", () => {
  it("builds root, JSX runtime, DevTools, and Vite artifacts", () => {
    expect(existsSync(resolve(root, "dist/index.js"))).toBe(true);
    expect(existsSync(resolve(root, "dist/index.cjs"))).toBe(true);
    expect(existsSync(resolve(root, "dist/index.d.ts"))).toBe(true);
    expect(existsSync(resolve(root, "dist/jsx-runtime.js"))).toBe(true);
    expect(existsSync(resolve(root, "dist/jsx-runtime.d.ts"))).toBe(true);
    expect(existsSync(resolve(root, "dist/jsx-dev-runtime.js"))).toBe(true);
    expect(existsSync(resolve(root, "dist/jsx-dev-runtime.d.ts"))).toBe(true);
    expect(existsSync(resolve(root, "dist/vite.js"))).toBe(true);
    expect(existsSync(resolve(root, "dist/vite.cjs"))).toBe(true);
    expect(existsSync(resolve(root, "dist/vite.d.ts"))).toBe(true);
    expect(existsSync(resolve(root, "dist/sfc.js"))).toBe(true);
    expect(existsSync(resolve(root, "dist/sfc.cjs"))).toBe(true);
    expect(existsSync(resolve(root, "dist/sfc.d.ts"))).toBe(true);
    expect(existsSync(resolve(root, "dist/server.js"))).toBe(true);
    expect(existsSync(resolve(root, "dist/server.cjs"))).toBe(true);
    expect(existsSync(resolve(root, "dist/server.d.ts"))).toBe(true);
  });

  it("keeps package exports limited to documented public entries", () => {
    const packageJson = require(resolve(root, "package.json")) as {
      exports: Record<string, unknown>;
    };

    expect(Object.keys(packageJson.exports).sort()).toEqual([
      ".",
      "./devtools",
      "./jsx-dev-runtime",
      "./jsx-runtime",
      "./package.json",
      "./server",
      "./sfc",
      "./vite",
    ]);
  });

  it("does not publish production sourcemaps", () => {
    const sourcemaps = readdirSync(resolve(root, "dist"))
      .filter((entry) => entry.endsWith(".map"))
      .sort();

    expect(sourcemaps).toEqual([]);
  });

  it("exports the public root API", async () => {
    const api = await import("@italone/solace");

    expect(api).toMatchObject({
      createApp: expect.any(Function),
      createRouter: expect.any(Function),
      createWebHashHistory: expect.any(Function),
      createWebHistory: expect.any(Function),
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
      RouterLink: expect.any(Function),
      RouterView: expect.any(Function),
      useRoute: expect.any(Function),
      useRouter: expect.any(Function),
      useStyle: expect.any(Function),
      watch: expect.any(Function),
      watchEffect: expect.any(Function),
    });
    expect(Object.keys(api).sort()).toEqual([
      "Fragment",
      "RouterLink",
      "RouterView",
      "computed",
      "createApp",
      "createRouter",
      "createStore",
      "createWebHashHistory",
      "createWebHistory",
      "defineAsyncComponent",
      "defineComponent",
      "effect",
      "h",
      "inject",
      "nextTick",
      "onMounted",
      "onUnmounted",
      "onUpdated",
      "provide",
      "reactive",
      "ref",
      "render",
      "useRoute",
      "useRouter",
      "useStyle",
      "watch",
      "watchEffect",
    ]);
    expect(api).not.toHaveProperty("createMemoryHistory");
    expect(api).not.toHaveProperty("NavigationGuard");
    expect(api).not.toHaveProperty("RouteMeta");
    expect(api).not.toHaveProperty("createSSRRouter");
  });

  it("does not expose internal runtime helpers from the package root", async () => {
    const api = await import("@italone/solace");

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
    const devtools = await import("@italone/solace/devtools");

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
    const runtime = await import("@italone/solace/jsx-runtime");
    const devRuntime = await import("@italone/solace/jsx-dev-runtime");

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

  it("exports the public Vite plugin subpath", async () => {
    const vite = await import("@italone/solace/vite");

    expect(Object.keys(vite).sort()).toEqual(["default", "solacePlugin"]);
    expect(vite).toMatchObject({
      default: expect.any(Function),
      solacePlugin: expect.any(Function),
    });
    expect(vite).not.toHaveProperty("compile");
    expect(vite).not.toHaveProperty("SolaceCompileError");
    expect(vite).not.toHaveProperty("parseSFC");
    expect(vite).not.toHaveProperty("parseTemplate");
    expect(vite).not.toHaveProperty("generateRender");
    expect(vite).not.toHaveProperty("scopeStyle");
  });

  it("enforces the public Vite plugin contract from the package subpath", async () => {
    const vite = await import("@italone/solace/vite");

    expect(() => vite.solacePlugin({ customBlocks: true } as never)).toThrow(
      /Solace Vite plugin options are not part of the public contract/,
    );
  });

  it("exports the SFC type shim subpath", async () => {
    const sfc = await import("@italone/solace/sfc");

    expect(Object.keys(sfc)).toEqual([]);
  });

  it("exports the public server rendering subpath", async () => {
    const server = await import("@italone/solace/server");

    expect(Object.keys(server).sort()).toEqual(["generateStaticSite", "renderToString"]);
    expect(server.generateStaticSite).toEqual(expect.any(Function));
    expect(server.renderToString).toEqual(expect.any(Function));
    expect(server).not.toHaveProperty("hydrate");
    expect(server).not.toHaveProperty("patch");
  });

  it("enforces router beta boundaries from the package root", async () => {
    const api = await import("@italone/solace");
    const history = {
      location: () => "/",
      push: () => undefined,
      replace: () => undefined,
      listen: () => () => undefined,
      back: () => undefined,
      forward: () => undefined,
    };
    const Home = () => api.h("p", null, "home");

    expect(() =>
      api.createRouter({
        history,
        routes: [{ path: "/nested", component: Home, children: [] }],
      } as never),
    ).toThrow(/Deferred router route record field/);
    expect(() =>
      api.createRouter({
        history,
        routes: [{ path: 42, component: Home }],
      } as never),
    ).toThrow(/Router route record path must be a string/);
    expect(() =>
      api.createRouter({
        history,
        routes: null,
      } as never),
    ).toThrow(/Router routes must be an array/);
    expect(() =>
      api.createRouter({
        history,
        routes: [{ path: "/", component: Home }],
        scrollBehavior: () => ({ left: 0, top: 0 }),
      } as never),
    ).toThrow(/Deferred router option/);
    expect(() =>
      api.createRouter({
        history,
        routes: [{ path: "/users/:id?", component: Home }],
      }),
    ).toThrow(/Deferred router path syntax/);
  });

  it("enforces SSR and SSG manifest/router boundaries from the server subpath", async () => {
    const server = await import("@italone/solace/server");
    const source = null as never;

    expect(() => server.renderToString(source, { manifest: {} } as never)).toThrow(
      /SSR manifest integration is deferred/,
    );
    expect(() => server.renderToString(source, { clientEntry: "/src/main.ts" } as never)).toThrow(
      /SSR manifest integration is deferred/,
    );
    expect(() => server.renderToString(source, { router: {} } as never)).toThrow(
      /Router-aware SSR integration is deferred/,
    );

    expect(() =>
      server.generateStaticSite({
        routes: [{ path: "/", source }],
        manifest: {},
      } as never),
    ).toThrow(/SSG manifest integration is deferred/);
    expect(() =>
      server.generateStaticSite({
        routes: [{ path: "/", source }],
        clientEntry: "/src/main.ts",
      } as never),
    ).toThrow(/SSG manifest integration is deferred/);
    expect(() =>
      server.generateStaticSite({
        routes: [{ path: "/", source }],
        router: {},
      } as never),
    ).toThrow(/Router-aware SSG integration is deferred/);

    expect(() =>
      server.generateStaticSite({
        routes: [{ path: 42, source }],
      } as never),
    ).toThrow(/SSG route path must be a string/);
  });

  it("supports CommonJS package exports", () => {
    const api = require("@italone/solace") as Record<string, unknown>;
    const runtime = require("@italone/solace/jsx-runtime") as Record<string, unknown>;
    const devRuntime = require("@italone/solace/jsx-dev-runtime") as Record<string, unknown>;
    const devtools = require("@italone/solace/devtools") as Record<string, unknown>;
    const vite = require("@italone/solace/vite") as Record<string, unknown>;
    const sfc = require("@italone/solace/sfc") as Record<string, unknown>;
    const server = require("@italone/solace/server") as Record<string, unknown>;

    expect(api.createApp).toEqual(expect.any(Function));
    expect(api.createRouter).toEqual(expect.any(Function));
    expect(api.createWebHashHistory).toEqual(expect.any(Function));
    expect(api.createWebHistory).toEqual(expect.any(Function));
    expect(api.defineAsyncComponent).toEqual(expect.any(Function));
    expect(api.defineComponent).toEqual(expect.any(Function));
    expect(api.inject).toEqual(expect.any(Function));
    expect(api.provide).toEqual(expect.any(Function));
    expect(api.reactive).toEqual(expect.any(Function));
    expect(api.RouterLink).toEqual(expect.any(Function));
    expect(api.RouterView).toEqual(expect.any(Function));
    expect(api.useRoute).toEqual(expect.any(Function));
    expect(api.useRouter).toEqual(expect.any(Function));
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
    expect(vite.default).toEqual(expect.any(Function));
    expect(vite.solacePlugin).toEqual(expect.any(Function));
    expect(Object.keys(vite).sort()).toEqual(["default", "solacePlugin"]);
    expect(Object.keys(sfc)).toEqual([]);
    expect(Object.keys(server).sort()).toEqual(["generateStaticSite", "renderToString"]);
    expect(server.generateStaticSite).toEqual(expect.any(Function));
    expect(server.renderToString).toEqual(expect.any(Function));
  });

  it("rejects private package subpaths", async () => {
    const privateSubpaths = [
      "@italone/solace/compiler",
      "@italone/solace/router",
      "@italone/solace/dist/index.js",
      "@italone/solace/dist/vite.js",
    ];

    for (const subpath of privateSubpaths) {
      await expect(import(subpath)).rejects.toThrow(
        /Package subpath|specifier|Cannot find|not exported/,
      );
      expect(() => require(subpath)).toThrow(/Package subpath|specifier|Cannot find|not exported/);
    }
  });

  it("mounts a component with createApp", async () => {
    const { createApp, h } = await import("@italone/solace");
    const container = document.createElement("div");
    const App = () => h("p", null, "mounted");

    createApp(App).mount(container);

    expect(container.innerHTML).toBe("<p>mounted</p>");
  });
});
