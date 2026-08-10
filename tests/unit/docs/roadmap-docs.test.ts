import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("roadmap documentation", () => {
  it("keeps DevTools hardening tied to the extension QA checklist", async () => {
    const roadmap = await readFile("docs/roadmap.md", "utf8");

    expect(roadmap).toContain("Browser DevTools extension UI");
    expect(roadmap).toContain("browser extension QA");
    expect(roadmap).toContain("without reading private runtime state");
  });
});
