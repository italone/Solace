import { createEvidenceBundle } from "./adoption-evidence-config.mjs";

const REQUIRED_BASELINES = ["0.1.0-beta.2", "0.1.0-beta.4"];
const REQUIRED_MIGRATION_FIELDS = ["compatibility", "deprecation", "migration", "rollback"];
const REQUIRED_ADOPTION_WORKFLOWS = [
  "router",
  "store",
  "asyncComponents",
  "errorRecovery",
  "ssrHydration",
];

export function parseOneZeroReadinessArguments(rawArgs) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : [...rawArgs];
  if (args.length === 0) return "check";
  if (args.length === 1 && args[0] === "--report") return "report";
  if (args.length === 1 && args[0] === "--help") return "help";
  throw new Error(oneZeroReadinessUsage());
}

export function oneZeroReadinessUsage() {
  return "Usage: node scripts/one-zero-readiness.mjs [--report|--help]";
}

export function evaluateOneZeroReadiness(evidence, { now = Date.now() } = {}) {
  const applications = Array.isArray(evidence?.applications) ? evidence.applications : [];
  const independentApplications = new Set(
    applications
      .filter(
        (application) =>
          application?.independent === true &&
          application?.packageSource === "npm" &&
          application?.verified === true &&
          typeof application?.name === "string" &&
          application.name.trim() !== "" &&
          application?.primaryRenderer === "solace" &&
          hasVerifiedAdoptionEvidence(application) &&
          isSafeEvidencePath(application.rollback.evidence) &&
          isSafeEvidencePath(application.evidence),
      )
      .map((application) => application.name),
  );
  const adoptionPassed = independentApplications.size >= 2;

  const baselines = evidence?.upgradeMatrix?.baselines ?? {};
  const missingBaselines = REQUIRED_BASELINES.filter(
    (baseline) => baselines[baseline]?.verified !== true,
  );
  const compatibilityPassed = missingBaselines.length === 0;

  const performance = evaluatePerformanceEvidence(evidence?.performance, now);

  const devtoolsPassed = hasVerifiedDevtoolsEvidence(evidence?.devtools);

  const missingMigrationFields = REQUIRED_MIGRATION_FIELDS.filter(
    (field) => !isDocumentedProcedure(evidence?.migrationPolicy?.[field]),
  );
  const migrationPassed = missingMigrationFields.length === 0;
  const contractPassed = hasVerifiedContractEvidence(evidence?.contract);

  const criteria = [
    {
      id: "adoption.independent-apps",
      passed: adoptionPassed,
      message: adoptionPassed
        ? `${independentApplications.size} independent Solace-primary npm applications are verified.`
        : `Need 2 independent npm applications with exact npm versions, Solace-primary production workflows, matching upgrade evidence, and a verified rollback rehearsal; found ${independentApplications.size}.`,
    },
    {
      id: "compatibility.upgrade-matrix",
      passed: compatibilityPassed,
      message: compatibilityPassed
        ? `Upgrade evidence covers ${REQUIRED_BASELINES.join(" and ")}.`
        : `Missing verified upgrade evidence for: ${missingBaselines.join(", ")}.`,
    },
    {
      id: "performance.recent-history",
      passed: performance.passed,
      message: performance.passed
        ? `Every browser and jsdom scenario has at least ${performance.minimumDistinctRuns} distinct runs across ${performance.minimumDistinctDates} UTC dates, no older than ${performance.maximumAgeDays} days, backed by ${performance.evidencePath}.`
        : `Performance history is incomplete: ${performance.gaps.join(", ")}.`,
    },
    {
      id: "devtools.production-permissions",
      passed: devtoolsPassed,
      message: devtoolsPassed
        ? "Production DevTools distribution, permissions, and tested origins are verified."
        : "Production DevTools distribution, manifest permissions, and tested origins are required.",
    },
    {
      id: "release.migration-policy",
      passed: migrationPassed,
      message: migrationPassed
        ? "Compatibility, deprecation, migration, and rollback procedures are documented."
        : `Missing release procedures: ${missingMigrationFields.join(", ")}.`,
    },
    {
      id: "contract.stable-boundary",
      passed: contractPassed,
      message: contractPassed
        ? "The public contract manifest confirms a stable 1.0 boundary."
        : "The public contract is still beta or experimental; stable admission remains blocked.",
    },
  ];

  return { ready: criteria.every(({ passed }) => passed), criteria };
}

function isDocumentedProcedure(procedure) {
  return (
    procedure?.documented === true &&
    Array.isArray(procedure.evidence) &&
    procedure.evidence.length > 0 &&
    procedure.evidence.every(isSafeEvidencePath)
  );
}

export function isSafeEvidencePath(value) {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    !/^[/\\]|^[A-Za-z]:[/\\]/u.test(value) &&
    !value.split(/[/\\]+/u).includes("..")
  );
}

function hasRequiredAdoptionWorkflows(workflows) {
  return (
    isRecord(workflows) &&
    REQUIRED_ADOPTION_WORKFLOWS.every((workflow) => workflows[workflow] === true)
  );
}

function hasVerifiedAdoptionEvidence(application) {
  const record = application?.evidenceRecord;
  return (
    isRecord(record) &&
    isExactPackageVersion(application.packageVersion) &&
    isExactPackageVersion(application.upgrade?.fromVersion) &&
    isExactPackageVersion(application.rollback?.targetVersion) &&
    record.name === application.name &&
    record.verified === application.verified &&
    record.packageVersion === application.packageVersion &&
    record.packageSource === application.packageSource &&
    record.primaryRenderer === application.primaryRenderer &&
    record.evidencePath === application.evidence &&
    record.rollbackEvidencePath === application.rollback.evidence &&
    sameWorkflowClaims(record.productionWorkflows, application.productionWorkflows) &&
    record.upgrade?.verified === application.upgrade?.verified &&
    record.upgrade?.fromVersion === application.upgrade?.fromVersion &&
    record.rollback?.rehearsed === application.rollback?.rehearsed &&
    record.rollback?.targetVersion === application.rollback?.targetVersion &&
    record.repository === application.repository &&
    record.productionOrigin === application.productionOrigin &&
    application.rollback.targetVersion === application.upgrade.fromVersion &&
    hasRequiredAdoptionWorkflows(record.productionWorkflows) &&
    record.upgrade?.verified === true &&
    record.rollback?.rehearsed === true &&
    hasVerifiedAdoptionBundle(application)
  );
}

function hasVerifiedAdoptionBundle(application) {
  const bundle = application?.evidenceBundle;
  if (!isSafeEvidencePath(application?.adoptionEvidenceBundle) || !Array.isArray(bundle?.records)) {
    return false;
  }
  try {
    const rebuilt = createEvidenceBundle(bundle.records);
    const records = new Map(bundle.records.map((record) => [record?.phase, record]));
    const baseline = records.get("baseline");
    const candidate = records.get("candidate");
    const rollback = records.get("rollback");
    return (
      bundle.schemaVersion === 1 &&
      bundle.verified === true &&
      bundle.bundleSha256 === rebuilt.bundleSha256 &&
      rebuilt.bundleSha256 === bundle.bundleSha256 &&
      bundle.application?.name === application.name &&
      bundle.application?.repository === application.repository &&
      bundle.application?.productionOrigin === application.productionOrigin &&
      baseline?.package?.version === application.upgrade?.fromVersion &&
      candidate?.package?.version === application.packageVersion &&
      rollback?.package?.version === application.rollback?.targetVersion &&
      bundle.records.every(
        (phase) =>
          phase?.application?.name === application.name &&
          phase.application.independent === application.independent &&
          phase.application.primaryRenderer === application.primaryRenderer &&
          phase.application.repository === application.repository &&
          phase.application.productionOrigin === application.productionOrigin &&
          sameWorkflowClaims(phase.workflows, application.productionWorkflows),
      )
    );
  } catch {
    return false;
  }
}

function isExactPackageVersion(value) {
  return (
    typeof value === "string" &&
    /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.test(
      value,
    )
  );
}

function hasVerifiedDevtoolsEvidence(devtools) {
  const record = devtools?.evidenceRecord;
  const artifact = record?.artifactEvidence;
  const qa = record?.qa;
  return (
    isRecord(record) &&
    record.productionManifestReviewed === devtools.productionManifestReviewed &&
    record.broadHostAccessRemoved === devtools.broadHostAccessRemoved &&
    record.distributableManifestVerified === devtools.distributableManifestVerified &&
    sameStringArray(record.testedOrigins, devtools.testedOrigins) &&
    record.productionManifestReviewed === true &&
    record.broadHostAccessRemoved === true &&
    record.distributableManifestVerified === true &&
    Array.isArray(record.testedOrigins) &&
    record.testedOrigins.length > 0 &&
    record.testedOrigins.every(isExactHttpsOrigin) &&
    new Set(record.testedOrigins).size === record.testedOrigins.length &&
    isRecord(artifact) &&
    artifact.schemaVersion === 1 &&
    isSafeEvidencePath(artifact.artifactPath) &&
    isSha256(artifact.sha256) &&
    isSha256(artifact.manifestSha256) &&
    sameStringArray(artifact.origins, record.testedOrigins) &&
    isRecord(qa) &&
    qa.command === "pnpm test:e2e:devtools-extension" &&
    qa.passed === true &&
    qa.artifactSha256 === artifact.sha256
  );
}

function isExactHttpsOrigin(value) {
  if (typeof value !== "string" || value.includes("*")) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === "" &&
      url.origin === value &&
      hostname !== "invalid" &&
      !hostname.endsWith(".invalid")
    );
  } catch {
    return false;
  }
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function hasVerifiedContractEvidence(contract) {
  const record = contract?.evidenceRecord;
  return (
    isRecord(record) &&
    record.schemaVersion === 1 &&
    record.stableAdmission === contract.stableAdmission &&
    contract.stableAdmission === true &&
    isSafeEvidencePath(contract.evidence)
  );
}

function sameWorkflowClaims(left, right) {
  return (
    isRecord(left) &&
    isRecord(right) &&
    REQUIRED_ADOPTION_WORKFLOWS.every((workflow) => left[workflow] === right[workflow])
  );
}

function sameStringArray(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function evaluatePerformanceEvidence(performance, now) {
  const minimumDistinctRuns = performance?.minimumDistinctRuns;
  const minimumDistinctDates = performance?.minimumDistinctDates;
  const maximumAgeDays = performance?.maximumAgeDays;
  const evidencePath = performance?.evidence;
  const summary = performance?.summary;
  const gaps = [];

  if (!Number.isInteger(minimumDistinctRuns) || minimumDistinctRuns < 5) {
    gaps.push("minimumDistinctRuns must be at least 5");
  }
  if (!Number.isInteger(minimumDistinctDates) || minimumDistinctDates < 5) {
    gaps.push("minimumDistinctDates must be at least 5");
  }
  if (!Number.isInteger(maximumAgeDays) || maximumAgeDays < 1 || maximumAgeDays > 30) {
    gaps.push("maximumAgeDays must be between 1 and 30");
  }
  if (!Number.isFinite(now)) gaps.push("current evaluation time is invalid");
  if (!isSafeEvidencePath(evidencePath)) gaps.push("performance evidence path is invalid");
  if (summary?.schemaVersion !== 1) gaps.push("performance summary schemaVersion must be 1");

  if (!isValidSourceEvidence(summary?.sources?.browser)) {
    gaps.push("browser source evidence is invalid");
  }
  if (!isValidSourceEvidence(summary?.sources?.jsdom)) {
    gaps.push("jsdom source evidence is invalid");
  }

  const browserScenarios = isRecord(summary?.browserScenarios) ? summary.browserScenarios : {};
  const jsdomScenarios = isRecord(summary?.jsdomScenarios) ? summary.jsdomScenarios : {};
  if (Object.keys(browserScenarios).length === 0) gaps.push("browser scenarios are missing");
  if (Object.keys(jsdomScenarios).length === 0) gaps.push("jsdom scenarios are missing");

  gaps.push(
    ...findScenarioEvidenceGaps(
      "browser",
      browserScenarios,
      minimumDistinctRuns,
      minimumDistinctDates,
      maximumAgeDays,
      now,
    ),
    ...findScenarioEvidenceGaps(
      "jsdom",
      jsdomScenarios,
      minimumDistinctRuns,
      minimumDistinctDates,
      maximumAgeDays,
      now,
    ),
  );

  return {
    passed: gaps.length === 0,
    gaps,
    minimumDistinctRuns,
    minimumDistinctDates,
    maximumAgeDays,
    evidencePath,
  };
}

function isValidSourceEvidence(source) {
  return (
    isRecord(source) &&
    isSafeEvidencePath(source.path) &&
    typeof source.sha256 === "string" &&
    /^[a-f0-9]{64}$/u.test(source.sha256) &&
    Number.isInteger(source.recordCount) &&
    source.recordCount >= 1
  );
}

function findScenarioEvidenceGaps(
  kind,
  scenarios,
  minimumDistinctRuns,
  minimumDistinctDates,
  maximumAgeDays,
  now,
) {
  return Object.entries(scenarios).flatMap(([name, scenario]) => {
    const label = `${kind}:${name}`;
    if (hasFutureTimestamp(scenario, now)) return [`${label} has a future timestamp`];
    if (!isValidScenarioEvidence(scenario)) return [`${label} has invalid audit fields`];
    if (!Number.isInteger(minimumDistinctRuns) || scenario.distinctRunCount < minimumDistinctRuns) {
      return [
        `${label} (${String(scenario.distinctRunCount)}/${String(minimumDistinctRuns)} distinct runs)`,
      ];
    }
    if (
      !Number.isInteger(minimumDistinctDates) ||
      scenario.distinctDateCount < minimumDistinctDates
    ) {
      return [
        `${label} (${String(scenario.distinctDateCount)}/${String(minimumDistinctDates)} distinct dates)`,
      ];
    }
    if (
      Number.isInteger(maximumAgeDays) &&
      Number.isFinite(now) &&
      now - Date.parse(scenario.lastRunAt) > maximumAgeDays * 24 * 60 * 60 * 1000
    ) {
      return [`${label} is older than ${String(maximumAgeDays)} days`];
    }
    return [];
  });
}

function isValidScenarioEvidence(scenario) {
  if (!isRecord(scenario)) return false;
  if (!Number.isInteger(scenario.recordCount) || scenario.recordCount < 1) return false;
  if (!Number.isInteger(scenario.distinctRunCount) || scenario.distinctRunCount < 1) return false;
  if (scenario.distinctRunCount > scenario.recordCount) return false;
  if (!Number.isInteger(scenario.distinctDateCount) || scenario.distinctDateCount < 1) return false;
  if (scenario.distinctDateCount > scenario.distinctRunCount) return false;
  if (!Array.isArray(scenario.runAt) || scenario.runAt.length !== scenario.distinctRunCount) {
    return false;
  }
  if (scenario.runAt.some((value) => !isCanonicalTimestamp(value))) return false;
  if (new Set(scenario.runAt).size !== scenario.runAt.length) return false;
  if (scenario.runAt.some((value, index) => index > 0 && scenario.runAt[index - 1] >= value)) {
    return false;
  }
  if (!isCanonicalTimestamp(scenario.firstRunAt) || !isCanonicalTimestamp(scenario.lastRunAt)) {
    return false;
  }
  if (scenario.firstRunAt !== scenario.runAt[0] || scenario.lastRunAt !== scenario.runAt.at(-1)) {
    return false;
  }
  if (
    new Set(scenario.runAt.map((value) => value.slice(0, 10))).size !== scenario.distinctDateCount
  ) {
    return false;
  }
  if (scenario.firstRunAt > scenario.lastRunAt) return false;
  return scenario.distinctRunCount !== 1 || scenario.firstRunAt === scenario.lastRunAt;
}

function hasFutureTimestamp(scenario, now) {
  return (
    Number.isFinite(now) &&
    Array.isArray(scenario?.runAt) &&
    scenario.runAt.some((value) => isCanonicalTimestamp(value) && Date.parse(value) > now)
  );
}

function isCanonicalTimestamp(value) {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
