const REQUIRED_BASELINES = ["0.1.0-beta.2", "0.1.0-beta.4"];
const REQUIRED_MIGRATION_FIELDS = ["compatibility", "deprecation", "migration", "rollback"];

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
          application.name.trim() !== "",
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

  const devtoolsPassed =
    evidence?.devtools?.productionManifestReviewed === true &&
    evidence?.devtools?.broadHostAccessRemoved === true;

  const missingMigrationFields = REQUIRED_MIGRATION_FIELDS.filter(
    (field) => !isDocumentedProcedure(evidence?.migrationPolicy?.[field]),
  );
  const migrationPassed = missingMigrationFields.length === 0;

  const criteria = [
    {
      id: "adoption.independent-apps",
      passed: adoptionPassed,
      message: adoptionPassed
        ? `${independentApplications.size} independent npm applications are verified.`
        : `Need 2 independent verified npm applications; found ${independentApplications.size}.`,
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
        ? "Production DevTools permissions were reviewed and broad host access was removed."
        : "Production DevTools manifest review and removal of broad host access are required.",
    },
    {
      id: "release.migration-policy",
      passed: migrationPassed,
      message: migrationPassed
        ? "Compatibility, deprecation, migration, and rollback procedures are documented."
        : `Missing release procedures: ${missingMigrationFields.join(", ")}.`,
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

function evaluatePerformanceEvidence(performance) {
  const minimumDistinctRuns = performance?.minimumDistinctRuns;
  const evidencePath = performance?.evidence;
  const summary = performance?.summary;
  const gaps = [];

  if (!Number.isInteger(minimumDistinctRuns) || minimumDistinctRuns < 5) {
    gaps.push("minimumDistinctRuns must be at least 5");
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
    ...findScenarioEvidenceGaps("browser", browserScenarios, minimumDistinctRuns),
    ...findScenarioEvidenceGaps("jsdom", jsdomScenarios, minimumDistinctRuns),
  );

  return {
    passed: gaps.length === 0,
    gaps,
    minimumDistinctRuns,
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

function findScenarioEvidenceGaps(kind, scenarios, minimumDistinctRuns) {
  return Object.entries(scenarios).flatMap(([name, scenario]) => {
    const label = `${kind}:${name}`;
    if (!isValidScenarioEvidence(scenario)) return [`${label} has invalid audit fields`];
    if (!Number.isInteger(minimumDistinctRuns) || scenario.distinctRunCount < minimumDistinctRuns) {
      return [
        `${label} (${String(scenario.distinctRunCount)}/${String(minimumDistinctRuns)} distinct runs)`,
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
