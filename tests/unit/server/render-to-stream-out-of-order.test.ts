import { describe, expect, it } from "vitest";

import { defineAsyncComponent, Fragment, h, Suspense, useStyle } from "../../../src";
import { renderToStream } from "../../../src/server";
import { buildReplacementScript } from "../../../src/server/stream-boundary";
import { collectStream } from "./stream-test-utils";

describe("renderToStream mode option", () => {
  it("defaults to ordered behavior when mode is omitted", async () => {
    const streamed = await collectStream(renderToStream(h("p", null, "x")));
    expect(streamed).toBe("<p>x</p>");
  });

  it('accepts mode: "ordered" explicitly', async () => {
    const streamed = await collectStream(renderToStream(h("p", null, "x"), { mode: "ordered" }));
    expect(streamed).toBe("<p>x</p>");
  });

  it('accepts mode: "out-of-order"', async () => {
    const streamed = await collectStream(
      renderToStream(h("p", null, "x"), { mode: "out-of-order" }),
    );
    expect(streamed).toBe("<p>x</p>");
  });

  it("rejects invalid mode values", () => {
    expect(() => renderToStream(h("p", null, "x"), { mode: "concurrent" as never })).toThrow(
      'SSR streaming mode must be "ordered" or "out-of-order"',
    );
  });
});

describe("renderToStream out-of-order boundaries", () => {
  it("emits fallback markers without waiting for the loader", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const AsyncPart = defineAsyncComponent({
      loader: () => gate.then(() => Promise.resolve(() => h("em", null, "late"))),
      fallback: h("p", null, "loading…"),
    });

    const stream = renderToStream(h(Fragment, null, [h("b", null, "first"), h(AsyncPart)]), {
      mode: "out-of-order",
    });
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    const firstRead = await reader.read();
    const prefix = decoder.decode(firstRead.value ?? new Uint8Array());
    expect(prefix).toContain("<b>first</b>");
    expect(prefix).toContain("<!--so:b:1-->");
    expect(prefix).toContain("<p>loading…</p>");
    expect(prefix).toContain("<!--/so:b:1-->");
    expect(prefix).not.toContain("<em>");

    release!();
    // Drain the rest; Task 3 asserts only that the stream closes.
    for (;;) {
      const { done } = await reader.read();
      if (done) break;
    }
  });

  it("uses an empty placeholder when no fallback is provided", async () => {
    const AsyncPart = defineAsyncComponent(async () => () => h("em", null, "late"));
    const streamed = await collectStream(
      renderToStream(h(Fragment, null, [h("b", null, "first"), h(AsyncPart)]), {
        mode: "out-of-order",
      }),
    );
    expect(streamed).toContain("<!--so:b:1--><!--/so:b:1-->");
  });

  it("numbers boundary ids monotonically across the tree", async () => {
    const A = defineAsyncComponent(async () => () => h("i", null, "a"));
    const B = defineAsyncComponent(async () => () => h("i", null, "b"));
    const streamed = await collectStream(
      renderToStream(h(Fragment, null, [h(A), h(B)]), { mode: "out-of-order" }),
    );
    expect(streamed).toContain("so:b:1");
    expect(streamed).toContain("so:b:2");
  });

  it("still awaits async components inline in ordered mode (no markers)", async () => {
    const AsyncPart = defineAsyncComponent({
      loader: async () => () => h("em", null, "late"),
      fallback: h("p", null, "loading…"),
    });
    const streamed = await collectStream(renderToStream(h(AsyncPart)));
    expect(streamed).toBe("<em>late</em>");
  });
});

describe("renderToStream out-of-order replacement", () => {
  it("emits an inline replacement script after the document, in resolution order", async () => {
    const first = new Promise<void>((resolve) => setTimeout(resolve, 20));
    const Slow = defineAsyncComponent({
      loader: () => first.then(() => Promise.resolve(() => h("em", null, "slow"))),
      fallback: h("p", null, "slow…"),
    });
    const Fast = defineAsyncComponent(async () => () => h("strong", null, "fast"));

    const streamed = await collectStream(
      renderToStream(h(Fragment, null, [h(Slow), h(Fast)]), { mode: "out-of-order" }),
    );

    expect(streamed).toContain("so:b:1");
    expect(streamed).toContain("so:b:2");
    const fastScriptIndex = streamed.indexOf("so:r:2");
    const slowScriptIndex = streamed.indexOf("so:r:1");
    expect(fastScriptIndex).toBeGreaterThan(-1);
    expect(slowScriptIndex).toBeGreaterThan(fastScriptIndex);
    expect(streamed.slice(slowScriptIndex)).toContain("<em>slow</em>");
  });

  it("keeps fallback and emits a failure comment when a boundary rejects", async () => {
    const Bad = defineAsyncComponent({
      loader: () => Promise.reject(new Error("load failed")),
      fallback: h("p", null, "loading…"),
    });
    const streamed = await collectStream(
      renderToStream(h(Fragment, null, [h("b", null, "ok"), h(Bad)]), { mode: "out-of-order" }),
    );
    expect(streamed).toContain("<b>ok</b>");
    expect(streamed).toContain("<p>loading…</p>");
    expect(streamed).toContain("failed:load failed");
    expect(streamed).not.toContain("so:r:1");
  });

  it("does not reject the stream when a boundary rejects", async () => {
    const Bad = defineAsyncComponent(() => Promise.reject(new Error("boom")));
    const streamed = await collectStream(renderToStream(h(Bad), { mode: "out-of-order" }));
    expect(typeof streamed).toBe("string");
  });

  it("embeds style tags registered inside the boundary subtree", async () => {
    const Styled = defineAsyncComponent(async () => {
      return () => {
        useStyle("card", ".card{color:red}");
        return h("div", { class: "card" }, "x");
      };
    });
    const streamed = await collectStream(
      renderToStream(h(Fragment, null, [h(Styled), h("p", null, "tail")]), {
        mode: "out-of-order",
      }),
    );
    expect(streamed).toContain("so:r:1");
    expect(streamed).toContain('data-s-id="card"');
  });

  it("flushes replacement scripts for nested async boundaries", async () => {
    const Inner = defineAsyncComponent(async () => () => h("i", null, "inner"));
    const Outer = defineAsyncComponent({
      loader: async () => () => h("div", null, [h(Inner)]),
      fallback: h("p", null, "outer…"),
    });
    const streamed = await collectStream(renderToStream(h(Outer), { mode: "out-of-order" }));
    expect(streamed).toContain("so:r:1");
    expect(streamed).toContain("so:r:2");
    expect(streamed.slice(streamed.indexOf("so:r:2"))).toContain("<i>inner</i>");
  });

  it("preserves boundary props and children in replacement content", async () => {
    const Part = defineAsyncComponent({
      loader: async () => (props: { label: string }, ctx: { slots: { default?: () => unknown } }) =>
        h("span", { "data-label": props.label }, (ctx.slots.default?.() ?? null) as never),
      fallback: h("p", null, "…"),
    });
    const streamed = await collectStream(
      renderToStream(h(Part, { label: "hi" }, "slot text"), { mode: "out-of-order" }),
    );
    const scriptIndex = streamed.indexOf("so:r:1");
    expect(streamed.slice(scriptIndex)).toContain('data-label="hi"');
    expect(streamed.slice(scriptIndex)).toContain("slot text");
  });

  it("neutralizes closing script sequences in embedded content", async () => {
    const Tricky = defineAsyncComponent(async () => () => h("p", null, "</script>"));
    const streamed = await collectStream(renderToStream(h(Tricky), { mode: "out-of-order" }));
    // Text children are entity-escaped by the streamer, so no raw sequence leaks.
    expect(streamed).not.toContain("</script></script>");
    expect(streamed).toContain("&lt;/script&gt;");
    // Raw closing sequences in the collected HTML are neutralized in the payload.
    const script = buildReplacementScript(1, "<p></script></p>");
    expect(script).toContain("<\\/script>");
    expect(script).not.toContain("</script><");
  });
});

describe("renderToStream Suspense boundaries", () => {
  it("emits one so:b boundary for the whole Suspense subtree in out-of-order mode", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const A = defineAsyncComponent(() => gate.then(() => () => h("i", null, "a")));
    const B = defineAsyncComponent(async () => () => h("b", null, "b"));

    const stream = renderToStream(
      h(Suspense, { fallback: h("p", null, "loading…") }, [h(A), h(B)]),
      { mode: "out-of-order" },
    );
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    const firstRead = await reader.read();
    const prefix = decoder.decode(firstRead.value ?? new Uint8Array());
    expect(prefix).toContain("<!--so:b:1-->");
    expect(prefix).toContain("<p>loading…</p>");
    expect(prefix).toContain("<!--/so:b:1-->");
    expect(prefix).not.toContain("so:b:2");

    release!();
    let streamed = prefix;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      streamed += decoder.decode(value, { stream: true });
    }
    expect(streamed).toContain("so:r:1");
    expect(streamed.slice(streamed.indexOf("so:r:1"))).toContain("<i>a</i>");
    expect(streamed.slice(streamed.indexOf("so:r:1"))).toContain("<b>b</b>");
  });

  it("awaits the subtree inline in ordered mode (no markers)", async () => {
    const A = defineAsyncComponent(async () => () => h("i", null, "a"));
    const streamed = await collectStream(
      renderToStream(h(Suspense, { fallback: h("p", null, "loading…") }, [h(A)])),
    );
    expect(streamed).toBe("<i>a</i>");
  });

  it("numbers nested Suspense boundaries independently", async () => {
    const Inner = defineAsyncComponent(async () => () => h("i", null, "inner"));
    const Outer = defineAsyncComponent(async () => () => h("b", null, "outer"));
    const streamed = await collectStream(
      renderToStream(
        h(Suspense, { fallback: h("p", null, "o…") }, [
          h(Outer),
          h(Suspense, { fallback: h("p", null, "i…") }, [h(Inner)]),
        ]),
        { mode: "out-of-order" },
      ),
    );
    expect(streamed).toContain("so:b:1");
    expect(streamed).toContain("so:b:2");
  });

  it("keeps the Suspense fallback and emits a failure comment when a subtree loader rejects", async () => {
    const Bad = defineAsyncComponent(() => Promise.reject(new Error("boom")));
    const streamed = await collectStream(
      renderToStream(h(Suspense, { fallback: h("p", null, "loading…") }, [h(Bad)]), {
        mode: "out-of-order",
      }),
    );
    expect(streamed).toContain("<p>loading…</p>");
    expect(streamed).toContain("failed:boom");
    expect(streamed).not.toContain("so:r:1");
  });
});
