import { describe, expect, it } from "vitest";

import {
  RouterHydrationError,
  RouterView,
  createApp,
  createMemoryHistory,
  createRouter,
  h,
} from "../../../src";
import type { RouteRecord, RouteRecordIdentity } from "../../../src";
import { renderToStringAsync } from "../../../src/server";

const identifyRecord: RouteRecordIdentity = (record) => record.name ?? record.path;
const routes: RouteRecord[] = [
  { path: "/", name: "home", component: () => h("p", null, "home") },
  {
    path: "/user/:id",
    name: "user",
    component: () => h("p", null, "user profile"),
  },
];
const App = () => h("main", { id: "router-shell" }, h(RouterView));

const SNAPSHOT_MARKER = "window.__SOLACE_ROUTER_SNAPSHOT__=";

async function renderServerHtml(url: string): Promise<string> {
  const rendered = await renderToStringAsync(App, {
    router: { url, routes, identifyRecord },
  });
  return rendered.html;
}

function seedContainer(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

function seedSnapshotGlobal(html: string): void {
  const payload = html.slice(
    html.indexOf(SNAPSHOT_MARKER) + SNAPSHOT_MARKER.length,
    html.lastIndexOf(";"),
  );
  (window as unknown as Record<string, unknown>).__SOLACE_ROUTER_SNAPSHOT__ = JSON.parse(payload);
}

function clearSnapshotGlobal(): void {
  delete (window as unknown as Record<string, unknown>).__SOLACE_ROUTER_SNAPSHOT__;
}

function buildClientRouter(url: string) {
  return createRouter({ history: createMemoryHistory(url), routes });
}

describe("hydrateAsync router option", () => {
  it("verifies the embedded snapshot, removes the script, and hydrates", async () => {
    const html = await renderServerHtml("/user/7");
    const container = seedContainer(html);
    const serverNode = container.firstChild;

    const router = buildClientRouter("/user/7");
    const app = createApp(App).use(router);
    await app.hydrateAsync(container, { router, routerIdentifyRecord: identifyRecord });

    expect(container.querySelector("script")).toBeNull();
    expect(container.firstChild).toBe(serverNode);
    expect(container.textContent).toContain("user profile");
  });

  it("falls back to the window global when the snapshot script is absent", async () => {
    const html = await renderServerHtml("/");
    const container = seedContainer(html);
    container.querySelector("script")?.remove();
    seedSnapshotGlobal(html);

    const router = buildClientRouter("/");
    const app = createApp(App).use(router);
    await app.hydrateAsync(container, { router, routerIdentifyRecord: identifyRecord });

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("home");
    clearSnapshotGlobal();
  });

  it("throws RouterHydrationError when the client route differs from the snapshot", async () => {
    const html = await renderServerHtml("/user/7");
    const container = seedContainer(html);

    const router = buildClientRouter("/");
    const app = createApp(App).use(router);

    await expect(
      app.hydrateAsync(container, { router, routerIdentifyRecord: identifyRecord }),
    ).rejects.toThrow(RouterHydrationError);
    expect(container.querySelector("script")?.textContent ?? "").toContain(SNAPSHOT_MARKER);
  });

  it("throws when no snapshot payload is present", async () => {
    const container = seedContainer("<p>x</p>");

    const router = buildClientRouter("/");
    const app = createApp(App).use(router);

    await expect(
      app.hydrateAsync(container, { router, routerIdentifyRecord: identifyRecord }),
    ).rejects.toThrow(/__solace-router-snapshot/);
  });

  it("still validates the router option shape", async () => {
    const container = seedContainer("<p>x</p>");
    const app = createApp(() => h("p", null, "x"));

    await expect(app.hydrateAsync(container, { router: {} as never })).rejects.toThrow(
      "Hydration router option must be a Router instance",
    );
    await expect(
      app.hydrateAsync(container, {
        router: buildClientRouter("/"),
        routerIdentifyRecord: "nope" as never,
      }),
    ).rejects.toThrow("Hydration routerIdentifyRecord must be a function when router is provided");
    await expect(
      app.hydrateAsync(container, { routerIdentifyRecord: identifyRecord }),
    ).rejects.toThrow("Hydration routerIdentifyRecord requires the router option");
    await expect(
      app.hydrateAsync(container, {
        router: buildClientRouter("/"),
        routerIdentifyRecord: identifyRecord,
        selective: true,
      }),
    ).rejects.toThrow("Router-aware selective hydration is not supported yet");
  });
});
