import { describe, expect, it } from "vitest";

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
});
