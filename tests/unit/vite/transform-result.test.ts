import { describe, expect, it } from "vitest";

import { createSolaceTransformResult } from "../../../src/vite/transform-result";

describe("solace Vite transform result policy", () => {
  it("always disables source maps for .solace transforms", () => {
    expect(createSolaceTransformResult("export default {}")).toEqual({
      code: "export default {}",
      map: null,
    });
  });
});
