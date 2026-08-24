import { describe, expect, it } from "vitest";

import { createEvidenceBundle, sha256Json } from "../../../scripts/adoption-evidence-config.mjs";
import {
  evaluateOneZeroReadiness as evaluateOneZeroReadinessAtRuntime,
  parseOneZeroReadinessArguments,
} from "../../../scripts/one-zero-readiness-config.mjs";

const READINESS_NOW = Date.parse("2026-08-19T00:00:00.000Z");

function evaluateOneZeroReadiness(evidence: ReadinessEvidenceFixture) {
  return evaluateOneZeroReadinessAtRuntime(evidence, { now: READINESS_NOW });
}

type ReadinessEvidenceFixture = {
  schemaVersion: number;
  applications: Array<{
    name: string;
    independent: boolean;
    packageSource: string;
    packageVersion: string;
    repository: string;
    productionOrigin: string;
    adoptionEvidenceBundle: string;
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
    rollback: { rehearsed: boolean; targetVersion: string; evidence: string };
    evidence: string;
    evidenceBundle?: Record<string, unknown>;
    evidenceRecord?: {
      name: string;
      verified: boolean;
      packageVersion: string;
      packageSource: string;
      primaryRenderer: "solace" | "react";
      productionWorkflows: ReadinessEvidenceFixture["applications"][number]["productionWorkflows"];
      upgrade: { verified: boolean; fromVersion: string };
      evidencePath: string;
      rollbackEvidencePath: string;
      rollback: { rehearsed: boolean; targetVersion: string };
      repository: string;
      productionOrigin: string;
    };
  }>;
  upgradeMatrix: { baselines: Record<string, { verified: boolean }> };
  performance: {
    minimumDistinctRuns: number;
    minimumDistinctDates: number;
    maximumAgeDays: number;
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
    evidenceRecord?: {
      productionManifestReviewed: boolean;
      broadHostAccessRemoved: boolean;
      distributableManifestVerified: boolean;
      testedOrigins: string[];
      artifactEvidence: {
        schemaVersion: number;
        artifactPath: string;
        sha256: string;
        manifestSha256: string;
        origins: string[];
      };
      qa: {
        command: string;
        passed: boolean;
        artifactSha256: string;
      };
    };
  };
  contract: {
    stableAdmission: boolean;
    evidence: string;
    evidenceRecord?: { schemaVersion: number; stableAdmission: boolean };
  };
  migrationPolicy: Record<string, unknown>;
};

type PerformanceScenarioFixture = {
  recordCount: number;
  distinctRunCount: number;
  distinctDateCount: number;
  firstRunAt: string;
  lastRunAt: string;
  runAt: string[];
};

function performanceScenario(distinctRunCount = 5): PerformanceScenarioFixture {
  const runAt = [
    "2026-08-14T00:00:00.000Z",
    "2026-08-15T00:00:00.000Z",
    "2026-08-16T00:00:00.000Z",
    "2026-08-17T00:00:00.000Z",
    "2026-08-18T00:00:00.000Z",
    ...Array.from(
      { length: Math.max(0, distinctRunCount - 5) },
      (_, index) => `2026-08-18T${String(index + 1).padStart(2, "0")}:00:00.000Z`,
    ),
  ].slice(0, distinctRunCount);
  return {
    recordCount: distinctRunCount,
    distinctRunCount,
    distinctDateCount: new Set(runAt.map((value) => value.slice(0, 10))).size,
    firstRunAt: runAt[0],
    lastRunAt: runAt[runAt.length - 1],
    runAt,
  };
}

function readyEvidence(): ReadinessEvidenceFixture {
  const application = (name: string, fromVersion: string) => {
    const repository = `https://github.com/customer/${name}`;
    const productionOrigin = `https://${name}.example.com`;
    const productionWorkflows = {
      router: true,
      store: true,
      asyncComponents: true,
      errorRecovery: true,
      ssrHydration: true,
    };
    const phase = (phaseName: "baseline" | "candidate" | "rollback", version: string) => ({
      schemaVersion: 1,
      phase: phaseName,
      application: {
        name,
        independent: true,
        primaryRenderer: "solace",
        repository,
        productionOrigin,
      },
      repository: { commit: "abc1234", dirty: false },
      package: {
        name: "@italone/solace",
        version,
        manager: "pnpm",
        lockfile: "pnpm-lock.yaml",
        lockfileSha256: "a".repeat(64),
      },
      workflows: productionWorkflows,
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
    const baseline = phase("baseline", fromVersion);
    const baselineEvidenceSha256 = sha256Json(baseline);
    const evidenceBundle = createEvidenceBundle([
      baseline,
      { ...phase("candidate", "0.1.0-beta.5"), baselineEvidenceSha256 },
      { ...phase("rollback", fromVersion), baselineEvidenceSha256 },
    ]);
    return {
      name,
      independent: true as const,
      packageSource: "npm" as const,
      packageVersion: "0.1.0-beta.5",
      repository,
      productionOrigin,
      adoptionEvidenceBundle: `release/adopters/${name}.json`,
      verified: true,
      primaryRenderer: "solace" as const,
      productionWorkflows,
      upgrade: { verified: true, fromVersion },
      rollback: {
        rehearsed: true,
        targetVersion: fromVersion,
        evidence: "release/adoption-evidence.md",
      },
      evidence: "release/adoption-evidence.md",
      evidenceBundle,
      evidenceRecord: {
        name,
        verified: true,
        packageVersion: "0.1.0-beta.5",
        packageSource: "npm",
        primaryRenderer: "solace" as const,
        productionWorkflows,
        upgrade: { verified: true, fromVersion },
        evidencePath: "release/adoption-evidence.md",
        rollbackEvidencePath: "release/adoption-evidence.md",
        rollback: { rehearsed: true, targetVersion: fromVersion },
        repository,
        productionOrigin,
      },
    };
  };

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
      maximumAgeDays: 30,
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
      evidenceRecord: {
        productionManifestReviewed: true,
        broadHostAccessRemoved: true,
        distributableManifestVerified: true,
        testedOrigins: ["https://customer.example"],
        artifactEvidence: {
          schemaVersion: 1,
          artifactPath: ".devtools-artifacts/solace-devtools.zip",
          sha256: "c".repeat(64),
          manifestSha256: "d".repeat(64),
          origins: ["https://customer.example"],
        },
        qa: {
          command: "pnpm test:e2e:devtools-extension",
          passed: true,
          artifactSha256: "c".repeat(64),
        },
      },
    },
    contract: {
      stableAdmission: true,
      evidence: "release/public-contract.json",
      evidenceRecord: { schemaVersion: 1, stableAdmission: true },
    },
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

  it.each(["beta", "local-beta.6", "^0.1.0-beta.5", "0.1"])(
    "does not count non-exact npm package version %s",
    (packageVersion) => {
      const evidence = readyEvidence();
      evidence.applications[0].packageVersion = packageVersion;
      evidence.applications[0].evidenceRecord!.packageVersion = packageVersion;

      const criterion = evaluateOneZeroReadiness(evidence).criteria[0];

      expect(criterion).toMatchObject({ id: "adoption.independent-apps", passed: false });
      expect(criterion.message).toContain("exact npm versions");
    },
  );

  it("requires the loaded record to match the upgrade and rollback target versions", () => {
    const evidence = readyEvidence();
    evidence.applications[0].evidenceRecord!.rollback.targetVersion = "0.1.0-beta.2";
    evidence.applications[1].upgrade.fromVersion = "beta";
    evidence.applications[1].evidenceRecord!.upgrade.fromVersion = "beta";

    const criterion = evaluateOneZeroReadiness(evidence).criteria[0];

    expect(criterion).toMatchObject({ id: "adoption.independent-apps", passed: false });
    expect(criterion.message).toContain("rollback rehearsal");
  });

  it("requires adoption and rollback evidence paths to match the loaded record", () => {
    const evidence = readyEvidence();
    evidence.applications[0].evidenceRecord!.evidencePath = "release/other.md";
    evidence.applications[1].evidenceRecord!.rollbackEvidencePath = "release/other.md";

    const criterion = evaluateOneZeroReadiness(evidence).criteria[0];

    expect(criterion).toMatchObject({ id: "adoption.independent-apps", passed: false });
  });

  it("does not treat boolean-only claims as loaded production evidence", () => {
    const evidence = readyEvidence();
    delete evidence.applications[0].evidenceRecord;
    delete evidence.applications[1].evidenceRecord;
    delete evidence.devtools.evidenceRecord;
    delete evidence.contract.evidenceRecord;

    const result = evaluateOneZeroReadiness(evidence);

    expect(result.ready).toBe(false);
    expect(result.criteria[0]).toMatchObject({ passed: false });
    expect(result.criteria[3]).toMatchObject({ passed: false });
    expect(result.criteria[5]).toMatchObject({ passed: false });
  });

  it("requires a reviewed three-phase adoption evidence bundle", () => {
    const missingBundle = readyEvidence();
    delete missingBundle.applications[0].evidenceBundle;
    expect(evaluateOneZeroReadiness(missingBundle).criteria[0]).toMatchObject({ passed: false });

    const digestMismatch = readyEvidence();
    digestMismatch.applications[0].evidenceBundle!.bundleSha256 = "f".repeat(64);
    expect(evaluateOneZeroReadiness(digestMismatch).criteria[0]).toMatchObject({ passed: false });

    const unreviewed = readyEvidence();
    const unreviewedRecords = unreviewed.applications[0].evidenceBundle!.records as Array<{
      reviewer: { approved: boolean };
    }>;
    unreviewedRecords[2].reviewer.approved = false;
    expect(evaluateOneZeroReadiness(unreviewed).criteria[0]).toMatchObject({ passed: false });
  });

  it("binds adoption bundle versions and application identity to the declaration", () => {
    const identityMismatch = readyEvidence();
    const identityRecords = identityMismatch.applications[0].evidenceBundle!.records as Array<{
      application: { productionOrigin: string };
    }>;
    identityRecords[1].application.productionOrigin = "https://other.example.com";
    expect(evaluateOneZeroReadiness(identityMismatch).criteria[0]).toMatchObject({ passed: false });

    const rollbackMismatch = readyEvidence();
    const rollbackRecords = rollbackMismatch.applications[0].evidenceBundle!.records as Array<{
      package: { version: string };
    }>;
    rollbackRecords[2].package.version = "0.1.0-beta.2";
    expect(evaluateOneZeroReadiness(rollbackMismatch).criteria[0]).toMatchObject({ passed: false });
  });

  it("requires DevTools artifact, origin, and QA evidence to bind to the same digest", () => {
    const originMismatch = readyEvidence();
    originMismatch.devtools.evidenceRecord!.artifactEvidence.origins = ["https://other.example"];
    expect(evaluateOneZeroReadiness(originMismatch).criteria[3]).toMatchObject({ passed: false });

    const digestMismatch = readyEvidence();
    digestMismatch.devtools.evidenceRecord!.qa.artifactSha256 = "e".repeat(64);
    expect(evaluateOneZeroReadiness(digestMismatch).criteria[3]).toMatchObject({ passed: false });

    const missingDigest = readyEvidence();
    missingDigest.devtools.evidenceRecord!.artifactEvidence.sha256 = "";
    expect(evaluateOneZeroReadiness(missingDigest).criteria[3]).toMatchObject({ passed: false });
  });

  it("accepts only exact HTTPS DevTools production origins", () => {
    const evidence = readyEvidence();
    evidence.devtools.testedOrigins = ["https://*.example.com"];
    evidence.devtools.evidenceRecord!.testedOrigins = ["https://*.example.com"];
    evidence.devtools.evidenceRecord!.artifactEvidence.origins = ["https://*.example.com"];

    const criterion = evaluateOneZeroReadiness(evidence).criteria[3];

    expect(criterion).toMatchObject({ id: "devtools.production-permissions", passed: false });
  });

  it("rejects reserved .invalid DevTools smoke origins", () => {
    const evidence = readyEvidence();
    const smokeOrigin = "https://devtools-smoke.invalid";
    evidence.devtools.testedOrigins = [smokeOrigin];
    evidence.devtools.evidenceRecord!.testedOrigins = [smokeOrigin];
    evidence.devtools.evidenceRecord!.artifactEvidence.origins = [smokeOrigin];

    const criterion = evaluateOneZeroReadiness(evidence).criteria[3];

    expect(criterion).toMatchObject({ id: "devtools.production-permissions", passed: false });
  });

  it("requires five distinct calendar dates for every performance scenario", () => {
    const evidence = readyEvidence();
    for (const scenario of [
      ...Object.values(evidence.performance.summary.browserScenarios),
      ...Object.values(evidence.performance.summary.jsdomScenarios),
    ]) {
      scenario.runAt = Array.from({ length: scenario.distinctRunCount }, (_, index) => {
        const date = index < 2 ? "2026-08-17" : "2026-08-18";
        return `${date}T${String(index).padStart(2, "0")}:00:00.000Z`;
      });
      scenario.distinctDateCount = 2;
      scenario.firstRunAt = scenario.runAt[0];
      scenario.lastRunAt = scenario.runAt[scenario.runAt.length - 1];
    }

    const criterion = evaluateOneZeroReadiness(evidence).criteria[2];

    expect(criterion).toMatchObject({ id: "performance.recent-history", passed: false });
    expect(criterion.message).toContain("distinct dates");
  });

  it("recomputes distinct run and date counts from canonical timestamps", () => {
    const evidence = readyEvidence();
    const scenario = evidence.performance.summary.browserScenarios["large-list"];
    scenario.runAt = Array.from(
      { length: 5 },
      (_, index) => `2026-08-18T0${String(index)}:00:00.000Z`,
    );

    const criterion = evaluateOneZeroReadiness(evidence).criteria[2];

    expect(criterion).toMatchObject({ id: "performance.recent-history", passed: false });
    expect(criterion.message).toContain("invalid audit fields");
  });

  it("rejects stale and future performance evidence using injected time", () => {
    const stale = readyEvidence();
    for (const scenario of [
      ...Object.values(stale.performance.summary.browserScenarios),
      ...Object.values(stale.performance.summary.jsdomScenarios),
    ]) {
      scenario.runAt = scenario.runAt.map((value) => value.replace("2026-08", "2026-06"));
      scenario.firstRunAt = scenario.runAt[0];
      scenario.lastRunAt = scenario.runAt[scenario.runAt.length - 1];
    }
    expect(evaluateOneZeroReadiness(stale).criteria[2].message).toContain("older than 30 days");

    const future = readyEvidence();
    const futureScenario = future.performance.summary.browserScenarios["large-list"];
    futureScenario.runAt[4] = "2026-08-20T00:00:00.000Z";
    futureScenario.lastRunAt = futureScenario.runAt[4];
    expect(evaluateOneZeroReadiness(future).criteria[2].message).toContain("future timestamp");
  });

  it("requires an explicit performance evidence age limit", () => {
    const evidence = readyEvidence();
    (evidence.performance as Partial<ReadinessEvidenceFixture["performance"]>).maximumAgeDays =
      undefined;

    const criterion = evaluateOneZeroReadiness(evidence).criteria[2];

    expect(criterion).toMatchObject({ id: "performance.recent-history", passed: false });
    expect(criterion.message).toContain("maximumAgeDays");
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
