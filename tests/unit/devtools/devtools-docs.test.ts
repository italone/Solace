import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";

describe("DevTools documentation", () => {
  test("documents the public API lifecycle policy", async () => {
    const docs = await readFile("docs/devtools.md", "utf8");

    expect(docs).toContain("## Public API Lifecycle");
    expect(docs).toContain("New runtime exports require package boundary tests");
    expect(docs).toContain("Event payload additions must remain small serializable summaries");
    expect(docs).toContain("Renames or removals require an intentional breaking-change plan");
    expect(docs).toContain("Internal helpers remain private");
  });
});
