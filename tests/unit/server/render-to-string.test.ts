import { describe, expect, it, vi } from "vitest";

import { Fragment, h, inject, onMounted, onUnmounted, onUpdated, provide } from "../../../src";
import { renderToString } from "../../../src/server";

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
});
