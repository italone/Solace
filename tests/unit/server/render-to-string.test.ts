import { describe, expect, it, vi } from "vitest";

import {
  Fragment,
  defineAsyncComponent,
  h,
  inject,
  onMounted,
  onUnmounted,
  onUpdated,
  provide,
  useStyle,
} from "../../../src";
import type { AsyncComponentType } from "../../../src";
import { renderToString, renderToStringAsync } from "../../../src/server";

describe("renderToString", () => {
  it("serializes elements, text, fragments, and synchronous components", () => {
    const Message = () => h("strong", { class: "label" }, "hello");

    const result = renderToString(
      h(Fragment, null, [h("p", { id: "intro", "data-active": true }, "count < 1"), h(Message)]),
    );

    expect(result).toEqual({
      html: '<p id="intro" data-active="true">count &lt; 1</p><strong class="label">hello</strong>',
      styles: [],
    });
  });

  it("escapes attributes and omits event props and falsey attributes", () => {
    const result = renderToString(
      h(
        "button",
        {
          title: '5 > "4"',
          disabled: false,
          "data-empty": null,
          "aria-label": undefined,
          onClick: () => undefined,
          key: "ignored",
        },
        "Save & continue",
      ),
    );

    expect(result.html).toBe('<button title="5 &gt; &quot;4&quot;">Save &amp; continue</button>');
  });

  it("rejects unsafe element and attribute names", () => {
    expect(() => renderToString(h("div onclick=alert(1)", null, "bad"))).toThrow(TypeError);
    expect(() => renderToString(h("p", { "bad name": "x" }, "bad"))).toThrow(TypeError);
  });

  it("does not run DOM lifecycle hooks on the server", () => {
    const mounted = vi.fn();
    const updated = vi.fn();
    const unmounted = vi.fn();
    const App = () => {
      onMounted(mounted);
      onUpdated(updated);
      onUnmounted(unmounted);

      return h("p", null, "server");
    };

    expect(renderToString(h(App)).html).toBe("<p>server</p>");
    expect(mounted).not.toHaveBeenCalled();
    expect(updated).not.toHaveBeenCalled();
    expect(unmounted).not.toHaveBeenCalled();
  });

  it("treats a function source as a component", () => {
    const App = () => () => h("p", null, "component source");

    expect(renderToString(App).html).toBe("<p>component source</p>");
  });

  it("rejects invalid render sources", () => {
    for (const source of [null, {}, "page"]) {
      expect(() => renderToString(source as never)).toThrow(
        TypeError("SSR source must be a VNode or component function"),
      );
    }
  });

  it("rejects invalid render options", () => {
    for (const options of [null, [], "options"]) {
      expect(() => renderToString(h("p", null, "server"), options as never)).toThrow(
        TypeError("SSR options must be an object"),
      );
    }
  });

  it("rejects async component SSR instead of rendering an empty subtree", () => {
    const AsyncApp = async () => h("p", null, "async");
    const AsyncSetupApp = () => async () => h("p", null, "async setup");
    const asyncSource = Promise.resolve(h("p", null, "async source"));
    const asyncChild = Promise.resolve(h("span", null, "async child"));

    expect(() => renderToString(asyncSource as never)).toThrow(/Async SSR is deferred/);
    expect(() => renderToString(AsyncApp as never)).toThrow(/Async SSR is deferred/);
    expect(() => renderToString(h(AsyncSetupApp as never))).toThrow(/Async SSR is deferred/);
    expect(() => renderToString(h("p", null, asyncChild as never))).toThrow(
      /Async SSR is deferred/,
    );
  });

  it("preserves component provide chains and app-level provides", () => {
    const Child = () => {
      const message = inject("message", "missing");
      const theme = inject("theme", "light");

      return h("span", null, `${message}:${theme}`);
    };
    const Parent = () => {
      provide("message", "parent");

      return h(Child);
    };

    expect(
      renderToString(h(Parent), {
        provides: new Map([["theme", "dark"]]),
      }).html,
    ).toBe("<span>parent:dark</span>");
  });

  it("rejects non-Map app provides", () => {
    const App = () => h("p", null, inject("theme", "light"));

    expect(() => renderToString(h(App), { provides: {} } as never)).toThrow(
      TypeError("SSR provides must be a Map"),
    );
  });

  it("rejects non-object render context values", () => {
    for (const context of [null, [], new Date()]) {
      expect(() => renderToString(h("p", null, "server"), { context: context as never })).toThrow(
        TypeError("SSR context must be a plain object"),
      );
    }
  });

  it("rejects deferred manifest and router integration options", () => {
    expect(() => renderToString(h("p", null, "server"), { manifest: {} } as never)).toThrow(
      /SSR manifest integration is deferred/,
    );

    expect(() =>
      renderToString(h("p", null, "server"), { clientEntry: "/src/main.ts" } as never),
    ).toThrow(/SSR manifest integration is deferred/);

    expect(() => renderToString(h("p", null, "server"), { router: {} } as never)).toThrow(
      /Router-aware SSR integration is deferred/,
    );
    expect(() => renderToString(h("p", null, "server"), { stream: true } as never)).toThrow(
      /Streaming SSR is deferred/,
    );
  });

  it("rejects unknown SSR options", () => {
    expect(() => renderToString(h("p", null, "server"), { contex: {} } as never)).toThrow(
      TypeError("Unknown SSR option: contex"),
    );
  });
});

describe("renderToStringAsync", () => {
  it("serializes promised roots, async components, and promised children", async () => {
    const AsyncChild: AsyncComponentType = async () => () => h("strong", null, "ready");

    const result = await renderToStringAsync(
      Promise.resolve(h("section", null, [h(AsyncChild), Promise.resolve(h("i", null, "child"))])),
    );

    expect(result).toEqual({
      html: "<section><strong>ready</strong><i>child</i></section>",
      styles: [],
    });
  });

  it("preserves provides and styles across async setup", async () => {
    const Child = () => {
      useStyle("async-child", ".async-child { color: blue; }");
      return h("span", { class: "async-child" }, String(inject("message", "missing")));
    };
    const AsyncParent: AsyncComponentType = async () => {
      provide("message", "provided");
      await Promise.resolve();
      return () => h(Child);
    };

    await expect(renderToStringAsync(h(AsyncParent))).resolves.toEqual({
      html: '<span class="async-child">provided</span>',
      styles: ['<style data-s-id="async-child">.async-child { color: blue; }</style>'],
    });
  });

  it("validates options before touching an async source", async () => {
    let touched = false;
    const source = {
      then() {
        touched = true;
        return Promise.resolve(h("p", null, "late"));
      },
    };

    await expect(renderToStringAsync(source as never, { stream: true } as never)).rejects.toThrow(
      /Streaming SSR is deferred/,
    );
    expect(touched).toBe(false);
  });

  it("awaits defineAsyncComponent loaders without serializing loading UI", async () => {
    const loader = vi
      .fn<() => Promise<() => ReturnType<typeof h>>>()
      .mockRejectedValueOnce(new Error("retry"))
      .mockResolvedValueOnce(() => h("p", null, "loaded"));
    const AsyncComponent = defineAsyncComponent({
      loader,
      loadingComponent: () => h("p", null, "loading"),
      retry: 1,
    });

    await expect(renderToStringAsync(h(AsyncComponent))).resolves.toEqual({
      html: "<p>loaded</p>",
      styles: [],
    });
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
