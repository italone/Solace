import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("release documentation", () => {
  it("mentions benchmark history requirements for performance claims", async () => {
    const release = await readFile("docs/release.md", "utf8");

    expect(release).toContain("## Performance Claims");
    expect(release).toContain("Use `pnpm benchmark:history` before writing release notes");
    expect(release).toMatch(/at least five latest browser\s+records per scenario/);
    expect(release).toMatch(/both browser and jsdom minimum counts/);
    expect(release).toContain("Keep the command, sample window, and scenario names together");
    expect(release).toContain("metadata.runAt");
    expect(release).toContain("JSONL file order");
    expect(release).toContain("Keep `.benchmark-history/` ignored");
    expect(release).toContain("local JSONL history must not be committed or packed");
  });

  it("mentions DevTools extension QA requirements for release notes", async () => {
    const release = await readFile("docs/release.md", "utf8");

    expect(release).toContain("## DevTools Extension Notes");
    expect(release).toContain("DevTools extension e2e smoke");
    expect(release).toContain("GitHub Actions CI workflow");
    expect(release).toContain("pnpm test:e2e:devtools-extension");
    expect(release).toMatch(/browser\s+extension QA checklist/);
    expect(release).toMatch(/example-grade\s+timeline inspector/);
    expect(release).toContain("public `DevtoolsEvent` summaries");
    expect(release).toContain("production browser-store distribution");
    expect(release).toContain("SSR/SSG/hydration inspector");
  });
});
