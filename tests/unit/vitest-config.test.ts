import { describe, expect, it } from "vitest";
import config from "../../vitest.config";

describe("vitest config", () => {
  it("excludes worktree directories and nested node_modules", () => {
    const excludes = config.test?.exclude ?? [];
    expect(excludes).toContain(".worktrees/**");
    expect(excludes.some((pattern: string) => pattern.includes("node_modules"))).toBe(true);
  });
});
