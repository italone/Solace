import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("performance documentation", () => {
  it("documents benchmark history decision rules", async () => {
    const performance = await readFile("docs/performance.md", "utf8");

    expect(performance).toContain("## Benchmark History Decision Rules");
    expect(performance).toContain("--latest-browser-count 5 --min-browser-count 5");
    expect(performance).toContain("--min-jsdom-count 5");
    expect(performance).toContain("metadata.runAt");
    expect(performance).toContain("JSONL file order");
    expect(performance).toContain("Keep `.benchmark-history/` ignored");
    expect(performance).toContain(
      "Treat `domMutationCounts` and `movePathCounts` as diagnostic context",
    );
    expect(performance).toMatch(/sample count, environment metadata,\s+and scenario names/);
  });
});
