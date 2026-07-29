import { sep } from "node:path";

import { describe, expect, it } from "vitest";
import config from "../../vitest.config";

describe("vitest config", () => {
  it("excludes worktree directories and nested node_modules", () => {
    const excludes = config.test?.exclude ?? [];
    const runningInsideWorktree = process.cwd().split(sep).includes(".worktrees");

    if (runningInsideWorktree) {
      expect(excludes).not.toContain(".worktrees/**");
    } else {
      expect(excludes).toContain(".worktrees/**");
    }

    expect(excludes).toContain("node_modules/**");
    expect(excludes).toContain("**/node_modules/**");
  });
});
