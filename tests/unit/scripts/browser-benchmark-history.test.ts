import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  appendBrowserBenchmarkHistory,
  parseBrowserBenchmarkHistoryPath,
  parseBrowserBenchmarkSampleSize,
  type BrowserBenchmarkHistorySummary,
} from "../../e2e/browser-benchmark-history";

const summary: BrowserBenchmarkHistorySummary = {
  scenario: "large-list",
  rows: 10_000,
  initialRenderMs: 1,
  updateMs: 1,
  unmountMs: 1,
  selectedText: "Row 5000 selected",
  remainingNodesAfterUnmount: 0,
  metadata: {
    packageName: "@italone/solace",
    packageVersion: "0.0.0",
    node: process.version,
    platform: "darwin",
    release: "test",
    arch: "arm64",
    cpuModel: "test",
    logicalCpuCount: 1,
    totalMemoryBytes: 1,
    browserName: "chromium",
    browserVersion: "test",
    projectName: "chromium",
    sampleSize: 1,
    runAt: "2026-07-15T00:00:00.000Z",
  },
};

describe("browser benchmark history", () => {
  test("parses an optional history path", () => {
    expect(parseBrowserBenchmarkHistoryPath({})).toBeUndefined();
    expect(
      parseBrowserBenchmarkHistoryPath({
        SOLACE_BROWSER_BENCHMARK_HISTORY_PATH: ".benchmark-history/browser.jsonl",
      }),
    ).toBe(".benchmark-history/browser.jsonl");
  });

  test("rejects empty history paths", () => {
    expect(() =>
      parseBrowserBenchmarkHistoryPath({
        SOLACE_BROWSER_BENCHMARK_HISTORY_PATH: "   ",
      }),
    ).toThrow("SOLACE_BROWSER_BENCHMARK_HISTORY_PATH must not be empty");
  });

  test("parses browser benchmark sample size", () => {
    expect(parseBrowserBenchmarkSampleSize({})).toBe(1);
    expect(
      parseBrowserBenchmarkSampleSize({
        SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE: "",
      }),
    ).toBe(1);
    expect(
      parseBrowserBenchmarkSampleSize({
        SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE: "3",
      }),
    ).toBe(3);
  });

  test("rejects invalid browser benchmark sample sizes", () => {
    for (const value of ["0", "-1", "1.5", "not-a-number"]) {
      expect(() =>
        parseBrowserBenchmarkSampleSize({
          SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE: value,
        }),
      ).toThrow("SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE must be a positive integer");
    }
  });

  test("appends a browser benchmark history record", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "solace-browser-benchmark-history-"));
    const historyPath = join(tempDir, "nested", "browser.jsonl");

    try {
      await appendBrowserBenchmarkHistory(historyPath, summary);

      const [line] = (await readFile(historyPath, "utf8")).trim().split("\n");
      const record = JSON.parse(line) as {
        kind: string;
        status: string;
        sampleCount: number;
        summary: BrowserBenchmarkHistorySummary;
      };

      expect(record.kind).toBe("browser-benchmark");
      expect(record.status).toBe("passed");
      expect(record.sampleCount).toBe(1);
      expect(record.summary.metadata.browserName).toBe("chromium");
      expect(record.summary.metadata.sampleSize).toBe(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
