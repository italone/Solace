import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("examples documentation", () => {
  it("documents the Operations Console real-app validation workflow", async () => {
    const examples = await readFile("docs/examples.md", "utf8");

    expect(examples).toContain("## Operations Console");
    expect(examples).toContain("pnpm dev:operations");
    expect(examples).toContain("examples/operations-console");
    expect(examples).toContain("SPA routes");
    expect(examples).toContain("automatic retry");
    expect(examples).toContain("SSR/SSG entries");
    expect(examples).toContain("hydration fixture");
    expect(examples).toContain("packed validation");
    expect(examples).toMatch(/Async Hydration\s+\| `6179`/);
    expect(examples).toMatch(/Operations Console\s+\| `6180`/);
  });

  it("keeps the Operations Console e2e port aligned", async () => {
    const [playwrightConfig, operationsConsoleSpec] = await Promise.all([
      readFile("playwright.config.ts", "utf8"),
      readFile("tests/e2e/operations-console.spec.ts", "utf8"),
    ]);

    expect(playwrightConfig).toContain("--port 6180");
    expect(operationsConsoleSpec).toContain("http://127.0.0.1:6180");
  });

  it("keeps the DevTools panel example tied to the QA checklist", async () => {
    const examples = await readFile("docs/examples.md", "utf8");

    expect(examples).toContain("## DevTools Panel");
    expect(examples).toContain("example-grade");
    expect(examples).toContain("browser extension QA checklist");
    expect(examples).toContain("public `DevtoolsEvent` summaries");
    expect(examples).toContain("stale-port handling");
  });
});
