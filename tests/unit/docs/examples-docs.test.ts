import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("examples documentation", () => {
  it("keeps the DevTools panel example tied to the QA checklist", async () => {
    const examples = await readFile("docs/examples.md", "utf8");

    expect(examples).toContain("## DevTools Panel");
    expect(examples).toContain("example-grade");
    expect(examples).toContain("browser extension QA checklist");
    expect(examples).toContain("public `DevtoolsEvent` summaries");
    expect(examples).toContain("stale-port handling");
  });
});
