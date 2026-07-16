import { readFile } from "node:fs/promises";

const defaultHistoryPaths = [".benchmark-history/jsdom.jsonl", ".benchmark-history/browser.jsonl"];
const numericBrowserMetrics = ["initialRenderMs", "updateMs", "unmountMs"];
const isCli = process.argv[1] === new URL(import.meta.url).pathname;

if (isCli) {
  try {
    const { json, paths } = parseArgs(process.argv.slice(2));
    const summary = await summarizeBenchmarkHistory(paths);

    if (json) {
      console.log(JSON.stringify(summary));
    } else {
      printTextSummary(summary);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

export function parseArgs(args) {
  const json = args.includes("--json");
  const paths = args.filter((arg) => arg !== "--json" && arg !== "--");

  return {
    json,
    paths: paths.length === 0 ? defaultHistoryPaths : paths,
  };
}

export async function summarizeBenchmarkHistory(paths) {
  const records = await readHistoryRecords(paths);
  const groups = createSummaryGroups(records);

  return {
    recordCount: records.length,
    groups,
  };
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
    collectMetricValues(group.metricValues, record);
    groups.set(groupKey.key, group);
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

function collectMetricValues(metricValues, record) {
  if (record?.kind !== "browser-benchmark") {
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
    const label = [group.kind, group.scenario ?? group.environment].filter(Boolean).join(" ");
    console.log(`${label}: ${group.recordCount} record(s)`);

    for (const [metric, value] of Object.entries(group.metrics)) {
      console.log(
        `  ${metric}: median=${value.median} p95=${value.p95} variance=${value.variance}`,
      );
    }
  }
}
