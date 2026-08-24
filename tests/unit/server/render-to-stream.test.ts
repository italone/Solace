import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import { renderToStream } from "../../../src/server";

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
