import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadOneZeroReadinessEvidence } from "../../../scripts/one-zero-readiness-evidence.mjs";

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value)}\n`, "utf8");
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
});
