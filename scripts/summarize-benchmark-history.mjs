import { readFile } from "node:fs/promises";

const defaultHistoryPaths = [".benchmark-history/jsdom.jsonl", ".benchmark-history/browser.jsonl"];
const numericBrowserMetrics = ["initialRenderMs", "updateMs", "unmountMs"];
const isCli = process.argv[1] === new URL(import.meta.url).pathname;

if (isCli) {
  try {
    const { help, json, latestBrowserCount, minBrowserCount, paths } = parseArgs(
      process.argv.slice(2),
    );
    if (help) {
      printHelp();
      process.exitCode = 0;
    } else {
      const summary = await summarizeBenchmarkHistory(paths, { latestBrowserCount });

      validateSummary(summary, { minBrowserCount });

      if (json) {
        console.log(JSON.stringify(summary));
      } else {
        printTextSummary(summary);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

export function parseArgs(args) {
  let help = false;
  let json = false;
  let latestBrowserCount;
  let minBrowserCount;
  const paths = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }

    if (arg === "--min-browser-count") {
      minBrowserCount = parsePositiveInteger(args[index + 1], "--min-browser-count");
      index += 1;
      continue;
    }

    if (arg.startsWith("--min-browser-count=")) {
      minBrowserCount = parsePositiveInteger(
        arg.slice("--min-browser-count=".length),
        "--min-browser-count",
      );
      continue;
    }

    if (arg === "--latest-browser-count") {
      latestBrowserCount = parsePositiveInteger(args[index + 1], "--latest-browser-count");
      index += 1;
      continue;
    }

    if (arg.startsWith("--latest-browser-count=")) {
      latestBrowserCount = parsePositiveInteger(
        arg.slice("--latest-browser-count=".length),
        "--latest-browser-count",
      );
      continue;
    }

    paths.push(arg);
  }

  return {
    help,
    json,
    latestBrowserCount,
    minBrowserCount,
    paths: paths.length === 0 ? defaultHistoryPaths : paths,
  };
}

function printHelp() {
  console.log(`Usage: pnpm benchmark:history -- [options] [history-path...]

Options:
  --json                         Print the summary as JSON.
  --min-browser-count <count>    Require each browser benchmark scenario to have at least count records.
  --latest-browser-count <count> Summarize only the latest count browser records per scenario.
  -h, --help                     Show this help message.
`);
}

function parsePositiveInteger(rawValue, optionName) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${optionName} must be a positive integer`);
  }

  return value;
}

export async function summarizeBenchmarkHistory(paths, { latestBrowserCount } = {}) {
  const records = await readHistoryRecords(paths);
  const summarizedRecords = filterLatestBrowserRecords(records, latestBrowserCount);
  const groups = createSummaryGroups(summarizedRecords);

  return {
    recordCount: summarizedRecords.length,
    groups,
  };
}

export function validateSummary(summary, { minBrowserCount } = {}) {
  if (minBrowserCount === undefined) {
    return;
  }

  const browserGroups = summary.groups.filter((group) => group.kind === "browser-benchmark");
  if (browserGroups.length === 0) {
    throw new Error(`Browser benchmark history has 0 record(s), below required ${minBrowserCount}`);
  }

  for (const group of browserGroups) {
    if (group.recordCount < minBrowserCount) {
      const label = group.scenario ?? "unknown";
      throw new Error(
        `Browser benchmark ${label} has ${group.recordCount} record(s), below required ${minBrowserCount}`,
      );
    }
  }
}

function filterLatestBrowserRecords(records, latestBrowserCount) {
  if (latestBrowserCount === undefined) {
    return records;
  }

  const browserRecordIndexes = new Map();
  records.forEach((record, index) => {
    const groupKey = getGroupKey(record);
    if (groupKey?.kind !== "browser-benchmark") {
      return;
    }

    const indexes = browserRecordIndexes.get(groupKey.key) ?? [];
    indexes.push(index);
    browserRecordIndexes.set(groupKey.key, indexes);
  });

  const keptBrowserIndexes = new Set();
  for (const indexes of browserRecordIndexes.values()) {
    indexes.slice(-latestBrowserCount).forEach((index) => keptBrowserIndexes.add(index));
  }

  return records.filter((record, index) => {
    const groupKey = getGroupKey(record);
    return groupKey?.kind !== "browser-benchmark" || keptBrowserIndexes.has(index);
  });
}

async function readHistoryRecords(paths) {
  const records = [];

  for (const path of paths) {
    const content = await readHistoryFile(path);
    if (content === undefined) {
      continue;
    }

    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.trim() === "") {
        return;
      }

      try {
        records.push(JSON.parse(line));
      } catch {
        throw new Error(`Invalid benchmark history JSON at ${path}:${index + 1}`);
      }
    });
  }

  return records;
}

async function readHistoryFile(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

function createSummaryGroups(records) {
  const groups = new Map();

  for (const record of records) {
    const groupKey = getGroupKey(record);
    if (groupKey === undefined) {
      continue;
    }

    const group = groups.get(groupKey.key) ?? {
      kind: groupKey.kind,
      ...(groupKey.scenario === undefined ? {} : { scenario: groupKey.scenario }),
      ...(groupKey.environment === undefined ? {} : { environment: groupKey.environment }),
      recordCount: 0,
      metrics: {},
      metricValues: new Map(),
    };

    group.recordCount += 1;
    collectMetricValues(group.metricValues, record, groupKey);
    groups.set(groupKey.key, group);

    for (const taskGroupKey of getJsdomTaskGroupKeys(record)) {
      const taskGroup = groups.get(taskGroupKey.key) ?? {
        kind: taskGroupKey.kind,
        environment: taskGroupKey.environment,
        task: taskGroupKey.task,
        recordCount: 0,
        metrics: {},
        metricValues: new Map(),
      };

      taskGroup.recordCount += 1;
      collectJsdomTaskMetricValues(taskGroup.metricValues, taskGroupKey.taskRecord);
      groups.set(taskGroupKey.key, taskGroup);
    }
  }

  return [...groups.values()].map((group) => {
    const metrics = {};
    for (const [metric, values] of group.metricValues.entries()) {
      metrics[metric] = summarizeValues(values);
    }

    return {
      kind: group.kind,
      ...(group.scenario === undefined ? {} : { scenario: group.scenario }),
      ...(group.environment === undefined ? {} : { environment: group.environment }),
      ...(group.task === undefined ? {} : { task: group.task }),
      recordCount: group.recordCount,
      metrics,
    };
  });
}

function getGroupKey(record) {
  if (record?.kind === "browser-benchmark" && typeof record.summary?.scenario === "string") {
    return {
      key: `browser-benchmark:${record.summary.scenario}`,
      kind: "browser-benchmark",
      scenario: record.summary.scenario,
    };
  }

  if (
    record?.kind === "jsdom-benchmark" &&
    typeof record.metadata?.benchmarkEnvironment === "string"
  ) {
    return {
      key: `jsdom-benchmark:${record.metadata.benchmarkEnvironment}`,
      kind: "jsdom-benchmark",
      environment: record.metadata.benchmarkEnvironment,
    };
  }

  return undefined;
}

function getJsdomTaskGroupKeys(record) {
  if (
    record?.kind !== "jsdom-benchmark" ||
    typeof record.metadata?.benchmarkEnvironment !== "string" ||
    !Array.isArray(record.summary?.tasks)
  ) {
    return [];
  }

  return record.summary.tasks
    .filter((task) => typeof task?.name === "string")
    .map((task) => ({
      key: `jsdom-benchmark:${record.metadata.benchmarkEnvironment}:${task.name}`,
      kind: "jsdom-benchmark",
      environment: record.metadata.benchmarkEnvironment,
      task: task.name,
      taskRecord: task,
    }));
}

function collectMetricValues(metricValues, record, groupKey) {
  if (groupKey?.kind !== "browser-benchmark" || record?.kind !== "browser-benchmark") {
    return;
  }

  for (const metric of numericBrowserMetrics) {
    const value = record.summary?.[metric];
    if (!Number.isFinite(value)) {
      continue;
    }

    const values = metricValues.get(metric) ?? [];
    values.push(value);
    metricValues.set(metric, values);
  }
}

function collectJsdomTaskMetricValues(metricValues, task) {
  if (task === undefined || typeof task !== "object" || task.metrics === undefined) {
    return;
  }

  for (const [metric, value] of Object.entries(task.metrics)) {
    if (!Number.isFinite(value)) {
      continue;
    }

    const values = metricValues.get(metric) ?? [];
    values.push(value);
    metricValues.set(metric, values);
  }
}

function summarizeValues(values) {
  return {
    count: values.length,
    median: median(values),
    p95: percentile(values, 0.95),
    variance: variance(values),
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values, percentileValue) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(percentileValue * sorted.length) - 1;

  return sorted[Math.max(0, index)];
}

function variance(values) {
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  return (
    values.reduce((total, value) => total + (value - mean) * (value - mean), 0) / values.length
  );
}

function printTextSummary(summary) {
  console.log(`benchmark history records: ${summary.recordCount}`);

  for (const group of summary.groups) {
    const label = [group.kind, group.scenario ?? group.environment, group.task]
      .filter(Boolean)
      .join(" ");
    console.log(`${label}: ${group.recordCount} record(s)`);

    for (const [metric, value] of Object.entries(group.metrics)) {
      console.log(
        `  ${metric}: median=${value.median} p95=${value.p95} variance=${value.variance}`,
      );
    }
  }
}
