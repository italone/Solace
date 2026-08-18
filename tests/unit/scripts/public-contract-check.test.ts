import { describe, expect, it } from "vitest";

import { evaluatePublicContract } from "../../../scripts/public-contract-check-config.mjs";

const packageJson = {
  exports: { ".": {}, "./server": {}, "./vite": {} },
};

const manifest = {
  schemaVersion: 1,
  stableAdmission: false,
  entries: [
    { key: ".", path: "@italone/solace", maturity: "beta", scope: "runtime" },
    { key: "./server", path: "@italone/solace/server", maturity: "beta", scope: "server" },
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
      manifest: { ...manifest, entries: manifest.entries.slice(0, 2) },
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
});
