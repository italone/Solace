import { Bench } from "tinybench";
import { describe, expect, it } from "vitest";

import { reportBenchmark } from "./benchmark-report";
import { Fragment, h, render } from "../../src/index";

const rows = Array.from({ length: 5000 }, (_, index) => index + 1);
const insertedRows = [
  ...rows.slice(0, 2500),
  ...Array.from({ length: 50 }, (_, index) => 5001 + index),
  ...rows.slice(2500),
];

function fragment(items = rows, selected = 1) {
  return h(
    Fragment,
    null,
    items.map((row) =>
      h(
        "span",
        { key: row, "data-row": row },
        selected === row ? `Fragment row ${row} selected` : `Fragment row ${row}`,
      ),
    ),
  );
}

describe("fragment benchmark", () => {
  it("measures Fragment initial render and patch", async () => {
    const bench = new Bench({ iterations: 1, time: 20, warmup: false });

    bench.add("5000 Fragment child initial render", () => {
      const container = document.createElement("div");
      render(fragment(), container);
      expect(container.querySelectorAll("span")).toHaveLength(5000);
      expect(container.querySelector('[data-row="1"]')?.textContent).toBe(
        "Fragment row 1 selected",
      );
    });

    bench.add("5000 Fragment child local text patch", () => {
      const container = document.createElement("div");
      render(fragment(), container);
      const patched = container.querySelector('[data-row="2500"]');
      render(fragment(rows, 2500), container);
      expect(container.querySelector('[data-row="2500"]')).toBe(patched);
      expect(container.querySelector('[data-row="2500"]')?.textContent).toBe(
        "Fragment row 2500 selected",
      );
    });

    bench.add("5000 Fragment child middle insert", () => {
      const container = document.createElement("div");
      render(fragment(), container);
      render(fragment(insertedRows), container);
      expect(container.querySelectorAll("span")).toHaveLength(5050);
      expect(container.querySelector('[data-row="5001"]')?.textContent).toBe("Fragment row 5001");
    });

    await bench.run();
    reportBenchmark(bench, import.meta.url);

    for (const task of bench.tasks) {
      const result = task.result;
      expect(result.state).toBe("completed");
      if (result.state === "completed") {
        expect(result.latency.mean).toBeGreaterThan(0);
      }
    }
  });
});
