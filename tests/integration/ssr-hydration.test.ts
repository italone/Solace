import { describe, expect, it } from "vitest";

import { createApp, h, inject, nextTick, provide, ref } from "../../src";
import type { AsyncComponentType, ComponentRender } from "../../src";
import { renderToString, renderToStringAsync } from "../../src/server";

describe("SSR hydration integration", () => {
  it("prepares async hydration before reusing server DOM and installing updates", async () => {
    const count = ref(0);
    let resolveSetup!: (render: ComponentRender) => void;
    const setup = new Promise<ComponentRender>((resolve) => {
      resolveSetup = resolve;
    });
    const AsyncApp: AsyncComponentType = () => setup;
    const server = await renderToStringAsync(
      h("button", { onClick: () => count.value++ }, `count: ${count.value}`),
    );
    const container = document.createElement("div");
    container.innerHTML = server.html;
    const serverNode = container.firstChild;
    const hydration = createApp(AsyncApp).hydrateAsync(container);

    expect(container.firstChild).toBe(serverNode);
    expect(container.innerHTML).toBe("<button>count: 0</button>");
    expect((container as { _solaceVNode?: unknown })._solaceVNode).toBeUndefined();

    resolveSetup(() => h("button", { onClick: () => count.value++ }, `count: ${count.value}`));
    await hydration;

    expect(container.firstChild).toBe(serverNode);
    container.querySelector("button")?.click();
    await nextTick();
    expect(container.innerHTML).toBe("<button>count: 1</button>");
  });

  it("leaves server DOM and container state unchanged when async preparation fails", async () => {
    const failure = new Error("async setup failed");
    const AsyncApp: AsyncComponentType = async () => {
      await Promise.resolve();
      throw failure;
    };
    const container = document.createElement("div");
    container.innerHTML = "<p>server stays</p>";
    const serverNode = container.firstChild;

    await expect(createApp(AsyncApp).hydrateAsync(container)).rejects.toBe(failure);

    expect(container.firstChild).toBe(serverNode);
    expect(container.innerHTML).toBe("<p>server stays</p>");
    expect((container as { _solaceVNode?: unknown })._solaceVNode).toBeUndefined();
    expect((container as { _solaceRenderEffect?: unknown })._solaceRenderEffect).toBeUndefined();
  });

  it("renders HTML on the server and hydrates browser behavior", async () => {
    const count = ref(0);
    const App = () => h("button", { onClick: () => count.value++ }, `count: ${count.value}`);
    const server = renderToString(h(App));
    const container = document.createElement("div");
    container.innerHTML = server.html;
    const button = container.querySelector("button");

    createApp(App).hydrate(container);
    container.querySelector("button")?.click();
    await nextTick();

    expect(server.styles).toEqual([]);
    expect(container.querySelector("button")).toBe(button);
    expect(container.innerHTML).toBe("<button>count: 1</button>");
  });

  it("preserves app provide and inject during hydration", () => {
    const ThemeKey = Symbol("theme");
    const Child = () => h("span", null, String(inject(ThemeKey, "light")));
    const App = () => {
      provide(ThemeKey, "dark");
      return h(Child);
    };
    const server = renderToString(h(App));
    const container = document.createElement("div");
    container.innerHTML = server.html;

    createApp(App).hydrate(container);

    expect(container.innerHTML).toBe("<span>dark</span>");
  });

  it("can recover a mismatched SSR shell into the client tree", async () => {
    const count = ref(0);
    const ServerApp = () => h("span", null, "server");
    const ClientApp = () =>
      h("button", { onClick: () => count.value++ }, `client count: ${count.value}`);
    const server = renderToString(h(ServerApp));
    const container = document.createElement("div");
    container.innerHTML = server.html;

    createApp(ClientApp).hydrate(container, { recover: true });
    container.querySelector("button")?.click();
    await nextTick();

    expect(container.innerHTML).toBe("<button>client count: 1</button>");
  });
});
