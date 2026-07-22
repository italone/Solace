import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type DomMutationCounts = {
  insertBefore: number;
  setAttribute: number;
  removeAttribute: number;
  textContent: number;
  removeChild: number;
};

export type MovePathCounts = {
  keyedMiddleSegments: number;
  matchedOldChildren: number;
  newChildrenMounted: number;
  removedOldChildren: number;
  lisLength: number;
  stableMoveSkips: number;
  movedExistingChildren: number;
  anchorLookups: number;
};

export type BrowserBenchmarkHistoryResult =
  | {
      scenario: "large-list";
      rows: number;
      initialRenderMs: number;
      updateMs: number;
      unmountMs: number;
      selectedText: string;
      remainingNodesAfterUnmount: number;
    }
  | {
      scenario: "keyed-reorder";
      rows: number;
      initialRenderMs: number;
      reorderMs: number;
      unmountMs: number;
      firstRowText: string;
      remainingNodesAfterUnmount: number;
      domMutationCounts: DomMutationCounts;
      movePathCounts: MovePathCounts;
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

export function parseBrowserBenchmarkSampleSize(env: {
  SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE?: string;
}): number {
  const rawValue = env.SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE;
  if (rawValue === undefined || rawValue === "") {
    return 1;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE must be a positive integer");
  }

  return value;
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
