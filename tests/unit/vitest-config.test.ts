import { describe, expect, it } from "vitest";
import config from "../../vitest.config";

describe("vitest config", () => {
  it("excludes worktree directories and nested node_modules", () => {
    const excludes = config.test?.exclude ?? [];
    expect(excludes).toContain(".worktrees/**");
    expect(excludes).toContain("node_modules/**");
    expect(excludes).toContain("**/node_modules/**");
  });
});
