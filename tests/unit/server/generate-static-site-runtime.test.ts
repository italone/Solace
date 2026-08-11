import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import type { AsyncComponentType } from "../../../src";
import { generateStaticSite, generateStaticSiteAsync } from "../../../src/server";

describe("generateStaticSite runtime rendering", () => {
  it("renders async routes sequentially in input order", async () => {
    const order: string[] = [];
    const Slow: AsyncComponentType = async () => {
      order.push("slow:start");
      await Promise.resolve();
      order.push("slow:end");
      return () => h("p", null, "slow");
    };
    const Fast: AsyncComponentType = async () => {
      order.push("fast:start");
      await Promise.resolve();
      order.push("fast:end");
      return () => h("p", null, "fast");
    };

    const site = await generateStaticSiteAsync({
      routes: [
        { path: "/slow", source: Slow },
        { path: "/fast", source: Fast },
      ],
    });

    expect(order).toEqual(["slow:start", "slow:end", "fast:start", "fast:end"]);
    expect(site.pages.map((page) => page.body)).toEqual(["<p>slow</p>", "<p>fast</p>"]);
  });

  it("rejects async route sources through the synchronous SSR boundary", () => {
    expect(() =>
      generateStaticSite({
        routes: [{ path: "/", source: Promise.resolve(h("p", null, "async")) as never }],
      }),
    ).toThrow(/Async SSR is deferred/);
  });
});
