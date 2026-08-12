import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runRegistryContractSmoke } from "../../../scripts/registry-contract-smoke.mjs";
import {
  createRegistryConsumerPackageJson,
  createRegistryInstallArguments,
  createRegistryProbeSource,
  parseRegistrySmokeArguments,
} from "../../../scripts/registry-contract-smoke-config.mjs";

const protectedEntries = [
  "@italone/solace",
  "@italone/solace/jsx-runtime",
  "@italone/solace/jsx-dev-runtime",
  "@italone/solace/devtools",
  "@italone/solace/server",
  "@italone/solace/sfc",
  "@italone/solace/vite",
  "@italone/solace/package.json",
];

describe("registry contract smoke", () => {
  it("requires one explicit exact version or dist-tag", () => {
    expect(parseRegistrySmokeArguments(["0.1.0-beta.4"])).toEqual({
      exactVersion: "0.1.0-beta.4",
      target: "0.1.0-beta.4",
    });
    expect(parseRegistrySmokeArguments(["beta"])).toEqual({
      exactVersion: undefined,
      target: "beta",
    });
    expect(parseRegistrySmokeArguments(["--help"])).toEqual({ help: true });
  });

  it.each<[string[]]>([
    [[]],
    [["beta", "extra"]],
    [["@italone/solace@beta"]],
    [["file:../solace.tgz"]],
    [["https://registry.example/solace.tgz"]],
    [["../beta"]],
    [["beta latest"]],
    [["^0.1.0"]],
  ])("rejects unsafe or ambiguous targets: %j", (args) => {
    expect(() => parseRegistrySmokeArguments(args)).toThrow("registry smoke usage failed");
  });

  it("pins only the fixed Solace package", () => {
    expect(createRegistryConsumerPackageJson("0.1.0-beta.4")).toEqual({
      private: true,
      type: "module",
      dependencies: { "@italone/solace": "0.1.0-beta.4" },
    });
  });

  it("disables lifecycle scripts during registry installation", () => {
    expect(createRegistryInstallArguments()).toEqual(["install", "--ignore-scripts"]);
  });

  it("generates the complete protected-entry probe", () => {
    const source = createRegistryProbeSource("0.1.0-beta.4");

    for (const entry of protectedEntries) {
      expect(source).toContain(JSON.stringify(entry));
    }
    expect(source).toContain('import("@italone/solace/package.json", { with: { type: "json" } })');
    expect(source).toContain("Object.keys(sfc).length !== 0");
    expect(source).toContain("<p>registry contract smoke</p>");
    expect(source).toContain("ERR_PACKAGE_PATH_NOT_EXPORTED");
    expect(source).toContain("@italone/solace/dist/index.js");
    expect(source).toContain('metadata.version !== "0.1.0-beta.4"');
  });

  it("embeds every stable failure stage", () => {
    const source = createRegistryProbeSource(undefined);

    for (const stage of [
      "registry smoke metadata failed",
      "registry smoke public entry failed",
      "registry smoke server render failed",
      "registry smoke private entry failed",
    ]) {
      expect(source).toContain(stage);
    }
  });

  it("writes the consumer, runs the probe, and cleans up", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "solace-registry-test-"));
    let workspace = "";
    const calls: string[] = [];

    try {
      const result = await runRegistryContractSmoke("0.1.0-beta.4", {
        exactVersion: "0.1.0-beta.4",
        temporaryRoot,
        install: async (cwd, packageJsonPath) => {
          workspace = cwd;
          calls.push(`install:${cwd}`);
          const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
          expect(packageJson.dependencies).toEqual({ "@italone/solace": "0.1.0-beta.4" });
        },
        executeProbe: async (probePath) => {
          calls.push(`probe:${probePath}`);
          const probe = await readFile(probePath, "utf8");
          expect(probe).toContain("registry contract smoke");
          return { checkedEntries: 8, version: "0.1.0-beta.4" };
        },
        log: () => undefined,
      });

      expect(result).toEqual({ checkedEntries: 8, version: "0.1.0-beta.4" });
      expect(calls).toHaveLength(2);
      await expect(access(workspace)).rejects.toThrow();
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("prefixes install failures and still cleans up", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "solace-registry-test-"));
    let workspace = "";

    try {
      await expect(
        runRegistryContractSmoke("beta", {
          exactVersion: undefined,
          temporaryRoot,
          install: async (cwd) => {
            workspace = cwd;
            throw new Error("registry unavailable");
          },
          executeProbe: async () => {
            throw new Error("probe must not run");
          },
          log: () => undefined,
        }),
      ).rejects.toThrow("registry smoke install failed: registry unavailable");
      await expect(access(workspace)).rejects.toThrow();
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("preserves probe stage failures and still cleans up", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "solace-registry-test-"));
    let workspace = "";

    try {
      await expect(
        runRegistryContractSmoke("beta", {
          exactVersion: undefined,
          temporaryRoot,
          install: async (cwd) => {
            workspace = cwd;
          },
          executeProbe: async () => {
            throw new Error("registry smoke server render failed: output mismatch");
          },
          log: () => undefined,
        }),
      ).rejects.toThrow("registry smoke server render failed: output mismatch");
      await expect(access(workspace)).rejects.toThrow();
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});
