import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { isSafeEvidencePath, loadOneZeroReadinessEvidence } from "./one-zero-readiness-evidence.mjs";

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

export function evaluateOneZeroReadiness(evidence) {
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

  const performance = evaluatePerformanceEvidence(evidence?.performance);

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
        : `Need 2 independent npm applications with Solace-primary production workflows; found ${independentApplications.size}.`,
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
        ? `Every browser and jsdom scenario has at least ${performance.minimumDistinctRuns} distinct runs backed by ${performance.evidencePath}.`
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
    record.name === application.name &&
    record.verified === application.verified &&
    record.packageVersion === application.packageVersion &&
    record.packageSource === application.packageSource &&
    record.primaryRenderer === application.primaryRenderer &&
    sameWorkflowClaims(record.productionWorkflows, application.productionWorkflows) &&
    record.upgrade?.verified === application.upgrade?.verified &&
    record.upgrade?.fromVersion === application.upgrade?.fromVersion &&
    record.rollback?.rehearsed === application.rollback?.rehearsed &&
    hasRequiredAdoptionWorkflows(record.productionWorkflows) &&
    record.upgrade?.verified === true &&
    typeof record.upgrade.fromVersion === "string" &&
    record.upgrade.fromVersion.trim() !== "" &&
    record.rollback?.rehearsed === true
  );
}

function hasVerifiedDevtoolsEvidence(devtools) {
  const record = devtools?.evidenceRecord;
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
    record.testedOrigins.length > 0
  );
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

function evaluatePerformanceEvidence(performance) {
  const minimumDistinctRuns = performance?.minimumDistinctRuns;
  const minimumDistinctDates = performance?.minimumDistinctDates;
  const evidencePath = performance?.evidence;
  const summary = performance?.summary;
  const gaps = [];

  if (!Number.isInteger(minimumDistinctRuns) || minimumDistinctRuns < 5) {
    gaps.push("minimumDistinctRuns must be at least 5");
  }
  if (!Number.isInteger(minimumDistinctDates) || minimumDistinctDates < 5) {
    gaps.push("minimumDistinctDates must be at least 5");
  }
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
    ),
    ...findScenarioEvidenceGaps("jsdom", jsdomScenarios, minimumDistinctRuns, minimumDistinctDates),
  );

  return {
    passed: gaps.length === 0,
    gaps,
    minimumDistinctRuns,
    minimumDistinctDates,
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

function findScenarioEvidenceGaps(kind, scenarios, minimumDistinctRuns, minimumDistinctDates) {
  return Object.entries(scenarios).flatMap(([name, scenario]) => {
    const label = `${kind}:${name}`;
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
  if (!isCanonicalTimestamp(scenario.firstRunAt) || !isCanonicalTimestamp(scenario.lastRunAt)) {
    return false;
  }
  if (scenario.firstRunAt > scenario.lastRunAt) return false;
  return scenario.distinctRunCount !== 1 || scenario.firstRunAt === scenario.lastRunAt;
}

function isCanonicalTimestamp(value) {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const isMain =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  try {
    const mode = parseOneZeroReadinessArguments(process.argv.slice(2));
    if (mode === "help") {
      console.log(oneZeroReadinessUsage());
    } else {
      const evidence = await loadOneZeroReadinessEvidence({ root });
      const result = evaluateOneZeroReadiness(evidence);
      console.log(`Solace 1.0 evidence checklist: ${result.ready ? "READY" : "INCOMPLETE"}`);
      for (const criterion of result.criteria) {
        console.log(`${criterion.passed ? "PASS" : "FAIL"} ${criterion.id}: ${criterion.message}`);
      }
      if (!result.ready && mode === "check") process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
