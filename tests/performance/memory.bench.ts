import { Bench } from "tinybench";
import { describe, expect, it } from "vitest";

import { h, reactive, render } from "../../src/index";

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

describe("memory benchmark", () => {
  it("observes repeated component mount and unmount", async () => {
    const state = reactive({ count: 0 });
    const Counter = () => () => h("button", null, `count: ${state.count}`);
    const bench = new Bench({ iterations: 1, time: 20, warmup: false });

    bench.add("component mount/unmount loop", () => {
      const container = document.createElement("div");

      for (let index = 0; index < 100; index += 1) {
        render(h(Counter), container);
        render(h("span", null, "gone"), container);
        state.count += 1;
      }

      expect(container.innerHTML).toBe("<span>gone</span>");
    });

    const before = process.memoryUsage().heapUsed;
    await bench.run();
    const after = process.memoryUsage().heapUsed;

    report(bench);
    console.log(`heap delta: ${after - before} bytes`);

    const result = bench.tasks[0].result;
    expect(result.state).toBe("completed");
    if (result.state === "completed") {
      expect(result.latency.mean).toBeGreaterThan(0);
    }
  });
});
