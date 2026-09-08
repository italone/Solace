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

  it("rejects the whole build when one async route fails", async () => {
    const Bad: AsyncComponentType = () => Promise.reject(new Error("route boom"));

    await expect(
      generateStaticSiteAsync({
        routes: [
          { path: "/ok", source: () => h("p", null, "ok") },
          { path: "/bad", source: Bad },
        ],
      }),
    ).rejects.toThrow("route boom");
  });

  it("rejects the build when a never-settling route exceeds site timeoutMs", async () => {
    const Hung: AsyncComponentType = () => new Promise(() => {}) as never;
    await expect(
      generateStaticSiteAsync({
        timeoutMs: 15,
        routes: [
          { path: "/ok", source: () => h("p", null, "ok") },
          { path: "/bad", source: Hung },
        ],
      }),
    ).rejects.toThrow(/timed out after 15ms/);
  });

  it("lets a route-level timeoutMs override the site default", async () => {
    const Hung: AsyncComponentType = () => new Promise(() => {}) as never;
    await expect(
      generateStaticSiteAsync({
        timeoutMs: 5000,
        routes: [{ path: "/bad", source: Hung, timeoutMs: 15 }],
      }),
    ).rejects.toThrow(/timed out after 15ms/);
  });

  it("rejects invalid timeoutMs at site and route level", async () => {
    await expect(
      generateStaticSiteAsync({
        timeoutMs: 0 as never,
        routes: [{ path: "/", source: () => h("p", null, "x") }],
      }),
    ).rejects.toThrow(TypeError("SSR static site timeoutMs must be a positive number"));
    await expect(
      generateStaticSiteAsync({
        routes: [{ path: "/", source: () => h("p", null, "x"), timeoutMs: -1 as never }],
      }),
    ).rejects.toThrow(TypeError("SSR static route timeoutMs must be a positive number"));
  });
});
