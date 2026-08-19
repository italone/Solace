import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { evaluatePerformanceRegression } from "../../../scripts/performance-regression-check.mjs";

const runs = (count = 5, dates = 5) =>
  Array.from({ length: count }, (_, index) => ({
    kind: "browser-benchmark",
    status: "passed",
    metadata: { runAt: `2026-08-${String(10 + (index % dates)).padStart(2, "0")}T00:00:00.000Z` },
    summary: { scenario: "large-list", initialRenderMs: 10, updateMs: 20, unmountMs: 2 },
  }));

const jsdomRuns = (count = 5, dates = 5, latencyMeanMs = 10) =>
  Array.from({ length: count }, (_, index) => ({
    kind: "jsdom-benchmark",
    status: "passed",
    metadata: { runAt: `2026-08-${String(10 + (index % dates)).padStart(2, "0")}T00:00:00.000Z` },
    summary: {
      tasks: [{ name: "render", metrics: { latencyMeanMs, latencyP99Ms: latencyMeanMs } }],
    },
  }));

const budgets = {
  schemaVersion: 1,
  minimumDistinctRuns: 5,
  minimumDistinctDates: 2,
  browser: { "large-list": { initialRenderMs: 100, updateMs: 100, unmountMs: 100 } },
  jsdom: { render: { latencyMeanMs: 100, latencyP99Ms: 100 } },
};

describe("performance regression evaluator", () => {
  it("keeps the beta regression and 1.0 evidence date thresholds separate", () => {
    const releaseBudgets = JSON.parse(
      readFileSync(resolve(process.cwd(), "release/performance-budgets.json"), "utf8"),
    ) as { minimumDistinctDates: number };
    const oneZeroEvidence = JSON.parse(
      readFileSync(resolve(process.cwd(), "release/one-zero-readiness.json"), "utf8"),
    ) as { performance: { minimumDistinctDates: number } };

    expect(releaseBudgets.minimumDistinctDates).toBe(2);
    expect(oneZeroEvidence.performance.minimumDistinctDates).toBe(5);
  });

  it("accepts complete histories under budget", () => {
    expect(
      evaluatePerformanceRegression({ budgets, browserRecords: runs(), jsdomRecords: jsdomRuns() })
        .valid,
    ).toBe(true);
  });

  it("rejects missing scenarios and malformed budgets", () => {
    const result = evaluatePerformanceRegression({
      budgets: { ...budgets, schemaVersion: 2, browser: {} },
      browserRecords: [],
      jsdomRecords: [],
    });
    expect(result.errors.join(" ")).toContain("schemaVersion");
    expect(result.errors.join(" ")).toContain("browser budgets");
  });

  it("rejects an over-budget browser metric", () => {
    const result = evaluatePerformanceRegression({
      budgets,
      browserRecords: runs().map((record) => ({
        ...record,
        summary: { ...record.summary, updateMs: 101 },
      })),
      jsdomRecords: jsdomRuns(),
    });
    expect(result.errors.join(" ")).toContain("browser:large-list.updateMs");
  });

  it("rejects an over-budget jsdom metric", () => {
    const result = evaluatePerformanceRegression({
      budgets,
      browserRecords: runs(),
      jsdomRecords: jsdomRuns(5, 5, 101),
    });
    expect(result.errors.join(" ")).toContain("jsdom:render.latencyMeanMs");
  });

  it("rejects histories below the configured distinct-date threshold", () => {
    const result = evaluatePerformanceRegression({
      budgets,
      browserRecords: runs(5, 1),
      jsdomRecords: jsdomRuns(5, 1),
    });
    expect(result.errors.join(" ")).toContain("1/2 distinct dates");
  });
});
