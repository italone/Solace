import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);

describe("release readiness check CLI", () => {
  test("reports mandatory public API gate commands", async () => {
    const { stdout, stderr } = await execFileAsync("node", ["scripts/release-readiness-check.mjs"]);

    expect(stderr).toBe("");
    expect(stdout).toContain(
      "public API gates: pnpm release:readiness, pnpm package:smoke, pnpm test:e2e",
    );
  });

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

  test("keeps release:check ordered around mandatory public API gates", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      version?: string;
      scripts?: Record<string, string>;
    };
    const releaseCheck = packageJson.scripts?.["release:check"];

    expect(packageJson.version).not.toMatch(/^0\.0\./);
    expect(releaseCheck?.split(" && ")).toEqual([
      "pnpm release:readiness",
      "pnpm quality",
      "pnpm test:coverage",
      "pnpm package:smoke",
      "pnpm benchmark",
      "pnpm benchmark:browser",
      "pnpm test:e2e",
    ]);
  });

  test("keeps beta releases off the latest npm dist-tag", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["release:publish:beta"]).toBe(
      "pnpm release:check && changeset publish --tag beta",
    );
  });

  test("builds declarations before typechecking in the quality gate", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };
    const quality = packageJson.scripts?.quality;

    expect(quality?.split(" && ").slice(0, 3)).toEqual([
      "pnpm format:check",
      "pnpm build",
      "pnpm typecheck",
    ]);
  });
});
