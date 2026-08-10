import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import { generateStaticSite } from "../../../src/server";

describe("generateStaticSite runtime rendering", () => {
  it("rejects async route sources through the synchronous SSR boundary", () => {
    expect(() =>
      generateStaticSite({
        routes: [{ path: "/", source: Promise.resolve(h("p", null, "async")) as never }],
      }),
    ).toThrow(/Async SSR is deferred/);
  });
});
