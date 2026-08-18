import { describe, expect, it } from "vitest";

import { evaluatePerformanceRegression } from "../../../scripts/performance-regression-config.mjs";

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
  minimumDistinctDates: 5,
  browser: { "large-list": { initialRenderMs: 100, updateMs: 100, unmountMs: 100 } },
  jsdom: { render: { latencyMeanMs: 100, latencyP99Ms: 100 } },
};

describe("performance regression evaluator", () => {
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

  it("rejects histories with fewer than five distinct dates", () => {
    const result = evaluatePerformanceRegression({
      budgets,
      browserRecords: runs(5, 2),
      jsdomRecords: jsdomRuns(5, 2),
    });
    expect(result.errors.join(" ")).toContain("distinct dates");
  });
});
