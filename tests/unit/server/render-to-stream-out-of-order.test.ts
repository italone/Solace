import { describe, expect, it } from "vitest";

import { defineAsyncComponent, Fragment, h } from "../../../src";
import { renderToStream } from "../../../src/server";
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
