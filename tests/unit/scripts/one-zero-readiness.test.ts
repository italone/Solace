import { describe, expect, it } from "vitest";

import {
  evaluateOneZeroReadiness,
  parseOneZeroReadinessArguments,
} from "../../../scripts/one-zero-readiness-config.mjs";

type ReadinessEvidenceFixture = {
  schemaVersion: number;
  applications: Array<{
    name: string;
    independent: boolean;
    packageSource: string;
    verified: boolean;
    primaryRenderer: "solace" | "react";
    productionWorkflows: {
      router: boolean;
      store: boolean;
      asyncComponents: boolean;
      errorRecovery: boolean;
      ssrHydration: boolean;
    };
    upgrade: { verified: boolean; fromVersion: string };
    rollback: { rehearsed: boolean; evidence: string };
    evidence: string;
  }>;
  upgradeMatrix: { baselines: Record<string, { verified: boolean }> };
  performance: {
    minimumDistinctRuns: number;
    minimumDistinctDates: number;
    evidence: string;
    summary: {
      schemaVersion: number;
      sources: Record<string, unknown>;
      browserScenarios: Record<string, PerformanceScenarioFixture>;
      jsdomScenarios: Record<string, PerformanceScenarioFixture>;
    };
  };
  devtools: {
    productionManifestReviewed: boolean;
    broadHostAccessRemoved: boolean;
    distributableManifestVerified: boolean;
    testedOrigins: string[];
  };
  contract: { stableAdmission: boolean; evidence: string };
  migrationPolicy: Record<string, unknown>;
};

type PerformanceScenarioFixture = {
  recordCount: number;
  distinctRunCount: number;
  distinctDateCount: number;
  firstRunAt: string;
  lastRunAt: string;
};

function performanceScenario(distinctRunCount = 5): PerformanceScenarioFixture {
  return {
    recordCount: distinctRunCount,
    distinctRunCount,
    distinctDateCount: 5,
    firstRunAt: "2026-07-16T00:00:00.000Z",
    lastRunAt: "2026-08-14T00:00:00.000Z",
  };
}

function readyEvidence(): ReadinessEvidenceFixture {
  const application = (name: string, fromVersion: string) => ({
    name,
    independent: true as const,
    packageSource: "npm" as const,
    verified: true,
    primaryRenderer: "solace" as const,
    productionWorkflows: {
      router: true,
      store: true,
      asyncComponents: true,
      errorRecovery: true,
      ssrHydration: true,
    },
    upgrade: { verified: true, fromVersion },
    rollback: { rehearsed: true, evidence: "release/adoption-evidence.md" },
    evidence: "release/adoption-evidence.md",
  });

  return {
    schemaVersion: 1,
    applications: [
      application("customer-csr", "0.1.0-beta.4"),
      application("customer-ssr", "0.1.0-beta.4"),
    ],
    upgradeMatrix: {
      baselines: {
        "0.1.0-beta.2": { verified: true },
        "0.1.0-beta.4": { verified: true },
      },
    },
    performance: {
      minimumDistinctRuns: 5,
      minimumDistinctDates: 5,
      evidence: "release/performance-history.json",
      summary: {
        schemaVersion: 1,
        sources: {
          browser: {
            path: ".benchmark-history/browser.jsonl",
            sha256: "a".repeat(64),
            recordCount: 11,
          },
          jsdom: {
            path: ".benchmark-history/jsdom.jsonl",
            sha256: "b".repeat(64),
            recordCount: 12,
          },
        },
        browserScenarios: {
          "large-list": performanceScenario(),
          "keyed-reorder:reverse": performanceScenario(6),
        },
        jsdomScenarios: {
          render: performanceScenario(),
          "list-diff": performanceScenario(7),
        },
      },
    },
    devtools: {
      productionManifestReviewed: true,
      broadHostAccessRemoved: true,
      distributableManifestVerified: true,
      testedOrigins: ["https://customer.example"],
    },
    contract: { stableAdmission: true, evidence: "release/public-contract.json" },
    migrationPolicy: {
      compatibility: {
        documented: true,
        evidence: ["docs/compatibility.md", "docs/compatibility.zh-CN.md"],
      },
      deprecation: {
        documented: true,
        evidence: ["docs/compatibility.md", "docs/compatibility.zh-CN.md"],
      },
      migration: {
        documented: true,
        evidence: ["docs/migration.md", "docs/migration.zh-CN.md"],
      },
      rollback: {
        documented: true,
        evidence: ["docs/migration.md", "docs/migration.zh-CN.md"],
      },
    },
  };
}

describe("1.0 readiness evaluation", () => {
  it("accepts check, report, and pnpm-forwarded report modes", () => {
    expect(parseOneZeroReadinessArguments([])).toBe("check");
    expect(parseOneZeroReadinessArguments(["--report"])).toBe("report");
    expect(parseOneZeroReadinessArguments(["--", "--report"])).toBe("report");
    expect(parseOneZeroReadinessArguments(["--help"])).toBe("help");
    expect(() => parseOneZeroReadinessArguments(["--unknown"])).toThrow("Usage:");
  });

  it("passes only when every admission criterion is satisfied", () => {
    const result = evaluateOneZeroReadiness(readyEvidence());

    expect(result.ready).toBe(true);
    expect(result.criteria.map(({ id }) => id)).toEqual([
      "adoption.independent-apps",
      "compatibility.upgrade-matrix",
      "performance.recent-history",
      "devtools.production-permissions",
      "release.migration-policy",
      "contract.stable-boundary",
    ]);
    expect(result.criteria.every(({ passed }) => passed)).toBe(true);
  });

  it("reports every current beta gap in one pass", () => {
    const evidence = readyEvidence();
    evidence.applications = [
      {
        ...evidence.applications[0],
        name: "repository-example",
        independent: false,
        packageSource: "local",
      },
    ];
    evidence.upgradeMatrix.baselines["0.1.0-beta.4"].verified = false;
    evidence.performance.summary.browserScenarios["large-list"] = performanceScenario(4);
    evidence.performance.summary.jsdomScenarios = {};
    evidence.devtools.broadHostAccessRemoved = false;
    evidence.migrationPolicy.migration = false;
    evidence.migrationPolicy.rollback = false;

    const result = evaluateOneZeroReadiness(evidence);

    expect(result.ready).toBe(false);
    expect(result.criteria.filter(({ passed }) => !passed).map(({ id }) => id)).toEqual([
      "adoption.independent-apps",
      "compatibility.upgrade-matrix",
      "performance.recent-history",
      "devtools.production-permissions",
      "release.migration-policy",
    ]);
    for (const criterion of result.criteria) {
      expect(criterion.message.length).toBeGreaterThan(10);
    }
  });

  it("does not count duplicate or non-registry adoption evidence", () => {
    const evidence = readyEvidence();
    evidence.applications = [
      { ...evidence.applications[0], name: "same-app" },
      { ...evidence.applications[0], name: "same-app" },
      { ...evidence.applications[0], name: "local-fixture", packageSource: "local" },
    ];

    const criterion = evaluateOneZeroReadiness(evidence).criteria[0];
    expect(criterion).toMatchObject({ id: "adoption.independent-apps", passed: false });
  });

  it("does not count npm applications without Solace-primary workflow evidence", () => {
    const evidence = readyEvidence();
    evidence.applications[0].primaryRenderer = "react";
    evidence.applications[1].productionWorkflows.ssrHydration = false;

    const criterion = evaluateOneZeroReadiness(evidence).criteria[0];

    expect(criterion).toMatchObject({ id: "adoption.independent-apps", passed: false });
    expect(criterion.message).toContain("primary");
  });

  it("requires five distinct calendar dates for every performance scenario", () => {
    const evidence = readyEvidence();
    for (const scenario of [
      ...Object.values(evidence.performance.summary.browserScenarios),
      ...Object.values(evidence.performance.summary.jsdomScenarios),
    ]) {
      scenario.distinctDateCount = 2;
    }

    const criterion = evaluateOneZeroReadiness(evidence).criteria[2];

    expect(criterion).toMatchObject({ id: "performance.recent-history", passed: false });
    expect(criterion.message).toContain("distinct dates");
  });

  it("requires both named compatibility baselines", () => {
    const evidence = readyEvidence();
    delete evidence.upgradeMatrix.baselines["0.1.0-beta.2"];

    const criterion = evaluateOneZeroReadiness(evidence).criteria[1];
    expect(criterion).toMatchObject({ id: "compatibility.upgrade-matrix", passed: false });
    expect(criterion.message).toContain("0.1.0-beta.2");
  });

  it("requires at least five recent records for every browser and jsdom scenario", () => {
    const evidence = readyEvidence();
    evidence.performance.summary.browserScenarios["keyed-reorder:reverse"] = performanceScenario(4);

    const criterion = evaluateOneZeroReadiness(evidence).criteria[2];
    expect(criterion).toMatchObject({ id: "performance.recent-history", passed: false });
    expect(criterion.message).toContain("keyed-reorder:reverse");
  });

  it("rejects legacy hand-maintained performance count maps", () => {
    const evidence = readyEvidence();
    (evidence as unknown as { performance: Record<string, unknown> }).performance = {
      minimumRecentRecords: 5,
      browserScenarioCounts: { "large-list": 5 },
      jsdomScenarioCounts: { render: 5 },
    };

    const criterion = evaluateOneZeroReadiness(evidence).criteria[2];

    expect(criterion).toMatchObject({ id: "performance.recent-history", passed: false });
    expect(criterion.message).toContain("minimumDistinctRuns");
  });

  it.each(["", "/absolute.json", "../outside.json", "release/../outside.json"])(
    "rejects unsafe performance evidence path %s",
    (path) => {
      const evidence = readyEvidence();
      evidence.performance.evidence = path;

      const criterion = evaluateOneZeroReadiness(evidence).criteria[2];

      expect(criterion).toMatchObject({ id: "performance.recent-history", passed: false });
      expect(criterion.message).toContain("evidence path");
    },
  );

  it("rejects unsupported or empty performance summaries", () => {
    const unsupported = readyEvidence();
    unsupported.performance.summary.schemaVersion = 2;
    expect(evaluateOneZeroReadiness(unsupported).criteria[2]).toMatchObject({ passed: false });

    const empty = readyEvidence();
    empty.performance.summary.browserScenarios = {};
    empty.performance.summary.jsdomScenarios = {};
    const criterion = evaluateOneZeroReadiness(empty).criteria[2];
    expect(criterion).toMatchObject({ passed: false });
    expect(criterion.message).toContain("browser scenarios are missing");
    expect(criterion.message).toContain("jsdom scenarios are missing");
  });

  it("rejects incomplete source audit evidence", () => {
    const evidence = readyEvidence();
    evidence.performance.summary.sources.browser = {
      path: ".benchmark-history/browser.jsonl",
      sha256: "not-a-digest",
      recordCount: 11,
    };

    const criterion = evaluateOneZeroReadiness(evidence).criteria[2];

    expect(criterion).toMatchObject({ passed: false });
    expect(criterion.message).toContain("browser source evidence is invalid");
  });

  it("rejects inconsistent scenario audit fields", () => {
    const evidence = readyEvidence();
    evidence.performance.summary.jsdomScenarios.render = {
      ...performanceScenario(),
      recordCount: 4,
      distinctRunCount: 5,
      distinctDateCount: 0,
      firstRunAt: "invalid",
    };

    const criterion = evaluateOneZeroReadiness(evidence).criteria[2];

    expect(criterion).toMatchObject({ passed: false });
    expect(criterion.message).toContain("jsdom:render");
  });

  it.each([
    ["legacy true boolean", true],
    ["legacy false boolean", false],
    ["empty evidence array", { documented: true, evidence: [] }],
    ["empty evidence path", { documented: true, evidence: [""] }],
    ["absolute evidence path", { documented: true, evidence: ["/absolute.md"] }],
    ["parent-traversal evidence path", { documented: true, evidence: ["../outside.md"] }],
  ])("rejects %s for a documented release procedure", (_label, migration) => {
    const evidence = readyEvidence();
    evidence.migrationPolicy.migration = migration;

    const criterion = evaluateOneZeroReadiness(evidence).criteria[4];

    expect(criterion).toMatchObject({ id: "release.migration-policy", passed: false });
    expect(criterion.message).toContain("migration");
  });
});
