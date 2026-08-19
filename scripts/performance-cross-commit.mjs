import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const RATIO_PRECISION_TOLERANCE = 1e-6;

export function evaluateCrossCommitPerformance({ config, base, head }) {
  const errors = [];
  const comparisons = [];
  const minimumSamples = config?.minimumSamples;
  const maximumRatio = config?.maximumRatio;

  if (config?.schemaVersion !== 1) errors.push("cross-commit schemaVersion must be 1");
  if (!Number.isInteger(minimumSamples) || minimumSamples < 1) {
    errors.push("minimumSamples must be a positive integer");
  }
  if (!Number.isFinite(maximumRatio) || maximumRatio < 1) {
    errors.push("maximumRatio must be a finite number of at least 1");
  }

  const baseSha = validateRevisionSha("base", base?.sha, errors);
  const headSha = validateRevisionSha("head", head?.sha, errors);
  if (baseSha !== undefined && baseSha === headSha) {
    errors.push("base and head revisions must be different commits");
  }

  evaluateKind({
    kind: "browser",
    scenarios: config?.browser,
    baseRecords: collectBrowserRecords(base?.browserRecords, "base", baseSha, errors),
    headRecords: collectBrowserRecords(head?.browserRecords, "head", headSha, errors),
    minimumSamples,
    maximumRatio,
    errors,
    comparisons,
  });
  evaluateKind({
    kind: "jsdom",
    scenarios: config?.jsdom,
    baseRecords: collectJsdomRecords(base?.jsdomRecords, "base", baseSha, errors),
    headRecords: collectJsdomRecords(head?.jsdomRecords, "head", headSha, errors),
    minimumSamples,
    maximumRatio,
    errors,
    comparisons,
  });

  return {
    valid: errors.length === 0,
    errors,
    comparisons,
    revisions: { base: baseSha, head: headSha },
  };
}

function evaluateKind({
  kind,
  scenarios,
  baseRecords,
  headRecords,
  minimumSamples,
  maximumRatio,
  errors,
  comparisons,
}) {
  if (!isRecord(scenarios) || Object.keys(scenarios).length === 0) {
    errors.push(`${kind} cross-commit scenarios must be a non-empty object`);
    return;
  }

  for (const [scenario, metrics] of Object.entries(scenarios)) {
    if (!Array.isArray(metrics) || metrics.length === 0) {
      errors.push(`${kind}:${scenario} metrics must be a non-empty array`);
      continue;
    }
    const baseScenario = baseRecords.get(scenario) ?? [];
    const headScenario = headRecords.get(scenario) ?? [];
    if (!matchingFingerprints(baseScenario, headScenario)) {
      errors.push(`${kind}:${scenario} environment fingerprint mismatch`);
      continue;
    }

    for (const metric of metrics) {
      if (typeof metric !== "string" || metric.trim() === "") {
        errors.push(`${kind}:${scenario} contains an invalid metric name`);
        continue;
      }
      const baseValues = metricValues(baseScenario, metric);
      const headValues = metricValues(headScenario, metric);
      const id = `${kind}:${scenario}.${metric}`;
      if (!Number.isInteger(minimumSamples)) continue;
      if (baseValues.length < minimumSamples) {
        errors.push(`${id} has ${baseValues.length}/${minimumSamples} base samples`);
      }
      if (headValues.length < minimumSamples) {
        errors.push(`${id} has ${headValues.length}/${minimumSamples} head samples`);
      }
      if (
        baseValues.length < minimumSamples ||
        headValues.length < minimumSamples ||
        !Number.isFinite(maximumRatio)
      ) {
        continue;
      }

      const baseMedian = median(baseValues);
      const headMedian = median(headValues);
      const ratio = headMedian / baseMedian;
      comparisons.push({ id, baseMedian, headMedian, ratio, limit: maximumRatio });
      if (ratio > maximumRatio + RATIO_PRECISION_TOLERANCE) {
        errors.push(
          `FAIL ${id} base=${baseMedian.toFixed(2)}ms head=${headMedian.toFixed(2)}ms ratio=${ratio.toFixed(3)} limit=${maximumRatio.toFixed(3)}`,
        );
      }
    }
  }
}

function collectBrowserRecords(records, label, revisionSha, errors) {
  const grouped = new Map();
  for (const record of records ?? []) {
    if (record?.kind !== "browser-benchmark" || record?.status !== "passed") continue;
    const summary = record.summary;
    const scenario = summary?.scenario;
    if (typeof scenario !== "string" || scenario.trim() === "") continue;
    const key =
      scenario === "keyed-reorder" && typeof summary?.shape === "string"
        ? `${scenario}:${summary.shape}`
        : scenario;
    validateRecordSha("browser", label, summary?.metadata?.commitSha, revisionSha, errors);
    addRecord(grouped, key, {
      metrics: summary,
      fingerprint: browserFingerprint(summary),
    });
  }
  return grouped;
}

function collectJsdomRecords(records, label, revisionSha, errors) {
  const grouped = new Map();
  for (const record of records ?? []) {
    if (record?.kind !== "jsdom-benchmark" || record?.status !== "passed") continue;
    validateRecordSha("jsdom", label, record?.metadata?.commitSha, revisionSha, errors);
    for (const task of record?.summary?.tasks ?? []) {
      if (typeof task?.name !== "string" || task.name.trim() === "") continue;
      addRecord(grouped, task.name, {
        metrics: task.metrics,
        fingerprint: jsdomFingerprint(record.metadata),
      });
    }
  }
  return grouped;
}

function addRecord(grouped, name, record) {
  const list = grouped.get(name) ?? [];
  list.push(record);
  grouped.set(name, list);
}

function validateRevisionSha(label, value, errors) {
  if (typeof value !== "string" || !SHA_PATTERN.test(value)) {
    errors.push(`${label} revision must be a 40-character lowercase hexadecimal SHA`);
    return undefined;
  }
  return value;
}

function validateRecordSha(kind, label, recordSha, revisionSha, errors) {
  if (recordSha === undefined) return;
  if (recordSha !== revisionSha) {
    errors.push(
      `${kind} ${label} record commitSha ${String(recordSha)} conflicts with ${String(revisionSha)}`,
    );
  }
}

function matchingFingerprints(baseRecords, headRecords) {
  if (baseRecords.length === 0 || headRecords.length === 0) return true;
  const fingerprints = [...baseRecords, ...headRecords].map(({ fingerprint }) => fingerprint);
  if (fingerprints.some((fingerprint) => fingerprint === undefined)) return false;
  return fingerprints.every((fingerprint) => fingerprint === fingerprints[0]);
}

function browserFingerprint(summary) {
  const metadata = summary?.metadata;
  return canonicalFingerprint({
    nodeMajor: nodeMajor(metadata?.node),
    platform: metadata?.platform,
    release: metadata?.release,
    arch: metadata?.arch,
    cpuModel: metadata?.cpuModel,
    logicalCpuCount: metadata?.logicalCpuCount,
    browserName: metadata?.browserName,
    browserMajor: versionMajor(metadata?.browserVersion),
    projectName: metadata?.projectName,
    sampleSize: metadata?.sampleSize,
    rows: summary?.rows,
  });
}

function jsdomFingerprint(metadata) {
  return canonicalFingerprint({
    nodeMajor: nodeMajor(metadata?.node),
    platform: metadata?.platform,
    release: metadata?.release,
    arch: metadata?.arch,
    cpuModel: metadata?.cpuModel,
    logicalCpuCount: metadata?.logicalCpuCount,
    benchmarkRunner: metadata?.benchmarkRunner,
    benchmarkEnvironment: metadata?.benchmarkEnvironment,
    sampleSize: metadata?.sampleSize,
  });
}

function canonicalFingerprint(fields) {
  if (Object.values(fields).some((value) => value === undefined || value === "")) return undefined;
  return JSON.stringify(fields);
}

function nodeMajor(value) {
  const match = typeof value === "string" ? /^v?(\d+)/u.exec(value) : undefined;
  return match?.[1];
}

function versionMajor(value) {
  const match = typeof value === "string" ? /^(\d+)/u.exec(value) : undefined;
  return match?.[1];
}

function metricValues(records, metric) {
  return records
    .map(({ metrics }) => metrics?.[metric])
    .filter((value) => typeof value === "number" && Number.isFinite(value) && value > 0);
}

export function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

try {
  const options = parseArguments(process.argv.slice(2));
  const [config, baseRecords, headRecords] = await Promise.all([
    readJson(options.config),
    readJsonLines(options.base),
    readJsonLines(options.head),
  ]);
  const result = evaluateCrossCommitPerformance({
    config,
    base: splitRevision(options.baseSha ?? inferRevisionSha(baseRecords), baseRecords),
    head: splitRevision(options.headSha ?? inferRevisionSha(headRecords), headRecords),
  });
  console.log(`performance cross-commit: ${result.valid ? "PASS" : "FAIL"}`);
  for (const error of result.errors) console.log(error);
  if (options.output !== undefined) {
    const outputPath = resolve(options.output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }
  if (!result.valid) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

function parseArguments(rawArgs) {
  const options = {};
  for (let index = 0; index < rawArgs.length; index += 2) {
    const key = rawArgs[index];
    const value = rawArgs[index + 1];
    if (!["--base", "--head", "--config", "--output", "--base-sha", "--head-sha"].includes(key)) {
      throw new Error(usage());
    }
    if (typeof value !== "string" || value.trim() === "") throw new Error(usage());
    options[key.slice(2).replace("-sha", "Sha")] = value;
  }
  if (options.base === undefined || options.head === undefined || options.config === undefined) {
    throw new Error(usage());
  }
  return options;
}

function usage() {
  return "Usage: node scripts/performance-cross-commit.mjs --base <jsonl> --head <jsonl> --config <json> [--base-sha <sha>] [--head-sha <sha>] [--output <json>]";
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

async function readJsonLines(path) {
  const content = await readFile(resolve(path), "utf8");
  return content
    .split(/\r?\n/u)
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`Invalid JSON at ${path}:${index + 1}`);
      }
    });
}

function inferRevisionSha(records) {
  const values = new Set(
    records
      .map((record) => record?.metadata?.commitSha ?? record?.summary?.metadata?.commitSha)
      .filter((value) => typeof value === "string"),
  );
  if (values.size !== 1)
    throw new Error("A revision SHA must be supplied or uniquely present in records");
  return [...values][0];
}

function splitRevision(sha, records) {
  return {
    sha,
    browserRecords: records.filter((record) => record?.kind === "browser-benchmark"),
    jsdomRecords: records.filter((record) => record?.kind === "jsdom-benchmark"),
  };
}
