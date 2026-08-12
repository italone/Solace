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

  it("records additive async rendering compatibility", async () => {
    const release = await readFile("docs/release.md", "utf8");

    expect(release).toContain("renderToStringAsync()");
    expect(release).toContain("generateStaticSiteAsync()");
    expect(release).toContain("hydrateAsync()");
    expect(release).toContain("additive documented public entries");
    expect(release).toContain("existing synchronous APIs retain their return types");
    expect(release).toContain("compatibility and deprecation policy");
  });

  it("defines the stable compatibility checklist", async () => {
    const release = await readFile("docs/release.md", "utf8");

    expect(release).toContain("## Stable Compatibility Checklist");
    expect(release).toContain("pnpm release:candidate:check");
    expect(release).toContain("pnpm stable:app:upgrade");
    expect(release).toContain("pnpm release:check");
    expect(release).toContain("@italone/solace@0.1.0-beta.2");
    expect(release).toContain("separate from routine pull-request CI");
    expect(release).toContain("types, docs, changelog, and tests together");
    expect(release).toContain("severe security/correctness exception");
  });

  it("includes the stable app smoke in full and mandatory release gates", async () => {
    const release = await readFile("docs/release.md", "utf8");

    expect(release).toContain("stable application smoke");
    expect(release).toContain("`pnpm stable:app` as a mandatory gate");
  });
});
