import { beforeEach, describe, expect, it } from "vitest";

import { createApp, h, nextTick, ref, useStyle } from "../../../src";
import { renderToString } from "../../../src/server";

describe("useStyle", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("throws when called outside an active render context", () => {
    expect(() => useStyle("abc123", ".counter { color: blue; }")).toThrow(/rendering a component/i);
  });

  it("collects styles during server rendering as serialized style tags", () => {
    const App = () => {
      useStyle("abc123", ".counter { color: blue; }");
      return h("button", { class: "counter" }, "count: 0");
    };

    expect(renderToString(h(App))).toEqual({
      html: '<button class="counter">count: 0</button>',
      styles: ['<style data-s-id="abc123">.counter { color: blue; }</style>'],
    });
  });

  it("dedupes identical registrations and rejects conflicting registrations on the server", () => {
    const StableApp = () => {
      useStyle("abc123", ".counter { color: blue; }");
      useStyle("abc123", ".counter { color: blue; }");
      return h("p", null, "stable");
    };
    const ConflictApp = () => {
      useStyle("abc123", ".counter { color: blue; }");
      useStyle("abc123", ".counter { color: red; }");
      return h("p", null, "conflict");
    };

    expect(renderToString(h(StableApp)).styles).toEqual([
      '<style data-s-id="abc123">.counter { color: blue; }</style>',
    ]);
    expect(() => renderToString(h(ConflictApp))).toThrow(/style conflict/i);
  });

  it("does not duplicate preexisting style tags during hydrate and later updates", async () => {
    document.head.innerHTML = '<style data-s-id="abc123">.counter { color: blue; }</style>';
    const count = ref(0);
    const App = () => {
      useStyle("abc123", ".counter { color: blue; }");
      return h(
        "button",
        { class: "counter", onClick: () => count.value++ },
        `count: ${count.value}`,
      );
    };
    const container = document.createElement("div");
    container.innerHTML = '<button class="counter">count: 0</button>';

    createApp(App).hydrate(container);
    container.querySelector("button")?.click();
    await nextTick();

    expect(container.innerHTML).toBe('<button class="counter">count: 1</button>');
    expect(document.head.querySelectorAll('style[data-s-id="abc123"]')).toHaveLength(1);
  });

  it("dedupes server-escaped style text during hydrate", () => {
    const css = '.counter::before { content: "<&>"; }';
    const App = () => {
      useStyle("abc123", css);
      return h("button", { class: "counter" }, "count: 0");
    };
    const serverRendered = renderToString(h(App));
    const container = document.createElement("div");
    document.head.innerHTML = serverRendered.styles.join("");
    container.innerHTML = serverRendered.html;

    expect(serverRendered.styles).toEqual([
      '<style data-s-id="abc123">.counter::before { content: "<&>"; }</style>',
    ]);
    expect(() => createApp(App).hydrate(container)).not.toThrow();
    expect(document.head.querySelectorAll('style[data-s-id="abc123"]')).toHaveLength(1);
  });

  it("preserves raw CSS semantics when server styles are parsed into the document", () => {
    const css = '.a > .b::before { content: "<&>"; background: url("/x?a=1&b=2"); }';
    const App = () => {
      useStyle("abc123", css);
      return h("button", { class: "a" }, "count: 0");
    };
    const serverRendered = renderToString(h(App));

    document.head.innerHTML = serverRendered.styles.join("");

    expect(document.head.querySelector('style[data-s-id="abc123"]')?.textContent).toBe(css);
  });

  it("neutralizes style end tags in server style text", () => {
    const css = '.counter::before { content: "</style><script>bad()</script>"; }';
    const App = () => {
      useStyle("abc123", css);
      return h("button", { class: "counter" }, "count: 0");
    };
    const serverRendered = renderToString(h(App));
    const container = document.createElement("div");
    document.head.innerHTML = serverRendered.styles.join("");
    container.innerHTML = serverRendered.html;

    expect(document.head.querySelectorAll("style")).toHaveLength(1);
    expect(document.head.querySelectorAll("script")).toHaveLength(0);
    expect(document.head.querySelector('style[data-s-id="abc123"]')?.textContent).toContain(
      "<\\/style>",
    );
    expect(() => createApp(App).hydrate(container)).not.toThrow();
  });

  it("rejects conflicting styles when an existing server style was escaped", () => {
    const ServerApp = () => {
      useStyle("abc123", '.counter::before { content: "<&>"; }');
      return h("button", { class: "counter" }, "count: 0");
    };
    const ClientApp = () => {
      useStyle("abc123", '.counter::before { content: ">&<"; }');
      return h("button", { class: "counter" }, "count: 0");
    };
    const serverRendered = renderToString(h(ServerApp));
    const container = document.createElement("div");
    document.head.innerHTML = serverRendered.styles.join("");
    container.innerHTML = serverRendered.html;

    expect(() => createApp(ClientApp).hydrate(container)).toThrow(/style conflict/i);
  });

  it("rejects literal entity styles that conflict with raw CSS", () => {
    document.head.innerHTML =
      '<style data-s-id="abc123">.counter::before { content: "&lt;"; }</style>';
    const App = () => {
      useStyle("abc123", '.counter::before { content: "<"; }');
      return h("button", { class: "counter" }, "count: 0");
    };
    const container = document.createElement("div");
    container.innerHTML = '<button class="counter">count: 0</button>';

    expect(() => createApp(App).hydrate(container)).toThrow(/style conflict/i);
  });

  it("does not duplicate preexisting style tags during client-only mount", () => {
    document.head.innerHTML = '<style data-s-id="abc123">.counter { color: blue; }</style>';
    const App = () => {
      useStyle("abc123", ".counter { color: blue; }");
      return h("button", { class: "counter" }, "count: 0");
    };
    const container = document.createElement("div");

    createApp(App).mount(container);

    expect(container.innerHTML).toBe('<button class="counter">count: 0</button>');
    expect(document.head.querySelectorAll('style[data-s-id="abc123"]')).toHaveLength(1);
  });
});
