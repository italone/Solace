import { afterEach, describe, expect, it } from "vitest";

import { RouterLink, RouterView, createApp, createMemoryHistory, createRouter, h, nextTick } from "../../src";
import type { RouteRecord, RouteRecordIdentity } from "../../src";
import { renderToStream, renderToStringAsync } from "../../src/server";

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
    h(
      RouterLink,
      { to: { path: "/" }, id: "home-link", target: "_self" },
      "Home",
    ),
    h(RouterView),
  ]);

const SNAPSHOT_MARKER = "window.__SOLACE_ROUTER_SNAPSHOT__=";

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

function seedContainer(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  seededContainers.push(container);
  return container;
}

// jsdom's querySelector("#id") lookups go stale once a second hydrated tree
// with the same ids mutates the shared document, so detach each tree when a
// test finishes to keep id selectors reliable for the next one.
const seededContainers: HTMLElement[] = [];
afterEach(() => {
  for (const container of seededContainers.splice(0)) {
    container.remove();
  }
});

async function renderServerStream(url: string): Promise<string> {
  return collectStream(
    renderToStream(App, {
      router: {
        url,
        routes,
        identifyRecord,
        configure: (router) => {
          router.beforeEach(() => true);
        },
      },
    }),
  );
}

async function hydrateClient(container: HTMLElement, url: string): Promise<void> {
  const router = createRouter({ history: createMemoryHistory(url), routes });
  const app = createApp(App).use(router);
  await app.hydrateAsync(container, { router, routerIdentifyRecord: identifyRecord });
}

describe("renderer-owned router SSR round-trip", () => {
  it("streams the routed view with the snapshot script, then hydrates and removes the script", async () => {
    const html = await renderServerStream("/user/7");

    expect(html).toContain('<main id="router-shell">');
    expect(html).toContain("user profile");
    expect(html).toContain(SNAPSHOT_MARKER);
    expect(html.indexOf(SNAPSHOT_MARKER)).toBeGreaterThan(html.indexOf("user profile"));

    const container = seedContainer(html);
    const serverNode = container.firstChild;
    expect(container.querySelector("script")).not.toBeNull();

    await hydrateClient(container, "/user/7");

    expect(container.querySelector("script")).toBeNull();
    expect(container.firstChild).toBe(serverNode);
    expect(container.textContent).toContain("user profile");
  });

  it("swaps the view after a RouterLink click post-hydration", async () => {
    const html = await renderServerStream("/user/7");
    const container = seedContainer(html);

    await hydrateClient(container, "/user/7");
    expect(container.textContent).toContain("user profile");
    expect(container.textContent).not.toContain("home");

    container.querySelector<HTMLAnchorElement>("#home-link")?.click();
    for (let i = 0; i < 10; i += 1) await nextTick();

    expect(container.querySelector("#home")?.textContent).toBe("home");
    expect(container.textContent).not.toContain("user profile");
  });

  it("round-trips through renderToStringAsync as well", async () => {
    const rendered = await renderToStringAsync(App, {
      router: { url: "/user/7", routes, identifyRecord },
    });

    expect(rendered.html).toContain("user profile");
    expect(rendered.html).toContain(SNAPSHOT_MARKER);

    const container = seedContainer(rendered.html);
    await hydrateClient(container, "/user/7");

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("user profile");
  });
});
