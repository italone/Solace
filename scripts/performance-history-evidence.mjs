import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function createPerformanceHistoryEvidence({
  root = process.cwd(),
  browserPath,
  jsdomPath,
}) {
  const browserHistory = await readHistory(root, browserPath);
  const jsdomHistory = await readHistory(root, jsdomPath);

  return {
    schemaVersion: 1,
    sources: {
      browser: createSourceEvidence(browserPath, browserHistory),
      jsdom: createSourceEvidence(jsdomPath, jsdomHistory),
    },
    browserScenarios: summarizeBrowserScenarios(browserHistory.records, browserPath),
    jsdomScenarios: summarizeJsdomScenarios(jsdomHistory.records, jsdomPath),
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

function summarizeBrowserScenarios(records, path) {
  const scenarios = new Map();

  for (const { record, line } of records) {
    if (record?.kind !== "browser-benchmark" || record?.status !== "passed") continue;

    const scenario = record.summary?.scenario;
    if (typeof scenario !== "string" || scenario.trim() === "") {
      throw new Error(`Invalid browser benchmark scenario at ${path}:${line}`);
    }
    const shape = record.summary?.shape;
    const key =
      typeof shape === "string" && shape.trim() !== "" ? `${scenario}:${shape}` : scenario;
    addRun(scenarios, key, readCanonicalRunAt(record.summary?.metadata?.runAt, path, line));
  }

  return finalizeScenarios(scenarios);
}

function summarizeJsdomScenarios(records, path) {
  const scenarios = new Map();

  for (const { record, line } of records) {
    if (record?.kind !== "jsdom-benchmark" || record?.status !== "passed") continue;

    const runAt = readCanonicalRunAt(record.metadata?.runAt, path, line);
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

function readCanonicalRunAt(value, path, line) {
  const timestamp = typeof value === "string" ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error(`Invalid benchmark runAt at ${path}:${line}`);
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
          },
        ];
      }),
  );
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

try {
  const options = parseArguments(process.argv.slice(2));
  const evidence = await createPerformanceHistoryEvidence({
    root,
    browserPath: options.browserPath,
    jsdomPath: options.jsdomPath,
  });
  const output = `${JSON.stringify(evidence, null, 2)}\n`;

  if (options.outputPath === undefined) {
    process.stdout.write(output);
  } else {
    const resolvedOutputPath = resolve(root, options.outputPath);
    await mkdir(dirname(resolvedOutputPath), { recursive: true });
    await writeFile(resolvedOutputPath, output, "utf8");
    console.log(`Wrote performance history evidence: ${options.outputPath}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

function parseArguments(rawArgs) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : [...rawArgs];
  const options = {
    browserPath: ".benchmark-history/browser.jsonl",
    jsdomPath: ".benchmark-history/jsdom.jsonl",
    outputPath: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      console.log(usage());
      process.exit(0);
    }
    if (!["--browser", "--jsdom", "--output"].includes(argument)) throw new Error(usage());

    const value = args[index + 1];
    if (!isSafeRepositoryRelativePath(value)) {
      throw new Error(`${argument} must be a repository-relative path`);
    }
    if (argument === "--browser") options.browserPath = value;
    if (argument === "--jsdom") options.jsdomPath = value;
    if (argument === "--output") options.outputPath = value;
    index += 1;
  }

  return options;
}

function usage() {
  return "Usage: node scripts/performance-history-evidence.mjs [--browser <path>] [--jsdom <path>] [--output <path>]";
}
