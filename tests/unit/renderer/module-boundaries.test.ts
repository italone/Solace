import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("renderer module boundaries", () => {
  it("keeps children diff helpers independent from the patch orchestrator", async () => {
    const source = await readFile("src/renderer/children.ts", "utf8");

    expect(source).not.toMatch(/from\s+["']\.\/diff["']/u);
  });
});
