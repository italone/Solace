import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);

describe("release readiness check CLI", () => {
  test("prints help for publishable and git synchronization options", async () => {
    const { stdout, stderr } = await execFileAsync("node", [
      "scripts/release-readiness-check.mjs",
      "--help",
    ]);

    expect(stderr).toBe("");
    expect(stdout).toContain("Usage: pnpm release:readiness -- [options]");
    expect(stdout).toContain("--publishable");
    expect(stdout).toContain("--skip-git-check");
  });

  test("fails publishable mode when git status is not synchronized", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "solace-release-readiness-git-"));
    const gitStatusPath = join(tempDir, "git-status.txt");
    await writeFile(gitStatusPath, "## main...origin/main [ahead 2]\n", "utf8");

    await expect(
      execFileAsync("node", [
        "scripts/release-readiness-check.mjs",
        "--publishable",
        "--git-status-file",
        gitStatusPath,
      ]),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "local branch must be synchronized with its upstream before publishable mode",
      ),
    });
  });

  test("rejects unknown options without a stack trace", async () => {
    await expect(
      execFileAsync("node", ["scripts/release-readiness-check.mjs", "--unknown-option"]),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Unknown option: --unknown-option"),
    });
  });

  test("allows an explicit git check skip for dry metadata audits", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "solace-release-readiness-skip-git-"));
    const gitStatusPath = join(tempDir, "git-status.txt");
    await writeFile(gitStatusPath, "## main...origin/main [ahead 2]\n", "utf8");

    const { stdout, stderr } = await execFileAsync("node", [
      "scripts/release-readiness-check.mjs",
      "--publishable",
      "--skip-git-check",
      "--git-status-file",
      gitStatusPath,
    ]);

    expect(stderr).toBe("");
    expect(stdout).toContain("release readiness check passed");
    expect(stdout).toContain("git synchronization: skipped");
  });
});
