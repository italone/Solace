import { Bench } from "tinybench";
import { describe, expect, it } from "vitest";

import { reportBenchmark } from "./benchmark-report";
import { h, render } from "../../src/index";

function makeComponent(index: number) {
  return () => h("span", { class: "item" }, `component ${index}`);
}

describe("render benchmark", () => {
  it("measures initial render of 1000 components", async () => {
    const components = Array.from({ length: 1000 }, (_, index) =>
      h(makeComponent(index), { key: index }),
    );
    const bench = new Bench({ iterations: 1, time: 20, warmup: false });

    bench.add("1000 component initial render", () => {
      const container = document.createElement("div");
      render(h("div", null, components), container);
      expect(container.querySelectorAll(".item")).toHaveLength(1000);
    });

    await bench.run();
    reportBenchmark(bench, import.meta.url);

    const result = bench.tasks[0].result;
    expect(result.state).toBe("completed");
    if (result.state === "completed") {
      expect(result.latency.mean).toBeGreaterThan(0);
    }
  });
});
