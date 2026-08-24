import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function createPerformanceHistoryEvidence({
  root = process.cwd(),
  browserPath,
  jsdomPath,
  now = Date.now(),
}) {
  const browserHistory = await readHistory(root, browserPath);
  const jsdomHistory = await readHistory(root, jsdomPath);

  return {
    schemaVersion: 1,
    sources: {
      browser: createSourceEvidence(browserPath, browserHistory),
      jsdom: createSourceEvidence(jsdomPath, jsdomHistory),
    },
    browserScenarios: summarizeBrowserScenarios(browserHistory.records, browserPath, now),
    jsdomScenarios: summarizeJsdomScenarios(jsdomHistory.records, jsdomPath, now),
  };
}

export function isSafeRepositoryRelativePath(value) {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    !/^[/\\]|^[A-Za-z]:[/\\]/u.test(value) &&
    !value.split(/[/\\]+/u).includes("..")
  );
}

async function readHistory(root, path) {
  if (!isSafeRepositoryRelativePath(path)) {
    throw new Error(`Benchmark history path must be repository-relative: ${String(path)}`);
  }

  let content;
  try {
    content = await readFile(resolve(root, path), "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Benchmark history file not found: ${path}`);
    }
    throw error;
  }

  const records = [];
  content.split(/\r?\n/u).forEach((line, index) => {
    if (line.trim() === "") return;
    try {
      records.push({ record: JSON.parse(line), line: index + 1 });
    } catch {
      throw new Error(`Invalid benchmark history JSON at ${path}:${index + 1}`);
    }
  });

  return { content, records };
}

function createSourceEvidence(path, history) {
  return {
    path,
    sha256: createHash("sha256").update(history.content).digest("hex"),
    recordCount: history.records.length,
  };
}

function summarizeBrowserScenarios(records, path, now) {
  const scenarios = new Map();

  for (const { record, line } of records) {
    if (record?.kind !== "browser-benchmark" || record?.status !== "passed") continue;

    const scenario = record.summary?.scenario;
    if (typeof scenario !== "string" || scenario.trim() === "") {
      throw new Error(`Invalid browser benchmark scenario at ${path}:${line}`);
    }
    const shape = record.summary?.shape;
    // The shapeless keyed-reorder variant was retired from the browser benchmark
    // suite; its historical records must not create unmeetable scenario gates.
    if (scenario === "keyed-reorder" && (shape === undefined || shape === null)) continue;
    const key =
      typeof shape === "string" && shape.trim() !== "" ? `${scenario}:${shape}` : scenario;
    addRun(scenarios, key, readCanonicalRunAt(record.summary?.metadata?.runAt, path, line, now));
  }

  return finalizeScenarios(scenarios);
}

function summarizeJsdomScenarios(records, path, now) {
  const scenarios = new Map();

  for (const { record, line } of records) {
    if (record?.kind !== "jsdom-benchmark" || record?.status !== "passed") continue;

    const runAt = readCanonicalRunAt(record.metadata?.runAt, path, line, now);
    if (record.summary?.tasks === undefined) continue;
    if (!Array.isArray(record.summary.tasks) || record.summary.tasks.length === 0) {
      throw new Error(`Missing jsdom benchmark tasks at ${path}:${line}`);
    }

    const taskNames = new Set();
    for (const task of record.summary.tasks) {
      if (typeof task?.name !== "string" || task.name.trim() === "") {
        throw new Error(`Invalid jsdom benchmark task at ${path}:${line}`);
      }
      taskNames.add(task.name);
    }
    for (const taskName of taskNames) addRun(scenarios, taskName, runAt);
  }

  return finalizeScenarios(scenarios);
}

function readCanonicalRunAt(value, path, line, now) {
  const timestamp = typeof value === "string" ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error(`Invalid benchmark runAt at ${path}:${line}`);
  }
  if (!Number.isFinite(now) || timestamp > now) {
    throw new Error(`Future benchmark runAt at ${path}:${line}`);
  }
  return value;
}

function addRun(scenarios, name, runAt) {
  const scenario = scenarios.get(name) ?? { recordCount: 0, runAt: new Set() };
  scenario.recordCount += 1;
  scenario.runAt.add(runAt);
  scenarios.set(name, scenario);
}

function finalizeScenarios(scenarios) {
  return Object.fromEntries(
    [...scenarios.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, scenario]) => {
        const runAt = [...scenario.runAt].sort();
        return [
          name,
          {
            recordCount: scenario.recordCount,
            distinctRunCount: runAt.length,
            distinctDateCount: new Set(runAt.map((value) => value.slice(0, 10))).size,
            firstRunAt: runAt[0],
            lastRunAt: runAt.at(-1),
            runAt,
          },
        ];
      }),
  );
}
