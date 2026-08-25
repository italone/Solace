import { describe, expect, it } from "vitest";

import { h } from "../../../src";
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

  it("rejects invalid mode values", async () => {
    await expect(
      collectStream(renderToStream(h("p", null, "x"), { mode: "concurrent" as never })),
    ).rejects.toThrow('SSR streaming mode must be "ordered" or "out-of-order"');
  });
});
