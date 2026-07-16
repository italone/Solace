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
});

function createBrowserRecord(metrics: {
  initialRenderMs: number;
  updateMs: number;
  unmountMs: number;
}) {
  return {
    kind: "browser-benchmark",
    status: "passed",
    sampleCount: 1,
    summary: {
      scenario: "large-list",
      rows: 10_000,
      ...metrics,
      selectedText: "Row 5000 selected",
      remainingNodesAfterUnmount: 0,
      metadata: {
        browserName: "chromium",
        sampleSize: 1,
      },
    },
  };
}

function createJsdomRecord() {
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
  };
}
