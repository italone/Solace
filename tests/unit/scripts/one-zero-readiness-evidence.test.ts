import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createEvidenceBundle, sha256Json } from "../../../scripts/adoption-evidence-config.mjs";
import { loadOneZeroReadinessEvidence } from "../../../scripts/one-zero-readiness-evidence.mjs";

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value)}\n`, "utf8");
}

function adoptionBundle() {
  const application = {
    name: "customer-app",
    independent: true,
    primaryRenderer: "solace",
    repository: "https://github.com/customer/customer-app",
    productionOrigin: "https://customer.example.com",
  };
  const record = (phase: "baseline" | "candidate" | "rollback", version: string) => ({
    schemaVersion: 1,
    phase,
    application,
    repository: { commit: "abc1234", dirty: false },
    package: {
      name: "@italone/solace",
      version,
      manager: "pnpm",
      lockfile: "pnpm-lock.yaml",
      lockfileSha256: "a".repeat(64),
    },
    workflows: {
      router: true,
      store: true,
      asyncComponents: true,
      errorRecovery: true,
      ssrHydration: true,
    },
    commands: [
      {
        argv: ["pnpm", "check"],
        exitCode: 0,
        durationMs: 1,
        stdoutSha256: "b".repeat(64),
        stderrSha256: "c".repeat(64),
      },
    ],
    verified: true,
    reviewer: { name: "release-reviewer", approved: true },
  });
  const baseline = record("baseline", "0.1.0-beta.4");
  const baselineEvidenceSha256 = sha256Json(baseline);
  return createEvidenceBundle([
    baseline,
    { ...record("candidate", "0.1.0-beta.6"), baselineEvidenceSha256 },
    { ...record("rollback", "0.1.0-beta.4"), baselineEvidenceSha256 },
  ]);
}

describe("1.0 readiness evidence loading", () => {
  it("loads and injects the referenced performance summary", async () => {
    const root = await mkdtemp(join(tmpdir(), "solace-one-zero-evidence-"));
    await mkdir(join(root, "release"));

    try {
      await writeJson(join(root, "release", "one-zero-readiness.json"), {
        schemaVersion: 1,
        performance: {
          minimumDistinctRuns: 5,
          evidence: "release/performance-history.json",
        },
      });
      await writeJson(join(root, "release", "performance-history.json"), {
        schemaVersion: 1,
        browserScenarios: { "large-list": {} },
        jsdomScenarios: { render: {} },
      });

      const evidence = (await loadOneZeroReadinessEvidence({ root })) as {
        performance: { evidence: string; summary: { schemaVersion: number } };
      };

      expect(evidence.performance.evidence).toBe("release/performance-history.json");
      expect(evidence.performance.summary.schemaVersion).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects unsafe referenced performance paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "solace-one-zero-path-"));
    await mkdir(join(root, "release"));

    try {
      await writeJson(join(root, "release", "one-zero-readiness.json"), {
        performance: { evidence: "../outside.json" },
      });

      await expect(loadOneZeroReadinessEvidence({ root })).rejects.toThrow(
        "Invalid performance evidence path in release/one-zero-readiness.json",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports missing and malformed referenced evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "solace-one-zero-input-"));
    await mkdir(join(root, "release"));

    try {
      await writeJson(join(root, "release", "one-zero-readiness.json"), {
        performance: { evidence: "release/missing.json" },
      });
      await expect(loadOneZeroReadinessEvidence({ root })).rejects.toThrow(
        "Readiness evidence file not found: release/missing.json",
      );

      await writeFile(join(root, "release", "bad.json"), "{bad-json}\n", "utf8");
      await writeJson(join(root, "release", "one-zero-readiness.json"), {
        performance: { evidence: "release/bad.json" },
      });
      await expect(loadOneZeroReadinessEvidence({ root })).rejects.toThrow(
        "Invalid readiness evidence JSON at release/bad.json",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a missing application evidence document", async () => {
    const root = await mkdtemp(join(tmpdir(), "solace-one-zero-adoption-path-"));
    await mkdir(join(root, "release"));

    try {
      await writeJson(join(root, "release", "one-zero-readiness.json"), {
        applications: [{ evidence: "release/missing-adoption.md" }],
        performance: { evidence: "release/performance-history.json" },
      });
      await writeJson(join(root, "release", "performance-history.json"), {
        schemaVersion: 1,
        browserScenarios: { "large-list": {} },
        jsdomScenarios: { render: {} },
      });

      await expect(loadOneZeroReadinessEvidence({ root })).rejects.toThrow(
        "Readiness evidence file not found: release/missing-adoption.md",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects an empty structured contract evidence document", async () => {
    const root = await mkdtemp(join(tmpdir(), "solace-one-zero-contract-"));
    await mkdir(join(root, "release"));

    try {
      await writeJson(join(root, "release", "one-zero-readiness.json"), {
        contract: { stableAdmission: true, evidence: "release/public-contract.json" },
        performance: { evidence: "release/performance-history.json" },
      });
      await writeJson(join(root, "release", "performance-history.json"), {
        schemaVersion: 1,
        browserScenarios: { "large-list": {} },
        jsdomScenarios: { render: {} },
      });
      await writeFile(join(root, "release", "public-contract.json"), "\n", "utf8");

      await expect(loadOneZeroReadinessEvidence({ root })).rejects.toThrow(
        "Empty readiness evidence document: release/public-contract.json",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a non-structured DevTools evidence document", async () => {
    const root = await mkdtemp(join(tmpdir(), "solace-one-zero-devtools-"));
    await mkdir(join(root, "release"));

    try {
      await writeJson(join(root, "release", "one-zero-readiness.json"), {
        devtools: { evidence: "release/devtools.json" },
        performance: { evidence: "release/performance-history.json" },
      });
      await writeJson(join(root, "release", "performance-history.json"), {
        schemaVersion: 1,
        browserScenarios: { "large-list": {} },
        jsdomScenarios: { render: {} },
      });
      await writeFile(join(root, "release", "devtools.json"), "plain text\n", "utf8");

      await expect(loadOneZeroReadinessEvidence({ root })).rejects.toThrow(
        "Invalid readiness evidence JSON at release/devtools.json",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects adoption records that do not match the declared application", async () => {
    const root = await mkdtemp(join(tmpdir(), "solace-one-zero-adoption-record-"));
    await mkdir(join(root, "release"));

    try {
      await writeJson(join(root, "release", "one-zero-readiness.json"), {
        adoptionEvidence: "release/adoption.json",
        applications: [{ name: "customer-app", evidence: "release/adoption.md" }],
        performance: { evidence: "release/performance-history.json" },
      });
      await writeJson(join(root, "release", "adoption.json"), {
        schemaVersion: 1,
        applications: [{ name: "different-app" }],
      });
      await writeFile(join(root, "release", "adoption.md"), "evidence\n", "utf8");
      await writeJson(join(root, "release", "performance-history.json"), {
        schemaVersion: 1,
        browserScenarios: { "large-list": {} },
        jsdomScenarios: { render: {} },
      });

      await expect(loadOneZeroReadinessEvidence({ root })).rejects.toThrow(
        "Missing adoption evidence record: customer-app",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("loads and verifies a declared independent adoption bundle", async () => {
    const root = await mkdtemp(join(tmpdir(), "solace-one-zero-adoption-bundle-"));
    await mkdir(join(root, "release", "adopters"), { recursive: true });
    const bundle = adoptionBundle();

    try {
      await writeJson(join(root, "release", "one-zero-readiness.json"), {
        adoptionEvidence: "release/adoption.json",
        applications: [
          {
            name: "customer-app",
            evidence: "release/adoption.md",
            rollback: { evidence: "release/adoption.md" },
            adoptionEvidenceBundle: "release/adopters/customer-app.json",
          },
        ],
        performance: { evidence: "release/performance-history.json" },
      });
      await writeJson(join(root, "release", "adoption.json"), {
        schemaVersion: 1,
        applications: [
          {
            name: "customer-app",
            evidencePath: "release/adoption.md",
            rollbackEvidencePath: "release/adoption.md",
          },
        ],
      });
      await writeFile(join(root, "release", "adoption.md"), "evidence\n", "utf8");
      await writeJson(join(root, "release", "adopters", "customer-app.json"), bundle);
      await writeJson(join(root, "release", "performance-history.json"), {
        schemaVersion: 1,
        browserScenarios: { "large-list": {} },
        jsdomScenarios: { render: {} },
      });

      const evidence = (await loadOneZeroReadinessEvidence({ root })) as {
        applications: Array<{ evidenceBundle?: { bundleSha256: string } }>;
      };
      expect(evidence.applications[0].evidenceBundle?.bundleSha256).toBe(bundle.bundleSha256);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a declared adoption bundle with a mismatched digest", async () => {
    const root = await mkdtemp(join(tmpdir(), "solace-one-zero-adoption-digest-"));
    await mkdir(join(root, "release", "adopters"), { recursive: true });
    const bundle = { ...adoptionBundle(), bundleSha256: "f".repeat(64) };

    try {
      await writeJson(join(root, "release", "one-zero-readiness.json"), {
        adoptionEvidence: "release/adoption.json",
        applications: [
          {
            name: "customer-app",
            evidence: "release/adoption.md",
            rollback: { evidence: "release/adoption.md" },
            adoptionEvidenceBundle: "release/adopters/customer-app.json",
          },
        ],
        performance: { evidence: "release/performance-history.json" },
      });
      await writeJson(join(root, "release", "adoption.json"), {
        schemaVersion: 1,
        applications: [
          {
            name: "customer-app",
            evidencePath: "release/adoption.md",
            rollbackEvidencePath: "release/adoption.md",
          },
        ],
      });
      await writeFile(join(root, "release", "adoption.md"), "evidence\n", "utf8");
      await writeJson(join(root, "release", "adopters", "customer-app.json"), bundle);
      await writeJson(join(root, "release", "performance-history.json"), {
        schemaVersion: 1,
        browserScenarios: { "large-list": {} },
        jsdomScenarios: { render: {} },
      });

      await expect(loadOneZeroReadinessEvidence({ root })).rejects.toThrow(
        "Adoption evidence bundle digest does not match: customer-app",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
