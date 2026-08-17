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

  test("documents browser extension QA boundaries", async () => {
    const docs = await readFile("docs/devtools.md", "utf8");

    expect(docs).toContain("## Browser Extension QA Checklist");
    expect(docs).toContain("pnpm build:devtools-extension");
    expect(docs).toContain("pnpm test:e2e:devtools-extension");
    expect(docs).toContain("stale runtime ports");
    expect(docs).toContain("Failed page `postMessage`");
    expect(docs).toContain("do not include raw props, state, DOM nodes");
    expect(docs).toContain("## Local Distribution Evidence");
    expect(docs).toContain("`release/devtools-distribution-evidence.md`");
    expect(docs).toContain("does not claim browser-store publication");
  });

  test("records the bounded local distribution verification", async () => {
    const evidence = await readFile("release/devtools-distribution-evidence.md", "utf8");

    expect(evidence).toContain("pnpm test:e2e:devtools-extension");
    expect(evidence).toContain("2 passed");
    expect(evidence).toContain("bridge.js");
    expect(evidence).toContain("content-script.js");
    expect(evidence).toContain("No `.map` files");
    expect(evidence).toContain("Browser-store publication remains deferred");
  });
});
