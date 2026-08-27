import { afterEach, describe, expect, it } from "vitest";

import { RouterLink, RouterView, createApp, createMemoryHistory, createRouter, h } from "../../src";
import type { RouteRecord, RouteRecordIdentity } from "../../src";
import { renderToStream } from "../../src/server";

const identifyRecord: RouteRecordIdentity = (record) => record.name ?? record.path;
const routes: RouteRecord[] = [
  { path: "/", name: "home", component: () => h("p", { id: "home" }, "home") },
  {
    path: "/user/:id",
    name: "user",
    component: () => h("p", null, "user profile"),
  },
];
const App = () =>
  h("main", { id: "router-shell" }, [
    h(RouterLink, { to: { path: "/" }, id: "home-link", target: "_self" }, "Home"),
    h(RouterView),
  ]);

const manifest = {
  "src/main.ts": {
    file: "assets/main.js",
    css: ["assets/main.css"],
  },
};
const clientEntry = "src/main.ts";
const STYLESHEET_TAG = '<link rel="stylesheet" href="/assets/main.css">';
const ENTRY_SCRIPT_TAG = '<script type="module" src="/assets/main.js"></script>';
const SNAPSHOT_MARKER = "__solace-router-snapshot";

async function collectStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let out = "";
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

// See the matching comment in router-owned-ssr.test.ts: detach each hydrated
// tree after a test so jsdom id selectors stay reliable across tests.
const seededContainers: HTMLElement[] = [];
afterEach(() => {
  for (const container of seededContainers.splice(0)) {
    container.remove();
  }
});

function seedContainer(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  seededContainers.push(container);
  return container;
}

async function renderServerStream(url: string): Promise<string> {
  return collectStream(
    renderToStream(App, {
      manifest,
      clientEntry,
      router: { url, routes, identifyRecord },
    }),
  );
}

async function hydrateClient(container: HTMLElement, url: string): Promise<void> {
  const router = createRouter({ history: createMemoryHistory(url), routes });
  const app = createApp(App).use(router);
  await app.hydrateAsync(container, { router, routerIdentifyRecord: identifyRecord });
}

describe("SSR asset injection round-trip", () => {
  it("injects stylesheet, entry script, and router snapshot in contract order", async () => {
    const html = await renderServerStream("/user/7");

    expect(html).toContain("user profile");
    expect(html).toContain(STYLESHEET_TAG);
    expect(html).toContain(ENTRY_SCRIPT_TAG);
    expect(html.indexOf(STYLESHEET_TAG)).toBeGreaterThan(html.indexOf("user profile"));
    expect(html.indexOf(ENTRY_SCRIPT_TAG)).toBeGreaterThan(html.indexOf(STYLESHEET_TAG));
    expect(html.indexOf("assets/main.js")).toBeLessThan(html.indexOf(SNAPSHOT_MARKER));
  });

  it("hydrates the routed view and removes the snapshot script alongside the asset tags", async () => {
    const html = await renderServerStream("/user/7");

    // Hydration strictly rejects extra sibling nodes, so the injected asset
    // <link>/<script> tags must live outside the hydrated container — the same
    // way a browser places head/body asset tags around the app mount point.
    // This was confirmed empirically: hydrating the container with the tags in
    // place throws SolaceHydrationError "expected no DOM node but found <link>".
    const containerHtml = html.replace(STYLESHEET_TAG, "").replace(ENTRY_SCRIPT_TAG, "");
    const container = seedContainer(containerHtml);
    const serverNode = container.querySelector("main");

    await hydrateClient(container, "/user/7");

    expect(container.textContent).toContain("user profile");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("main")).toBe(serverNode);
  });
});
