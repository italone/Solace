import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { evaluatePublicContract } from "../../../scripts/public-contract-check.mjs";

const packageJson = {
  exports: {
    ".": {},
    "./devtools": {},
    "./jsx-dev-runtime": {},
    "./jsx-runtime": {},
    "./package.json": {},
    "./server": {},
    "./sfc": {},
    "./vite": {},
  },
};

const manifest = {
  schemaVersion: 1,
  stableAdmission: false,
  entries: [
    { key: ".", path: "@italone/solace", maturity: "beta", scope: "runtime" },
    {
      key: "./devtools",
      path: "@italone/solace/devtools",
      maturity: "beta",
      scope: "devtools",
    },
    {
      key: "./jsx-dev-runtime",
      path: "@italone/solace/jsx-dev-runtime",
      maturity: "stable",
      scope: "jsx dev runtime",
    },
    {
      key: "./jsx-runtime",
      path: "@italone/solace/jsx-runtime",
      maturity: "stable",
      scope: "jsx runtime",
    },
    {
      key: "./package.json",
      path: "@italone/solace/package.json",
      maturity: "stable",
      scope: "metadata",
    },
    { key: "./server", path: "@italone/solace/server", maturity: "beta", scope: "server" },
    {
      key: "./sfc",
      path: "@italone/solace/sfc",
      maturity: "experimental",
      scope: "sfc",
    },
    { key: "./vite", path: "@italone/solace/vite", maturity: "experimental", scope: "vite" },
  ],
};

describe("public contract manifest", () => {
  it("accepts an explicit beta contract that matches package exports", () => {
    expect(evaluatePublicContract({ packageJson, manifest })).toMatchObject({
      valid: true,
      stableAdmission: false,
      errors: [],
    });
  });

  it("rejects missing package exports", () => {
    const result = evaluatePublicContract({
      packageJson,
      manifest: {
        ...manifest,
        entries: manifest.entries.filter((entry) => entry.key !== "./vite"),
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("missing manifest entries: ./vite");
  });

  it("rejects stable admission while beta entries remain", () => {
    const result = evaluatePublicContract({
      packageJson,
      manifest: { ...manifest, stableAdmission: true },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("stable admission requires every entry to be stable");
  });

  it("rejects invalid maturity values", () => {
    const result = evaluatePublicContract({
      packageJson,
      manifest: {
        ...manifest,
        entries: manifest.entries.map((entry, index) =>
          index === 0 ? { ...entry, maturity: "unknown" } : entry,
        ),
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("invalid maturity");
  });

  it("rejects duplicate manifest entries", () => {
    const result = evaluatePublicContract({
      packageJson,
      manifest: { ...manifest, entries: [...manifest.entries, manifest.entries[0]] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("duplicate manifest entries: .");
  });

  it("rejects a path or maturity drift from the frozen boundary", () => {
    const result = evaluatePublicContract({
      packageJson,
      manifest: {
        ...manifest,
        entries: manifest.entries.map((entry) =>
          entry.key === "./server"
            ? { ...entry, path: "@italone/solace/wrong", maturity: "stable" }
            : entry,
        ),
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("./server path must remain @italone/solace/server");
    expect(result.errors.join(" ")).toContain("./server maturity must remain beta");
  });

  it("accepts the checked-in frozen public contract", async () => {
    const [packageSource, manifestSource] = await Promise.all([
      readFile("package.json", "utf8"),
      readFile("release/public-contract.json", "utf8"),
    ]);
    expect(
      evaluatePublicContract({
        packageJson: JSON.parse(packageSource),
        manifest: JSON.parse(manifestSource),
      }),
    ).toEqual({ valid: true, stableAdmission: false, errors: [] });
  });
});
