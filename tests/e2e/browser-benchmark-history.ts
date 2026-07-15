import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type BrowserBenchmarkHistoryResult = {
  scenario: "large-list";
  rows: number;
  initialRenderMs: number;
  updateMs: number;
  unmountMs: number;
  selectedText: string;
  remainingNodesAfterUnmount: number;
};

export type BrowserBenchmarkHistoryMetadata = {
  packageName: string;
  packageVersion: string;
  node: string;
  platform: string;
  release: string;
  arch: string;
  cpuModel: string;
  logicalCpuCount: number;
  totalMemoryBytes: number;
  browserName: string;
  browserVersion: string;
  projectName: string;
  sampleSize: number;
  runAt: string;
};

export type BrowserBenchmarkHistorySummary = BrowserBenchmarkHistoryResult & {
  metadata: BrowserBenchmarkHistoryMetadata;
};

type BrowserBenchmarkHistoryRecord = {
  kind: "browser-benchmark";
  status: "passed";
  sampleCount: number;
  summary: BrowserBenchmarkHistorySummary;
};

export function parseBrowserBenchmarkHistoryPath(env: {
  SOLACE_BROWSER_BENCHMARK_HISTORY_PATH?: string;
}): string | undefined {
  const rawValue = env.SOLACE_BROWSER_BENCHMARK_HISTORY_PATH;
  if (rawValue === undefined) {
    return undefined;
  }

  if (rawValue.trim() === "") {
    throw new Error("SOLACE_BROWSER_BENCHMARK_HISTORY_PATH must not be empty");
  }

  return rawValue;
}

export async function appendBrowserBenchmarkHistory(
  historyPath: string,
  summary: BrowserBenchmarkHistorySummary,
): Promise<void> {
  const record: BrowserBenchmarkHistoryRecord = {
    kind: "browser-benchmark",
    status: "passed",
    sampleCount: summary.metadata.sampleSize,
    summary,
  };
  const resolvedHistoryPath = resolve(historyPath);

  await mkdir(dirname(resolvedHistoryPath), { recursive: true });
  await appendFile(resolvedHistoryPath, `${JSON.stringify(record)}\n`, "utf8");
}
