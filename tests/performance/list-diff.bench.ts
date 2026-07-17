import { Bench } from "tinybench";
import { describe, expect, it } from "vitest";

import { h, render } from "../../src/index";

const rows = Array.from({ length: 10_000 }, (_, index) => index + 1);
const insertedRows = [
  ...rows.slice(0, 5000),
  ...Array.from({ length: 100 }, (_, index) => 10_001 + index),
  ...rows.slice(5000),
];
const unkeyedAppendedRows = [...rows, ...Array.from({ length: 100 }, (_, index) => 10_001 + index)];
const removedRows = [...rows.slice(0, 4500), ...rows.slice(4600)];
const movedRows = [rows[rows.length - 1], ...rows.slice(0, rows.length - 1)];
const mixedInsertMoveRows = [
  ...rows.slice(0, 4999),
  rows[5000],
  10_001,
  rows[4999],
  ...rows.slice(5001),
];
const mixedAdjacentInsertMoveRows = [
  ...rows.slice(0, 4999),
  rows[5001],
  10_001,
  10_002,
  rows[4999],
  rows[5000],
  ...rows.slice(5002),
];
const mixedAdjacentRemoveMoveRows = [
  ...rows.slice(0, 4998),
  rows[5001],
  rows[4998],
  ...rows.slice(5002),
];

function list(selected: number, items = rows) {
  return h(
    "div",
    null,
    items.map((row) =>
      h(
        "p",
        { key: row, "data-row": row },
        selected === row ? `Row ${row} selected` : `Row ${row}`,
      ),
    ),
  );
}

function unkeyedList(selected: number, items = rows) {
  return h(
    "div",
    null,
    items.map((row) => h("p", null, selected === row ? `Row ${row} selected` : `Row ${row}`)),
  );
}

function report(bench: Bench): void {
  for (const task of bench.tasks) {
    const result = task.result;
    if (result.state !== "completed") {
      console.log(`${task.name}: ${result.state}`);
      continue;
    }

    const { latency, throughput } = result;
    console.log(
      `${task.name}: latency mean ${latency.mean.toFixed(3)}ms, p99 ${latency.p99.toFixed(3)}ms, throughput ${throughput.mean.toFixed(2)} ops/sec`,
    );
  }
}

describe("list diff benchmark", () => {
  it("measures 10000 row create, update, delete, and reorder", async () => {
    const bench = new Bench({ iterations: 1, time: 20, warmup: false });

    bench.add("10000 row create", () => {
      const container = document.createElement("div");
      render(list(1), container);
      expect(container.querySelectorAll("p")).toHaveLength(10000);
    });

    bench.add("10000 row text to keyed list", () => {
      const container = document.createElement("div");
      render(h("div", null, "loading"), container);
      render(list(1), container);
      expect(container.querySelectorAll("p")).toHaveLength(10000);
      expect(container.querySelector('[data-row="1"]')?.textContent).toBe("Row 1 selected");
    });

    bench.add("10000 row local text update", () => {
      const container = document.createElement("div");
      render(list(1), container);
      render(list(5000), container);
      expect(container.querySelector('[data-row="5000"]')?.textContent).toBe("Row 5000 selected");
    });

    bench.add("10000 row delete", () => {
      const container = document.createElement("div");
      render(list(1), container);
      render(list(1, rows.slice(0, 9000)), container);
      expect(container.querySelectorAll("p")).toHaveLength(9000);
    });

    bench.add("10000 row keyed middle insert", () => {
      const container = document.createElement("div");
      render(list(1), container);
      render(list(1, insertedRows), container);
      expect(container.querySelectorAll("p")).toHaveLength(10100);
      expect(container.querySelector('[data-row="10001"]')?.textContent).toBe("Row 10001");
    });

    bench.add("10000 row unkeyed tail append", () => {
      const container = document.createElement("div");
      render(unkeyedList(1), container);
      render(unkeyedList(1, unkeyedAppendedRows), container);
      expect(container.querySelectorAll("p")).toHaveLength(10100);
      expect(container.querySelectorAll("p")[10000]?.textContent).toBe("Row 10001");
    });

    bench.add("10000 row unkeyed tail remove", () => {
      const container = document.createElement("div");
      render(unkeyedList(1, unkeyedAppendedRows), container);
      render(unkeyedList(1), container);
      expect(container.querySelectorAll("p")).toHaveLength(10000);
      expect(container.querySelectorAll("p")[9999]?.textContent).toBe("Row 10000");
    });

    bench.add("10000 row keyed middle remove", () => {
      const container = document.createElement("div");
      render(list(1), container);
      render(list(1, removedRows), container);
      expect(container.querySelectorAll("p")).toHaveLength(9900);
      expect(container.querySelector('[data-row="4501"]')).toBeNull();
      expect(container.querySelector('[data-row="4601"]')?.textContent).toBe("Row 4601");
    });

    bench.add("10000 row keyed tail to head move", () => {
      const container = document.createElement("div");
      render(list(1), container);
      const moved = container.querySelector('[data-row="10000"]');
      render(list(1, movedRows), container);
      expect(container.querySelector("p")?.textContent).toBe("Row 10000");
      expect(container.querySelector("p")).toBe(moved);
    });

    bench.add("10000 row keyed mixed insert and move", () => {
      const container = document.createElement("div");
      render(list(1), container);
      const moved = container.querySelector('[data-row="5001"]');
      render(list(1, mixedInsertMoveRows), container);
      expect(container.querySelectorAll("p")).toHaveLength(10001);
      expect(container.querySelectorAll("p")[4999]?.textContent).toBe("Row 5001");
      expect(container.querySelectorAll("p")[4999]).toBe(moved);
      expect(container.querySelectorAll("p")[5000]?.textContent).toBe("Row 10001");
    });

    bench.add("10000 row keyed mixed adjacent insert and move", () => {
      const container = document.createElement("div");
      render(list(1), container);
      const moved = container.querySelector('[data-row="5002"]');
      render(list(1, mixedAdjacentInsertMoveRows), container);
      expect(container.querySelectorAll("p")).toHaveLength(10002);
      expect(container.querySelectorAll("p")[4999]?.textContent).toBe("Row 5002");
      expect(container.querySelectorAll("p")[4999]).toBe(moved);
      expect(container.querySelectorAll("p")[5000]?.textContent).toBe("Row 10001");
      expect(container.querySelectorAll("p")[5001]?.textContent).toBe("Row 10002");
    });

    bench.add("10000 row keyed mixed adjacent remove and move", () => {
      const container = document.createElement("div");
      render(list(1), container);
      const moved = container.querySelector('[data-row="5002"]');
      render(list(1, mixedAdjacentRemoveMoveRows), container);
      expect(container.querySelectorAll("p")).toHaveLength(9998);
      expect(container.querySelectorAll("p")[4998]?.textContent).toBe("Row 5002");
      expect(container.querySelectorAll("p")[4998]).toBe(moved);
      expect(container.querySelector('[data-row="5000"]')).toBeNull();
      expect(container.querySelector('[data-row="5001"]')).toBeNull();
    });

    bench.add("10000 row keyed reorder", () => {
      const container = document.createElement("div");
      render(list(1), container);
      render(list(1, [...rows].reverse()), container);
      expect(container.querySelector("p")?.textContent).toBe("Row 10000");
    });

    await bench.run();
    report(bench);

    for (const task of bench.tasks) {
      const result = task.result;
      expect(result.state).toBe("completed");
      if (result.state === "completed") {
        expect(result.latency.mean).toBeGreaterThan(0);
      }
    }
  });
});
