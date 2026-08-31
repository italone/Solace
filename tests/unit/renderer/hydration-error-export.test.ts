import { describe, expect, it } from "vitest";

import { SolaceHydrationError } from "../../../src/index";

describe("SolaceHydrationError root export", () => {
  it("is exported from the package root with a stable name", () => {
    expect(typeof SolaceHydrationError).toBe("function");
    const error = new SolaceHydrationError("hydration mismatch");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("SolaceHydrationError");
  });
});
