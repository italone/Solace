import { Bench } from "tinybench";
import { describe, expect, it } from "vitest";

import { h, render } from "../../src/index";

const rows = Array.from({ length: 10_000 }, (_, index) => index + 1);
const insertedRows = [
  ...rows.slice(0, 5000),
  ...Array.from({ length: 100 }, (_, index) => 10_001 + index),
  ...rows.slice(5000),
];
const removedRows = [...rows.slice(0, 4500), ...rows.slice(4600)];
const movedRows = [rows[rows.length - 1], ...rows.slice(0, rows.length - 1)];

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
