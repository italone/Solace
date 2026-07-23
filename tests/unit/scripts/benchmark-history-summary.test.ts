import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);

type BenchmarkHistorySummary = {
  recordCount: number;
  groups: Array<{
    kind: string;
    scenario?: string;
    environment?: string;
    task?: string;
    recordCount: number;
    metrics: Record<string, { count: number; median: number; p95: number; variance: number }>;
  }>;
};

describe("benchmark history summary CLI", () => {
  test("prints help for available benchmark history options", async () => {
    const { stdout, stderr } = await execFileAsync("node", [
      "scripts/summarize-benchmark-history.mjs",
      "--help",
    ]);

    expect(stderr).toBe("");
    expect(stdout).toContain("Usage: pnpm benchmark:history -- [options] [history-path...]");
    expect(stdout).toContain("--json");
    expect(stdout).toContain("--min-browser-count <count>");
    expect(stdout).toContain("--latest-browser-count <count>");
  });

  test("summarizes browser timing metrics and jsdom record counts", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "solace-history-summary-"));
    const historyPath = join(tempDir, "history.jsonl");
    await writeFile(
      historyPath,
      [
        JSON.stringify(createBrowserRecord({ initialRenderMs: 10, updateMs: 4, unmountMs: 1 })),
        JSON.stringify(createBrowserRecord({ initialRenderMs: 14, updateMs: 6, unmountMs: 3 })),
        JSON.stringify(createBrowserRecord({ initialRenderMs: 12, updateMs: 8, unmountMs: 5 })),
        JSON.stringify(createJsdomRecord()),
        "",
      ].join("\n"),
      "utf8",
    );

    const { stdout } = await execFileAsync("node", [
      "scripts/summarize-benchmark-history.mjs",
      "--json",
      historyPath,
    ]);
    const summary = JSON.parse(stdout) as BenchmarkHistorySummary;
    const browserGroup = summary.groups.find((group) => group.kind === "browser-benchmark");
    const jsdomGroup = summary.groups.find((group) => group.kind === "jsdom-benchmark");

    expect(summary.recordCount).toBe(4);
    expect(browserGroup).toMatchObject({
      scenario: "large-list",
      recordCount: 3,
    });
    expect(browserGroup?.metrics.initialRenderMs).toEqual({
      count: 3,
      median: 12,
      p95: 14,
      variance: 8 / 3,
    });
    expect(browserGroup?.metrics.updateMs).toMatchObject({
      count: 3,
      median: 6,
      p95: 8,
    });
    expect(jsdomGroup).toMatchObject({
      environment: "jsdom",
      recordCount: 1,
      metrics: {},
    });
  });

  test("summarizes keyed reorder browser timing metrics separately by scenario", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "solace-history-summary-keyed-reorder-"));
    const historyPath = join(tempDir, "history.jsonl");
    await writeFile(
      historyPath,
      [
        JSON.stringify(
          createBrowserRecord({
            scenario: "large-list",
            initialRenderMs: 10,
            updateMs: 4,
            unmountMs: 1,
          }),
        ),
        JSON.stringify(
          createBrowserRecord({
            scenario: "keyed-reorder",
            initialRenderMs: 10,
            reorderMs: 7 - Math.sqrt(15),
            unmountMs: 1,
          }),
        ),
        JSON.stringify(
          createBrowserRecord({
            scenario: "keyed-reorder",
            initialRenderMs: 12,
            reorderMs: 6,
            unmountMs: 3,
          }),
        ),
        JSON.stringify(
          createBrowserRecord({
            scenario: "keyed-reorder",
            initialRenderMs: 14,
            reorderMs: 8,
            unmountMs: 5,
          }),
        ),
        "",
      ].join("\n"),
      "utf8",
    );

    const { stdout } = await execFileAsync("node", [
      "scripts/summarize-benchmark-history.mjs",
      "--json",
      historyPath,
    ]);
    const summary = JSON.parse(stdout) as BenchmarkHistorySummary;
    const keyedReorderGroup = summary.groups.find(
      (group) => group.kind === "browser-benchmark" && group.scenario === "keyed-reorder",
    );

    expect(keyedReorderGroup).toMatchObject({
      scenario: "keyed-reorder",
      recordCount: 3,
    });
    expect(keyedReorderGroup?.metrics.reorderMs).toEqual({
      count: 3,
      median: 6,
      p95: 8,
      variance: 4,
    });
  });

  test("groups keyed-reorder browser records by shape", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "solace-history-summary-keyed-reorder-shape-"));
    const historyPath = join(tempDir, "history.jsonl");
    await writeFile(
      historyPath,
      [
        JSON.stringify(createBrowserRecord({ initialRenderMs: 10, updateMs: 4, unmountMs: 1 })),
        JSON.stringify(
          createBrowserRecord({
            scenario: "keyed-reorder",
            shape: "reverse",
            initialRenderMs: 10,
            reorderMs: 5,
            unmountMs: 1,
          }),
        ),
        JSON.stringify(
          createBrowserRecord({
            scenario: "keyed-reorder",
            shape: "reverse",
            initialRenderMs: 12,
            reorderMs: 7,
            unmountMs: 3,
          }),
        ),
        JSON.stringify(
          createBrowserRecord({
            scenario: "keyed-reorder",
            shape: "sorted",
            initialRenderMs: 20,
            reorderMs: 4,
            unmountMs: 1,
          }),
        ),
        JSON.stringify(
          createBrowserRecord({
            scenario: "keyed-reorder",
            shape: "sorted",
            initialRenderMs: 22,
            reorderMs: 8,
            unmountMs: 2,
          }),
        ),
        "",
      ].join("\n"),
      "utf8",
    );

    const { stdout } = await execFileAsync("node", [
      "scripts/summarize-benchmark-history.mjs",
      "--json",
      historyPath,
    ]);
    const summary = JSON.parse(stdout) as BenchmarkHistorySummary;
    const reverseGroup = summary.groups.find(
      (group) => group.kind === "browser-benchmark" && group.scenario === "keyed-reorder:reverse",
    );
    const sortedGroup = summary.groups.find(
      (group) => group.kind === "browser-benchmark" && group.scenario === "keyed-reorder:sorted",
    );

    expect(reverseGroup).toMatchObject({
      scenario: "keyed-reorder:reverse",
      recordCount: 2,
    });
    expect(reverseGroup?.metrics.reorderMs).toEqual({
      count: 2,
      median: 6,
      p95: 7,
      variance: 1,
    });
    expect(sortedGroup).toMatchObject({
      scenario: "keyed-reorder:sorted",
      recordCount: 2,
    });
    expect(sortedGroup?.metrics.reorderMs).toEqual({
      count: 2,
      median: 6,
      p95: 8,
      variance: 4,
    });
  });

  test("summarizes jsdom task timing metrics", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "solace-history-summary-jsdom-metrics-"));
    const historyPath = join(tempDir, "history.jsonl");
    await writeFile(
      historyPath,
      [
        JSON.stringify(
          createJsdomRecord({
            tasks: [
              {
                name: "10000 row local text update",
                file: "tests/performance/list-diff.bench.ts",
                metrics: {
                  latencyMeanMs: 4,
                  latencyP99Ms: 6,
                  throughputMeanOpsPerSec: 250,
                },
              },
            ],
          }),
        ),
        JSON.stringify(
          createJsdomRecord({
            tasks: [
              {
                name: "10000 row local text update",
                file: "tests/performance/list-diff.bench.ts",
                metrics: {
                  latencyMeanMs: 8,
                  latencyP99Ms: 10,
                  throughputMeanOpsPerSec: 125,
                },
              },
            ],
          }),
        ),
        "",
      ].join("\n"),
      "utf8",
    );

    const { stdout } = await execFileAsync("node", [
      "scripts/summarize-benchmark-history.mjs",
      "--json",
      historyPath,
    ]);
    const summary = JSON.parse(stdout) as BenchmarkHistorySummary;
    const jsdomTaskGroup = summary.groups.find(
      (group) => group.kind === "jsdom-benchmark" && group.task === "10000 row local text update",
    );

    expect(summary.recordCount).toBe(2);
    expect(jsdomTaskGroup).toMatchObject({
      environment: "jsdom",
      task: "10000 row local text update",
      recordCount: 2,
    });
    expect(jsdomTaskGroup?.metrics.latencyMeanMs).toEqual({
      count: 2,
      median: 6,
      p95: 8,
      variance: 4,
    });
    expect(jsdomTaskGroup?.metrics.latencyP99Ms).toMatchObject({
      count: 2,
      median: 8,
      p95: 10,
    });
    expect(jsdomTaskGroup?.metrics.throughputMeanOpsPerSec).toMatchObject({
      count: 2,
      median: 187.5,
      p95: 250,
    });
  });

  test("returns an empty summary for missing files", async () => {
    const { stdout } = await execFileAsync("node", [
      "scripts/summarize-benchmark-history.mjs",
      "--json",
      join(tmpdir(), "missing-solace-history.jsonl"),
    ]);
    const summary = JSON.parse(stdout) as BenchmarkHistorySummary;

    expect(summary).toEqual({
      recordCount: 0,
      groups: [],
    });
  });

  test("reports malformed JSONL with file and line", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "solace-history-summary-bad-"));
    const historyPath = join(tempDir, "bad.jsonl");
    await writeFile(historyPath, `${JSON.stringify(createJsdomRecord())}\n{bad-json}\n`, "utf8");

    await expect(
      execFileAsync("node", ["scripts/summarize-benchmark-history.mjs", "--json", historyPath]),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(`Invalid benchmark history JSON at ${historyPath}:2`),
    });
  });

  test("accepts browser groups that meet the configured minimum record count", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "solace-history-summary-min-"));
    const historyPath = join(tempDir, "history.jsonl");
    await writeFile(
      historyPath,
      [
        JSON.stringify(createBrowserRecord({ initialRenderMs: 10, updateMs: 4, unmountMs: 1 })),
        JSON.stringify(createBrowserRecord({ initialRenderMs: 12, updateMs: 6, unmountMs: 3 })),
        "",
      ].join("\n"),
      "utf8",
    );

    const { stdout } = await execFileAsync("node", [
      "scripts/summarize-benchmark-history.mjs",
      "--json",
      "--min-browser-count",
      "2",
      historyPath,
    ]);
    const summary = JSON.parse(stdout) as BenchmarkHistorySummary;

    expect(summary.groups.find((group) => group.kind === "browser-benchmark")).toMatchObject({
      recordCount: 2,
    });
  });

  test("summarizes only the latest browser records when configured", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "solace-history-summary-latest-"));
    const historyPath = join(tempDir, "history.jsonl");
    await writeFile(
      historyPath,
      [
        JSON.stringify(createBrowserRecord({ initialRenderMs: 100, updateMs: 20, unmountMs: 8 })),
        JSON.stringify(createBrowserRecord({ initialRenderMs: 10, updateMs: 4, unmountMs: 1 })),
        JSON.stringify(createBrowserRecord({ initialRenderMs: 12, updateMs: 6, unmountMs: 3 })),
        JSON.stringify(createJsdomRecord()),
        "",
      ].join("\n"),
      "utf8",
    );

    const { stdout } = await execFileAsync("node", [
      "scripts/summarize-benchmark-history.mjs",
      "--json",
      "--latest-browser-count",
      "2",
      historyPath,
    ]);
    const summary = JSON.parse(stdout) as BenchmarkHistorySummary;
    const browserGroup = summary.groups.find((group) => group.kind === "browser-benchmark");
    const jsdomGroup = summary.groups.find((group) => group.kind === "jsdom-benchmark");

    expect(summary.recordCount).toBe(3);
    expect(browserGroup).toMatchObject({
      scenario: "large-list",
      recordCount: 2,
    });
    expect(browserGroup?.metrics.initialRenderMs).toEqual({
      count: 2,
      median: 11,
      p95: 12,
      variance: 1,
    });
    expect(browserGroup?.metrics.updateMs).toMatchObject({
      count: 2,
      median: 5,
      p95: 6,
    });
    expect(jsdomGroup).toMatchObject({
      environment: "jsdom",
      recordCount: 1,
    });
  });

  test("fails when browser benchmark groups are below the configured minimum record count", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "solace-history-summary-low-"));
    const historyPath = join(tempDir, "history.jsonl");
    await writeFile(
      historyPath,
      `${JSON.stringify(createBrowserRecord({ initialRenderMs: 10, updateMs: 4, unmountMs: 1 }))}\n`,
      "utf8",
    );

    await expect(
      execFileAsync("node", [
        "scripts/summarize-benchmark-history.mjs",
        "--json",
        "--min-browser-count",
        "2",
        historyPath,
      ]),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "Browser benchmark large-list has 1 record(s), below required 2",
      ),
    });
  });

  test("rejects invalid minimum browser record counts", async () => {
    await expect(
      execFileAsync("node", [
        "scripts/summarize-benchmark-history.mjs",
        "--min-browser-count",
        "0",
      ]),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("--min-browser-count must be a positive integer"),
    });
  });

  test("rejects invalid latest browser record counts", async () => {
    await expect(
      execFileAsync("node", [
        "scripts/summarize-benchmark-history.mjs",
        "--latest-browser-count",
        "0",
      ]),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("--latest-browser-count must be a positive integer"),
    });
  });
});

type BrowserRecordOptions =
  | {
      scenario?: "large-list";
      initialRenderMs: number;
      updateMs: number;
      unmountMs: number;
    }
  | {
      scenario: "keyed-reorder";
      shape?: string;
      initialRenderMs: number;
      reorderMs: number;
      unmountMs: number;
    };

function createBrowserRecord(options: BrowserRecordOptions) {
  const scenario = options.scenario ?? "large-list";

  return {
    kind: "browser-benchmark",
    status: "passed",
    sampleCount: 1,
    summary: {
      scenario,
      rows: 10_000,
      ...options,
      ...(scenario === "large-list"
        ? { selectedText: "Row 5000 selected" }
        : { firstRowText: "Row 10000" }),
      remainingNodesAfterUnmount: 0,
      metadata: {
        browserName: "chromium",
        sampleSize: 1,
      },
    },
  };
}

function createJsdomRecord(options?: {
  tasks?: Array<{
    name: string;
    file: string;
    metrics: Record<string, number>;
  }>;
}) {
  return {
    kind: "jsdom-benchmark",
    status: "passed",
    sampleCount: 1,
    metadata: {
      benchmarkEnvironment: "jsdom",
      sampleSize: 1,
    },
    command: "pnpm",
    args: ["exec", "vitest", "run", "--config", "vitest.benchmark.config.ts"],
    ...(options?.tasks === undefined ? {} : { summary: { tasks: options.tasks } }),
  };
}
