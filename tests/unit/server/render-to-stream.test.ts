import { describe, expect, it } from "vitest";

import { Fragment, h } from "../../../src";
import { renderToStream } from "../../../src/server";
import { renderToString, renderToStringAsync } from "../../../src/server/render-to-string";

import { collectStream } from "./stream-test-utils";

describe("renderToStream options", () => {
  it("rejects non-object options", () => {
    expect(() => renderToStream(h("p", null, "x"), null as never)).toThrow(TypeError);
  });

  it("rejects unknown fields with a field-specific TypeError", () => {
    expect(() => renderToStream(h("p", null, "x"), { stream: true } as never)).toThrow(
      "Unknown SSR streaming option: stream",
    );
  });

  it("rejects deferred router and manifest options", () => {
    expect(() => renderToStream(h("p", null, "x"), { router: {} } as never)).toThrow(
      "Router-aware SSR integration is deferred",
    );
    expect(() => renderToStream(h("p", null, "x"), { manifest: {} } as never)).toThrow(
      "SSR manifest integration is deferred",
    );
  });

  it("rejects invalid context and provides values", () => {
    expect(() => renderToStream(h("p", null, "x"), { context: [] } as never)).toThrow(
      "SSR context must be a plain object",
    );
    expect(() => renderToStream(h("p", null, "x"), { provides: {} } as never)).toThrow(
      "SSR provides must be a Map",
    );
  });
});

describe("renderToStream synchronous trees", () => {
  it("emits bytes identical to renderToString().html for elements, text, fragments, and components", async () => {
    const Label = () => h("strong", { class: "label" }, "hello");
    const tree = h(Fragment, null, [
      h("p", { id: "intro", "data-active": true }, "count < 1"),
      h(Label),
    ]);

    const streamed = await collectStream(renderToStream(tree));
    expect(streamed).toBe(
      '<p id="intro" data-active="true">count &lt; 1</p><strong class="label">hello</strong>',
    );
    expect(streamed).toBe(renderToString(tree).html);
  });

  it("escapes attributes and omits event props", async () => {
    const streamed = await collectStream(
      renderToStream(
        h("button", { title: '5 > "4"', onClick: () => undefined }, "Save & continue"),
      ),
    );
    expect(streamed).toBe('<button title="5 &gt; &quot;4&quot;">Save &amp; continue</button>');
  });

  it("rejects unsafe element names through stream errors", async () => {
    await expect(
      collectStream(renderToStream(h("div onclick=alert(1)", null, "bad"))),
    ).rejects.toThrow(TypeError);
  });

  it("matches renderToStringAsync for sync trees", async () => {
    const tree = h("ul", null, [h("li", null, "a"), h("li", null, "b")]);
    const streamed = await collectStream(renderToStream(tree));
    expect(streamed).toBe((await renderToStringAsync(tree)).html);
  });

  it("ignores unknown children types exactly like renderToString", async () => {
    const tree = h("p", null, 42 as never);
    const buffered = renderToString(tree).html;
    expect(buffered).toBe("<p></p>");
    const streamed = await collectStream(renderToStream(tree));
    expect(streamed).toBe(buffered);
  });

  it("rejects with a TypeError when a component render returns a Promise", async () => {
    const Async = () => Promise.resolve(h("p", null, "later")) as never;
    await expect(collectStream(renderToStream(h(Async, null)))).rejects.toThrow(TypeError);
    await expect(collectStream(renderToStream(h(Async, null)))).rejects.toThrow(
      "Async component render functions must return a synchronous VNode",
    );
  });
});
