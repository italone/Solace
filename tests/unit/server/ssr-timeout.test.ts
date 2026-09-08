import { describe, expect, it } from "vitest";

import {
  SolaceTimeoutError,
  assertTimeoutMs,
  raceWithTimeout,
} from "../../../src/server/ssr-timeout";

describe("raceWithTimeout", () => {
  it("resolves with the winner when the promise settles first", async () => {
    await expect(raceWithTimeout(Promise.resolve("ok"), 1000, "test")).resolves.toBe("ok");
  });

  it("rejects with SolaceTimeoutError when the timer wins", async () => {
    const pending = new Promise<string>(() => {});
    await expect(raceWithTimeout(pending, 10, "awaiting boundary")).rejects.toThrow(
      SolaceTimeoutError,
    );
    await expect(raceWithTimeout(pending, 10, "awaiting boundary")).rejects.toThrow(
      /timed out after 10ms \(awaiting boundary\)/,
    );
  });

  it("clears the timer once settled so the process is not held", async () => {
    const pending = new Promise<string>(() => {});
    const start = Date.now();
    await raceWithTimeout(pending, 10, "test").catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(Date.now() - start).toBeLessThan(1000);
  });
});

describe("assertTimeoutMs", () => {
  it("accepts a positive number and undefined", () => {
    expect(() => assertTimeoutMs(undefined, "SSR")).not.toThrow();
    expect(() => assertTimeoutMs(100, "SSR")).not.toThrow();
  });

  it("rejects zero, negatives, non-finite, and non-numbers", () => {
    for (const bad of [0, -1, Number.POSITIVE_INFINITY, "100", null]) {
      expect(() => assertTimeoutMs(bad as never, "SSR")).toThrow(
        TypeError("SSR timeoutMs must be a positive number"),
      );
    }
  });
});
