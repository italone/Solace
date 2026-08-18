import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";
import { hasReleaseCheckCommand } from "../../../scripts/release-readiness-check-commands.mjs";

const execFileAsync = promisify(execFile);

describe("release readiness check CLI", () => {
  test("reports mandatory public API gate commands", async () => {
    const { stdout, stderr } = await execFileAsync("node", ["scripts/release-readiness-check.mjs"]);

    expect(stderr).toBe("");
    expect(stdout).toContain(
      "public API gates: pnpm release:readiness, pnpm release:contract:check, pnpm package:smoke, pnpm adoption:smoke, pnpm stable:app, pnpm performance:regression, pnpm test:e2e, pnpm test:e2e:devtools-extension",
    );
    expect(stdout).toContain(
      "benchmark history: .benchmark-history/ ignored local JSONL artifacts",
    );
  });

  test("matches release-check commands as complete &&-split segments", () => {
    expect(hasReleaseCheckCommand("pnpm stable:app && pnpm test:e2e", "pnpm stable:app")).toBe(
      true,
    );
    expect(
      hasReleaseCheckCommand("pnpm stable:app:upgrade && pnpm test:e2e", "pnpm stable:app"),
    ).toBe(false);
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
    try {
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
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
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
    try {
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
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("keeps release:check ordered around mandatory public API gates", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      version?: string;
      scripts?: Record<string, string>;
    };
    const releaseCheck = packageJson.scripts?.["release:check"];

    expect(packageJson.version).not.toMatch(/^0\.0\./);
    expect(packageJson.scripts?.["stable:app"]).toBe("node scripts/operations-console-smoke.mjs");
    expect(releaseCheck?.split(" && ")).toEqual([
      "pnpm release:readiness",
      "pnpm quality",
      "pnpm test:coverage",
      "pnpm package:smoke",
      "pnpm adoption:smoke",
      "pnpm stable:app",
      "pnpm benchmark",
      "pnpm benchmark:browser",
      "pnpm performance:regression",
      "pnpm test:e2e",
      "pnpm test:e2e:devtools-extension",
    ]);
  });

  test("runs the published baseline before the full candidate release gate", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["release:candidate:check"]?.split(" && ")).toEqual([
      "pnpm release:readiness -- --publishable",
      "pnpm stable:app:upgrade",
      "pnpm release:check",
    ]);
    expect(packageJson.scripts?.["stable:app:upgrade"]).toBe(
      "node scripts/operations-console-smoke.mjs --baseline 0.1.0-beta.2 --baseline 0.1.0-beta.4",
    );
  });

  test("keeps registry smoke explicit and outside ordinary release gates", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["registry:smoke"]).toBe(
      "node scripts/registry-contract-smoke.mjs",
    );
    expect(packageJson.scripts?.quality).not.toContain("registry:smoke");
    expect(packageJson.scripts?.["release:check"]).not.toContain("registry:smoke");
    expect(packageJson.scripts?.["release:candidate:check"]).not.toContain("registry:smoke");
    expect(packageJson.scripts?.["release:publish:beta"]).not.toContain("registry:smoke");
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

    expect(quality?.split(" && ").slice(0, 4)).toEqual([
      "pnpm format:check",
      "pnpm release:contract:check",
      "pnpm build",
      "pnpm typecheck",
    ]);
  });

  test("keeps stable evidence gates out of beta publishing", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["release:publish"]).toContain("pnpm release:one-zero:check");
    expect(packageJson.scripts?.["release:publish"]).toContain("pnpm release:contract:check");
    expect(packageJson.scripts?.["release:publish:beta"]).not.toContain("release:one-zero:check");
  });
});
