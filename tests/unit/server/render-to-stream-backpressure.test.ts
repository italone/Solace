import { describe, expect, it } from "vitest";

import { defineAsyncComponent, Fragment, h } from "../../../src";
import { renderToStream } from "../../../src/server";

import { stripStyleTags } from "./stream-test-utils";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("renderToStream backpressure", () => {
  it("does not finish producing while the consumer never reads", async () => {
    const count = 20;
    const tree = h(
      Fragment,
      null,
      Array.from({ length: count }, (_, i) =>
        h(
          defineAsyncComponent({
            loader: async () => () => h("p", null, `c${i}`),
            fallback: h("p", null, `f${i}`),
          }),
        ),
      ),
    );

    const stream = renderToStream(tree, { mode: "out-of-order" });
    const reader = stream.getReader();

    // Every loader resolves immediately, so an eager producer would enqueue
    // the whole document and close the stream within milliseconds even with
    // nobody reading. A backpressured producer parks once its queue is full.
    let closed = false;
    void reader.closed.then(() => {
      closed = true;
    });
    await sleep(150);
    expect(closed).toBe(false);

    // Draining the stream lets production finish and yields the complete
    // final document.
    const decoder = new TextDecoder();
    let out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out += decoder.decode(value, { stream: true });
    }
    out += decoder.decode();
    expect(closed).toBe(true);

    const full = stripStyleTags(out);
    for (let i = 0; i < count; i += 1) {
      expect(full).toContain(`>c${i}<`);
    }
  });

  it("completes normally for a fully-drained consumer", async () => {
    const stream = renderToStream(h("p", null, "ok"));
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out += decoder.decode(value, { stream: true });
    }
    expect(out).toBe("<p>ok</p>");
  });
});
