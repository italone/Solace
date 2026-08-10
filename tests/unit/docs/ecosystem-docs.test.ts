import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("ecosystem direction documentation", () => {
  it("records the beta UI library and plugin ecosystem decisions", async () => {
    const [en, zh, roadmap, projectStatus] = await Promise.all([
      readFile("docs/ecosystem.md", "utf8"),
      readFile("docs/ecosystem.zh-CN.md", "utf8"),
      readFile("docs/roadmap.md", "utf8"),
      readFile("docs/project-status.md", "utf8"),
    ]);

    expect(en).toContain("## Decisions");
    expect(en).toContain("No first-party UI component library in the beta line");
    expect(en).toContain("No stable plugin ecosystem in the beta line");
    expect(en).toContain("application-owned adapter components");
    expect(en).toContain("Do not expose third-party UI library types");
    expect(en).toContain("public event contracts");
    expect(en).toContain("## Revisit Triggers");

    expect(zh).toContain("## 决策");
    expect(zh).toContain("beta 线不提供一方 UI component library");
    expect(zh).toContain("beta 线不提供稳定 plugin ecosystem");
    expect(zh).toContain("应用自有 adapter components");
    expect(zh).toContain("不要把 third-party UI library types");
    expect(zh).toContain("公开 event contracts");

    expect(roadmap).toContain("docs/ecosystem.md");
    expect(projectStatus).toContain("docs/ecosystem.md");
  });
});
