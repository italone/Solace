import { describe, expect, it } from "vitest";

import {
  Fragment,
  RouterView,
  createApp,
  createMemoryHistory,
  createRouter,
  defineAsyncComponent,
  h,
} from "../../src";
import type { RouteRecord, RouteRecordIdentity } from "../../src";
import { SolaceHydrationError } from "../../src/renderer/renderer";
import { renderToStream, renderToStringAsync } from "../../src/server";

describe("SSR hydration mismatch integration", () => {
  it("rejects on an attribute mismatch end-to-end and recovers with the client value", async () => {
    const ServerApp = () => h("a", { href: "/old" }, "link");
    const ClientApp = () => h("a", { href: "/new" }, "link");

    const server = await renderToStringAsync(h(ServerApp));

    const strictContainer = document.createElement("div");
    strictContainer.innerHTML = server.html;
    document.body.appendChild(strictContainer);
    await expect(createApp(ClientApp).hydrateAsync(strictContainer)).rejects.toMatchObject({
      kind: "attribute-mismatch",
      attributeName: "href",
      name: "SolaceHydrationError",
    });
    expect(strictContainer.querySelector("a")?.getAttribute("href")).toBe("/old");

    const recoverContainer = document.createElement("div");
    recoverContainer.innerHTML = server.html;
    document.body.appendChild(recoverContainer);
    await createApp(ClientApp).hydrateAsync(recoverContainer, { recover: true });

    expect(recoverContainer.innerHTML).toBe('<a href="/new">link</a>');
  });

  it("replaces a mismatched pending out-of-order boundary without rejecting", async () => {
    // The streamed fallback DOM never matches the resolved subtree by
    // construction; while the boundary is still pending, selective hydration
    // claims the ready shell and the resolved content replaces the fallback
    // DOM wholesale once the loader settles — no mismatch is thrown.
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const AsyncPart = defineAsyncComponent({
      loader: () => gate.then(() => Promise.resolve(() => h("em", { id: "late" }, "resolved"))),
      fallback: h("p", null, "loading…"),
    });
    const App = () => h(Fragment, null, [h("button", { id: "inc" }, "shell"), h(AsyncPart)]);

    const decoder = new TextDecoder();
    const reader = renderToStream(App, { mode: "out-of-order" }).getReader();
    let html = "";
    while (!html.includes("loading…")) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    void reader.cancel();

    const container = document.createElement("div");
    container.innerHTML = html.replace(/<!--so:r:\d+-->|<script>[\s\S]*?<\/script>/gu, "");
    document.body.appendChild(container);

    const hydration = createApp(App).hydrateAsync(container, { selective: true });
    release!();

    await expect(hydration).resolves.toBeUndefined();

    expect(container.textContent).not.toContain("loading…");
    expect(container.querySelector("#late")?.textContent).toBe("resolved");
    expect(container.querySelector("#inc")?.textContent).toBe("shell");
  });

  it("throws when the loader resolved before hydration sees the fallback", async () => {
    // Discovered contract: if the async boundary resolves before hydration
    // reaches it, the resolved subtree is hydrated against the streamed
    // fallback DOM, and the mismatch is reported like any other.
    const AsyncPart = defineAsyncComponent({
      loader: async () => () => h("em", { id: "late" }, "resolved"),
      fallback: h("p", null, "loading…"),
    });
    const App = () => h(Fragment, null, [h("button", { id: "inc" }, "shell"), h(AsyncPart)]);

    const decoder = new TextDecoder();
    const reader = renderToStream(App, { mode: "out-of-order" }).getReader();
    let html = "";
    while (!html.includes("loading…")) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    void reader.cancel();

    const container = document.createElement("div");
    container.innerHTML = html.replace(/<!--so:r:\d+-->|<script>[\s\S]*?<\/script>/gu, "");
    document.body.appendChild(container);

    // Let the microtask-backed loader settle before hydrating.
    await Promise.resolve();
    await expect(createApp(App).hydrateAsync(container, { selective: true })).rejects.toMatchObject(
      { kind: "element-tag-mismatch", path: "root[1]" },
    );
  });

  it("still throws when server html outside a pending boundary is corrupted", async () => {
    const AsyncPart = defineAsyncComponent({
      loader: () => new Promise<never>(() => {}),
      fallback: h("p", null, "loading…"),
    });
    const App = () => h(Fragment, null, [h("button", { id: "inc" }, "shell"), h(AsyncPart)]);

    const decoder = new TextDecoder();
    const reader = renderToStream(App, { mode: "out-of-order" }).getReader();
    let html = "";
    while (!html.includes("loading…")) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    void reader.cancel();

    // Corrupt the ready shell outside the boundary: the client expects a
    // <button> but the server markup was damaged into a <span>.
    const container = document.createElement("div");
    container.innerHTML = html
      .replace(/<!--so:r:\d+-->|<script>[\s\S]*?<\/script>/gu, "")
      .replace("<button", "<span")
      .replace("</button>", "</span>");
    document.body.appendChild(container);

    await expect(createApp(App).hydrateAsync(container, { selective: true })).rejects.toThrow(
      SolaceHydrationError,
    );
  });
});

const identifyRecord: RouteRecordIdentity = (record) => record.name ?? record.path;
const routes: RouteRecord[] = [
  { path: "/user/:id", name: "user", component: () => h("p", null, "user profile") },
];
const RouterApp = () => h("main", { id: "router-shell" }, h(RouterView));

describe("router-aware hydration with corrupted DOM", () => {
  it("rejects with SolaceHydrationError after a valid snapshot passes", async () => {
    const rendered = await renderToStringAsync(RouterApp, {
      router: { url: "/user/7", routes, identifyRecord },
    });

    // Corrupt the DOM (tag swapped) while the embedded snapshot stays intact
    // and the client route matches it.
    const container = document.createElement("div");
    container.innerHTML = rendered.html
      .replace("<main", "<section")
      .replace("</main>", "</section>");
    document.body.appendChild(container);

    const router = createRouter({ history: createMemoryHistory("/user/7"), routes });
    const app = createApp(RouterApp).use(router);

    await expect(
      app.hydrateAsync(container, { router, routerIdentifyRecord: identifyRecord }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof SolaceHydrationError && error.name === "SolaceHydrationError",
    );
  });

  it("verifies the snapshot before walking the DOM when both mismatch", async () => {
    const rendered = await renderToStringAsync(RouterApp, {
      router: { url: "/user/7", routes, identifyRecord },
    });

    const container = document.createElement("div");
    container.innerHTML = rendered.html
      .replace("<main", "<section")
      .replace("</main>", "</section>");
    document.body.appendChild(container);

    // The client route diverges from the snapshot AND the DOM is corrupted;
    // snapshot verification runs first, so the router error wins.
    const wrongRoutes: RouteRecord[] = [
      { path: "/", name: "home", component: () => h("p", null, "home") },
    ];
    const router = createRouter({ history: createMemoryHistory("/"), routes: wrongRoutes });
    const app = createApp(RouterApp).use(router);

    await expect(
      app.hydrateAsync(container, { router, routerIdentifyRecord: identifyRecord }),
    ).rejects.toMatchObject({ name: "RouterHydrationError" });
  });
});
