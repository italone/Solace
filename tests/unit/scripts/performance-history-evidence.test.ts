import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createPerformanceHistoryEvidence } from "../../../scripts/performance-history-evidence-config.mjs";

function browserRecord({
  runAt,
  scenario = "large-list",
  shape,
}: {
  runAt: string;
  scenario?: string;
  shape?: string;
}) {
  return {
    kind: "browser-benchmark",
    status: "passed",
    summary: {
      scenario,
      ...(shape === undefined ? {} : { shape }),
      metadata: { runAt },
    },
  };
}

function jsdomRecord(runAt: string, tasks = ["render", "list-diff"]) {
  return {
    kind: "jsdom-benchmark",
    status: "passed",
    metadata: { benchmarkEnvironment: "jsdom", runAt },
    summary: { tasks: tasks.map((name) => ({ name, metrics: {} })) },
  };
}

async function writeJsonLines(path: string, records: unknown[]) {
  await writeFile(path, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
}

describe("performance history readiness evidence", () => {
  it("summarizes distinct runs and audit dates with stable scenario ordering", async () => {
    const root = await mkdtemp(join(tmpdir(), "solace-performance-evidence-"));
    const browserPath = "browser.jsonl";
    const jsdomPath = "jsdom.jsonl";

    try {
      await writeJsonLines(join(root, browserPath), [
        browserRecord({
          scenario: "keyed-reorder",
          shape: "sorted",
          runAt: "2026-07-17T00:00:00.000Z",
        }),
        browserRecord({ runAt: "2026-07-16T00:00:00.000Z" }),
        browserRecord({ runAt: "2026-07-16T00:00:00.000Z" }),
      ]);
      await writeJsonLines(join(root, jsdomPath), [
        jsdomRecord("2026-07-17T01:00:00.000Z", ["render", "list-diff"]),
        jsdomRecord("2026-07-16T01:00:00.000Z", ["render", "list-diff"]),
      ]);

      const evidence = await createPerformanceHistoryEvidence({ root, browserPath, jsdomPath });

      expect(evidence.schemaVersion).toBe(1);
      expect(evidence.sources.browser).toMatchObject({ path: browserPath, recordCount: 3 });
      expect(evidence.sources.jsdom).toMatchObject({ path: jsdomPath, recordCount: 2 });
      expect(evidence.sources.browser.sha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(Object.keys(evidence.browserScenarios)).toEqual([
        "keyed-reorder:sorted",
        "large-list",
      ]);
      expect(Object.keys(evidence.jsdomScenarios)).toEqual(["list-diff", "render"]);
      expect(evidence.browserScenarios["large-list"]).toEqual({
        recordCount: 2,
        distinctRunCount: 1,
        distinctDateCount: 1,
        firstRunAt: "2026-07-16T00:00:00.000Z",
        lastRunAt: "2026-07-16T00:00:00.000Z",
        runAt: ["2026-07-16T00:00:00.000Z"],
      });
      expect(evidence.jsdomScenarios.render).toEqual({
        recordCount: 2,
        distinctRunCount: 2,
        distinctDateCount: 2,
        firstRunAt: "2026-07-16T01:00:00.000Z",
        lastRunAt: "2026-07-17T01:00:00.000Z",
        runAt: ["2026-07-16T01:00:00.000Z", "2026-07-17T01:00:00.000Z"],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a successful supported record with an invalid runAt timestamp", async () => {
    const root = await mkdtemp(join(tmpdir(), "solace-performance-evidence-time-"));

    try {
      await writeJsonLines(join(root, "browser.jsonl"), [browserRecord({ runAt: "not-a-date" })]);
      await writeJsonLines(join(root, "jsdom.jsonl"), [jsdomRecord("2026-07-16T00:00:00.000Z")]);

      await expect(
        createPerformanceHistoryEvidence({
          root,
          browserPath: "browser.jsonl",
          jsdomPath: "jsdom.jsonl",
        }),
      ).rejects.toThrow("Invalid benchmark runAt at browser.jsonl:1");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a benchmark timestamp later than the injected current time", async () => {
    const root = await mkdtemp(join(tmpdir(), "solace-performance-evidence-future-"));

    try {
      await writeJsonLines(join(root, "browser.jsonl"), [
        browserRecord({ runAt: "2026-08-20T00:00:00.000Z" }),
      ]);
      await writeJsonLines(join(root, "jsdom.jsonl"), [jsdomRecord("2026-08-18T00:00:00.000Z")]);

      await expect(
        createPerformanceHistoryEvidence({
          root,
          browserPath: "browser.jsonl",
          jsdomPath: "jsdom.jsonl",
          now: Date.parse("2026-08-19T00:00:00.000Z"),
        }),
      ).rejects.toThrow("Future benchmark runAt at browser.jsonl:1");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps metadata-only jsdom records in source counts without treating them as task runs", async () => {
    const root = await mkdtemp(join(tmpdir(), "solace-performance-evidence-legacy-"));

    try {
      await writeJsonLines(join(root, "browser.jsonl"), [
        browserRecord({ runAt: "2026-07-16T00:00:00.000Z" }),
      ]);
      await writeJsonLines(join(root, "jsdom.jsonl"), [
        {
          kind: "jsdom-benchmark",
          status: "passed",
          metadata: {
            benchmarkEnvironment: "jsdom",
            runAt: "2026-07-15T00:00:00.000Z",
          },
        },
        jsdomRecord("2026-07-16T00:00:00.000Z", ["render"]),
      ]);

      const evidence = await createPerformanceHistoryEvidence({
        root,
        browserPath: "browser.jsonl",
        jsdomPath: "jsdom.jsonl",
      });

      expect(evidence.sources.jsdom.recordCount).toBe(2);
      expect(evidence.jsdomScenarios.render.distinctRunCount).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports missing and malformed history paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "solace-performance-evidence-input-"));

    try {
      await writeFile(join(root, "bad.jsonl"), "{bad-json}\n", "utf8");
      await expect(
        createPerformanceHistoryEvidence({
          root,
          browserPath: "missing.jsonl",
          jsdomPath: "bad.jsonl",
        }),
      ).rejects.toThrow("Benchmark history file not found: missing.jsonl");

      await writeJsonLines(join(root, "browser.jsonl"), [
        browserRecord({ runAt: "2026-07-16T00:00:00.000Z" }),
      ]);
      await expect(
        createPerformanceHistoryEvidence({
          root,
          browserPath: "browser.jsonl",
          jsdomPath: "bad.jsonl",
        }),
      ).rejects.toThrow("Invalid benchmark history JSON at bad.jsonl:1");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("produces identical evidence for unchanged input", async () => {
    const root = await mkdtemp(join(tmpdir(), "solace-performance-evidence-stable-"));

    try {
      await writeJsonLines(join(root, "browser.jsonl"), [
        browserRecord({ runAt: "2026-07-16T00:00:00.000Z" }),
      ]);
      await writeJsonLines(join(root, "jsdom.jsonl"), [jsdomRecord("2026-07-16T01:00:00.000Z")]);

      const first = await createPerformanceHistoryEvidence({
        root,
        browserPath: "browser.jsonl",
        jsdomPath: "jsdom.jsonl",
      });
      const second = await createPerformanceHistoryEvidence({
        root,
        browserPath: "browser.jsonl",
        jsdomPath: "jsdom.jsonl",
      });

      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
      expect(await readFile(join(root, "browser.jsonl"), "utf8")).toContain("large-list");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
