import { describe, expect, it } from "vitest";

import {
  RouterHydrationError,
  RouterView,
  createApp,
  createMemoryHistory,
  createRouter,
  createRouterSnapshot,
  h,
  lazyRoute,
  nextTick,
  ref,
  verifyRouterSnapshot,
} from "../../src";
import type { AsyncComponentType, RouteRecord } from "../../src";
import { createRouterServerContext, renderToStringAsync } from "../../src/server";

const identifyRecord = (record: RouteRecord): string => record.name ?? record.path;
const RouterApp = () => h("main", { id: "router-shell" }, h(RouterView));

async function renderServerRoute(url: string, routes: RouteRecord[]) {
  const context = await createRouterServerContext({ url, routes, identifyRecord });
  const rendered = await renderToStringAsync(RouterApp, { provides: context.provides });

  return { context, rendered };
}

describe("Router SSR hydration integration", () => {
  it("hydrates the latest route after an older navigation settles late", async () => {
    const routes: RouteRecord[] = [
      { path: "/", name: "home", component: () => h("p", null, "home") },
      { path: "/slow", name: "slow", component: () => h("p", null, "slow") },
      { path: "/fast", name: "fast", component: () => h("p", null, "fast") },
    ];
    const server = await renderServerRoute("/fast", routes);
    const container = document.createElement("div");
    container.innerHTML = server.rendered.html;
    const serverNode = container.firstChild;
    let allowSlowNavigation!: () => void;
    const router = createRouter({ history: createMemoryHistory(), routes });
    router.beforeEach((to) => {
      if (to.fullPath !== "/slow") return true;
      return new Promise<void>((resolve) => {
        allowSlowNavigation = resolve;
      });
    });
    const app = createApp(RouterApp).use(router);
    await router.isReady();

    const slowNavigation = router.push("/slow");
    await router.push("/fast");
    allowSlowNavigation();
    await expect(slowNavigation).resolves.toMatchObject({ fullPath: "/fast" });

    const clientSnapshot = createRouterSnapshot(router.currentRoute.value, identifyRecord);
    expect(() => verifyRouterSnapshot(server.context.snapshot, clientSnapshot)).not.toThrow();
    await app.hydrateAsync(container);

    expect(router.currentRoute.value.fullPath).toBe("/fast");
    expect(container.firstChild).toBe(serverNode);
    expect(container.textContent).toBe("fast");
  });

  it("blocks hydration when client initial navigation rejects in a guard", async () => {
    const serverRoutes: RouteRecord[] = [
      { path: "/blocked", name: "blocked", component: () => h("p", null, "server blocked") },
    ];
    let clientSetupEntered = false;
    const clientRoutes: RouteRecord[] = [
      {
        path: "/blocked",
        name: "blocked",
        component: () => {
          clientSetupEntered = true;
          return h("p", null, "client blocked");
        },
      },
    ];
    const server = await renderServerRoute("/blocked", serverRoutes);
    const container = document.createElement("div");
    container.innerHTML = server.rendered.html;
    const serverNode = container.firstChild;
    const router = createRouter({
      history: createMemoryHistory("/blocked"),
      routes: clientRoutes,
    });
    router.beforeEach(() => {
      throw new Error("guard rejected");
    });
    createApp(RouterApp).use(router);

    await expect(router.isReady()).rejects.toMatchObject({
      name: "RouterNavigationError",
      type: "guard-rejected",
      to: { fullPath: "/blocked" },
    });
    expect(clientSetupEntered).toBe(false);
    expect(container.firstChild).toBe(serverNode);
    expect(container.innerHTML).toBe(server.rendered.html);
  });

  it("fails snapshot verification before client setup or DOM hydration", async () => {
    const serverRoutes: RouteRecord[] = [
      { path: "/server", name: "server", component: () => h("p", null, "server route") },
    ];
    let clientSetupEntered = false;
    const clientRoutes: RouteRecord[] = [
      {
        path: "/client",
        name: "client",
        component: () => {
          clientSetupEntered = true;
          return h("p", null, "client route");
        },
      },
    ];
    const server = await renderServerRoute("/server", serverRoutes);
    const container = document.createElement("div");
    container.innerHTML = server.rendered.html;
    const serverNode = container.firstChild;
    const router = createRouter({
      history: createMemoryHistory("/client"),
      routes: clientRoutes,
    });
    createApp(RouterApp).use(router);
    await router.isReady();

    const clientSnapshot = createRouterSnapshot(router.currentRoute.value, identifyRecord);
    expect(() => verifyRouterSnapshot(server.context.snapshot, clientSnapshot)).toThrowError(
      expect.objectContaining({ name: "RouterHydrationError", field: "fullPath" }),
    );
    expect(() => verifyRouterSnapshot(server.context.snapshot, clientSnapshot)).toThrow(
      RouterHydrationError,
    );
    expect(clientSetupEntered).toBe(false);
    expect(container.firstChild).toBe(serverNode);
    expect(container.innerHTML).toBe(server.rendered.html);
  });

  it("leaves server DOM untouched when a client lazy route fails during preparation", async () => {
    const serverRoutes: RouteRecord[] = [
      { path: "/report", name: "report", component: () => h("p", null, "report") },
    ];
    const clientRoutes: RouteRecord[] = [
      {
        path: "/report",
        name: "report",
        component: lazyRoute(() => Promise.reject(new Error("report load failed"))),
      },
    ];
    const server = await renderServerRoute("/report", serverRoutes);
    const container = document.createElement("div");
    container.innerHTML = server.rendered.html;
    const serverNode = container.firstChild;
    const router = createRouter({
      history: createMemoryHistory("/report"),
      routes: clientRoutes,
    });
    const app = createApp(RouterApp).use(router);
    await router.isReady();
    verifyRouterSnapshot(
      server.context.snapshot,
      createRouterSnapshot(router.currentRoute.value, identifyRecord),
    );

    await expect(app.hydrateAsync(container)).rejects.toMatchObject({
      name: "RouterNavigationError",
      type: "lazy-load-failed",
      to: { fullPath: "/report" },
    });
    expect(container.firstChild).toBe(serverNode);
    expect(container.innerHTML).toBe(server.rendered.html);
    expect((container as { _solaceVNode?: unknown })._solaceVNode).toBeUndefined();
  });

  it("installs reactive updates after async router hydration", async () => {
    const serverRoutes: RouteRecord[] = [
      { path: "/counter", name: "counter", component: () => h("button", null, "count: 0") },
    ];
    const count = ref(0);
    const clientRoutes: RouteRecord[] = [
      {
        path: "/counter",
        name: "counter",
        component: () => h("button", { onClick: () => count.value++ }, `count: ${count.value}`),
      },
    ];
    const AsyncRouterApp: AsyncComponentType = async () => {
      await Promise.resolve();
      return () => RouterApp();
    };
    const server = await renderServerRoute("/counter", serverRoutes);
    const container = document.createElement("div");
    container.innerHTML = server.rendered.html;
    const serverNode = container.firstChild;
    const router = createRouter({
      history: createMemoryHistory("/counter"),
      routes: clientRoutes,
    });
    const app = createApp(AsyncRouterApp).use(router);
    await router.isReady();
    verifyRouterSnapshot(
      server.context.snapshot,
      createRouterSnapshot(router.currentRoute.value, identifyRecord),
    );

    await app.hydrateAsync(container);
    expect(container.firstChild).toBe(serverNode);

    container.querySelector("button")?.click();
    await nextTick();

    expect(container.innerHTML).toBe('<main id="router-shell"><button>count: 1</button></main>');
  });
});
