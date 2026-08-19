import { createHash } from "node:crypto";

const EXACT_VERSION =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const PHASES = ["baseline", "candidate", "rollback"];
const WORKFLOWS = ["router", "store", "asyncComponents", "errorRecovery", "ssrHydration"];

export function parseAdoptionEvidenceArguments(rawArgs) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : [...rawArgs];
  const records = [];
  let output;

  while (args.length > 0) {
    const option = args.shift();
    if (option === "--record") {
      const value = args.shift();
      if (isSafeJsonPath(value)) {
        records.push(value);
        continue;
      }
    }
    if (option === "--output" && output === undefined) {
      const value = args.shift();
      if (isSafeJsonPath(value)) {
        output = value;
        continue;
      }
    }
    throw usageError();
  }

  if (records.length !== 3 || new Set(records).size !== 3 || output === undefined)
    throw usageError();
  return { records, output };
}

export function validatePhaseRecord(record) {
  const errors = [];
  if (!isRecord(record) || record.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!PHASES.includes(record?.phase))
    errors.push("phase must be baseline, candidate, or rollback");
  const application = record?.application;
  if (!isRecord(application)) {
    errors.push("application is required");
  } else {
    if (typeof application.name !== "string" || application.name.length === 0) {
      errors.push("application.name is required");
    }
    if (application.independent !== true) errors.push("application must be independent");
    if (application.primaryRenderer !== "solace") errors.push("application must be Solace-primary");
    if (!isHttpsUrl(application.repository)) errors.push("repository must be an HTTPS URL");
    if (!isHttpsOrigin(application.productionOrigin))
      errors.push("productionOrigin must be exact HTTPS");
  }

  if (!isRecord(record?.repository) || !isNonEmptyString(record.repository.commit)) {
    errors.push("repository.commit is required");
  }
  if (record?.repository?.dirty !== false) errors.push("repository must be clean");

  const packageInfo = record?.package;
  if (!isRecord(packageInfo) || packageInfo.name !== "@italone/solace") {
    errors.push("package.name must be @italone/solace");
  }
  if (!isExactVersion(packageInfo?.version)) errors.push("package.version must be exact");
  if (!isNonEmptyString(packageInfo?.manager)) errors.push("package.manager is required");
  if (!isNonEmptyString(packageInfo?.lockfile)) errors.push("package.lockfile is required");
  if (!isSha256(packageInfo?.lockfileSha256)) errors.push("package.lockfileSha256 must be SHA-256");

  if (!isRecord(record?.workflows) || WORKFLOWS.some((name) => record.workflows[name] !== true)) {
    errors.push("all required production workflows must be true");
  }
  if (!Array.isArray(record?.commands) || record.commands.length === 0) {
    errors.push("commands are required");
  } else {
    for (const [index, command] of record.commands.entries()) {
      if (!Array.isArray(command?.argv) || command.argv.length === 0) {
        errors.push(`commands[${index}].argv is required`);
      }
      if (command?.exitCode !== 0) errors.push(`commands[${index}] did not pass`);
      if (!Number.isFinite(command?.durationMs) || command.durationMs < 0) {
        errors.push(`commands[${index}].durationMs is invalid`);
      }
      if (!isSha256(command?.stdoutSha256) || !isSha256(command?.stderrSha256)) {
        errors.push(`commands[${index}] output digests are invalid`);
      }
    }
  }
  if (record?.verified !== true) errors.push("phase must be marked verified");
  if (!isRecord(record?.reviewer) || !isNonEmptyString(record.reviewer.name)) {
    errors.push("reviewer.name is required");
  }
  if (record?.reviewer?.approved !== true) errors.push("reviewer approval is required");
  if (
    ["candidate", "rollback"].includes(record?.phase) &&
    !isSha256(record.baselineEvidenceSha256)
  ) {
    errors.push("baselineEvidenceSha256 must be SHA-256");
  }
  return { valid: errors.length === 0, errors };
}

export function createEvidenceBundle(records) {
  if (!Array.isArray(records) || records.length !== PHASES.length) {
    throw new Error("evidence bundle requires baseline, candidate, and rollback records");
  }
  const validation = records.map(validatePhaseRecord);
  const errors = validation.flatMap((result) => result.errors);
  const byPhase = new Map(records.map((record) => [record.phase, record]));
  if (byPhase.size !== PHASES.length) errors.push("evidence phases must be unique");
  for (const phase of PHASES) if (!byPhase.has(phase)) errors.push(`missing ${phase} phase`);

  const baseline = byPhase.get("baseline");
  if (baseline) {
    const baselineDigest = sha256Json(baseline);
    for (const phase of ["candidate", "rollback"]) {
      const record = byPhase.get(phase);
      if (record && record.baselineEvidenceSha256 !== baselineDigest) {
        errors.push(`${phase} baseline evidence digest mismatch`);
      }
    }
    for (const record of records) {
      if (!sameApplication(record.application, baseline.application)) {
        errors.push("phase application identity mismatch");
      }
    }
    const candidate = byPhase.get("candidate");
    const rollback = byPhase.get("rollback");
    if (candidate?.package?.version === baseline.package?.version) {
      errors.push("candidate package version must differ from baseline");
    }
    if (rollback?.package?.version !== baseline.package?.version) {
      errors.push("rollback package version must match baseline");
    }
  }
  if (errors.length > 0) throw new Error(errors.join("; "));

  const payload = {
    schemaVersion: 1,
    application: baseline.application,
    repository: baseline.repository,
    productionOrigin: baseline.application.productionOrigin,
    phases: PHASES,
    records,
    verified: true,
  };
  return { ...payload, bundleSha256: sha256Json(payload) };
}

export function serializeEvidenceBundle(bundle) {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

export function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sameApplication(left, right) {
  return (
    left?.name === right?.name &&
    left?.independent === right?.independent &&
    left?.primaryRenderer === right?.primaryRenderer &&
    left?.repository === right?.repository &&
    left?.productionOrigin === right?.productionOrigin
  );
}

function isHttpsOrigin(value) {
  if (!isHttpsUrl(value)) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

function isHttpsUrl(value) {
  if (typeof value !== "string" || !value.startsWith("https://") || value.includes("*"))
    return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

function isExactVersion(value) {
  return typeof value === "string" && EXACT_VERSION.test(value);
}

function isSafeJsonPath(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.startsWith("-") ||
    value.startsWith("/") ||
    value.includes("\\") ||
    /^[A-Za-z]:/u.test(value) ||
    !value.endsWith(".json")
  ) {
    return false;
  }
  const segments = value.split("/");
  return segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function isSha256(value) {
  return typeof value === "string" && SHA256.test(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function usageError() {
  return new Error(
    "adoption evidence usage failed\nUsage: node scripts/adoption-evidence.mjs --record <baseline.json> --record <candidate.json> --record <rollback.json> --output <bundle.json>",
  );
}
