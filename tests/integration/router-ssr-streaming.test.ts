import { describe, expect, it } from "vitest";

import {
  RouterView,
  createApp,
  createMemoryHistory,
  createRouter,
  createRouterSnapshot,
  h,
  verifyRouterSnapshot,
} from "../../src";
import type { RouteRecord } from "../../src";
import { createRouterServerContext, renderToStream, renderToStringAsync } from "../../src/server";

const identifyRecord = (record: RouteRecord): string => record.name ?? record.path;
const RouterApp = () => h("main", { id: "router-shell" }, h(RouterView));

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

function stripStyleTags(html: string): string {
  return html.replace(/<style [^>]*>[\s\S]*?<\/style>/g, "");
}

async function renderStreamedRoute(url: string, routes: RouteRecord[]) {
  const context = await createRouterServerContext({ url, routes, identifyRecord });
  const html = await collectStream(
    renderToStream(RouterApp, { provides: context.provides }),
  );

  return { context, html };
}

describe("router-aware streaming SSR", () => {
  it("streams the same HTML as renderToStringAsync for the routed view", async () => {
    const routes: RouteRecord[] = [
      { path: "/", name: "home", component: () => h("p", null, "home") },
      { path: "/about", name: "about", component: () => h("p", { id: "about" }, "about") },
    ];
    const { context, html } = await renderStreamedRoute("/about", routes);
    const stringRendered = await renderToStringAsync(RouterApp, {
      provides: context.provides,
    });

    expect(stripStyleTags(html)).toBe(stripStyleTags(stringRendered.html));
    expect(html).toContain('<main id="router-shell"><p id="about">about</p></main>');
  });

  it("hydrates the streamed HTML in jsdom", async () => {
    const routes: RouteRecord[] = [
      { path: "/report", name: "report", component: () => h("p", null, "report") },
    ];
    const server = await renderStreamedRoute("/report", routes);
    const container = document.createElement("div");
    container.innerHTML = server.html;
    const serverNode = container.firstChild;

    const router = createRouter({
      history: createMemoryHistory("/report"),
      routes,
    });
    const app = createApp(RouterApp).use(router);
    await router.isReady();

    verifyRouterSnapshot(
      server.context.snapshot,
      createRouterSnapshot(router.currentRoute.value, identifyRecord),
    );

    await app.hydrateAsync(container);

    expect(container.firstChild).toBe(serverNode);
    expect(container.innerHTML).toBe('<main id="router-shell"><p>report</p></main>');
    expect(container.textContent).toBe("report");
  });
});
