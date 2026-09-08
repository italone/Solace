import { Bench } from "tinybench";
import { describe, expect, it } from "vitest";

import { reportBenchmark } from "./benchmark-report";
import { h, nextTick, reactive, render } from "../../src/index";

const itemCount = 1000;

describe("component update benchmark", () => {
  it("measures batched reactive updates across many components", async () => {
    const bench = new Bench({ iterations: 10, time: 50, warmup: true, warmupIterations: 3 });

    // Setup is hoisted out of the measured task so each sample measures only
    // the batched mutation + scheduler flush, not mount or cold-start JIT.
    const batchedState = reactive({ count: 0 });
    const batchedContainer = document.createElement("div");
    const Counter = (props: { index: number }) => () =>
      h("span", { "data-index": props.index }, `item ${props.index}: ${batchedState.count}`);
    const BatchedApp = () =>
      h(
        "div",
        null,
        Array.from({ length: itemCount }, (_, index) => h(Counter, { key: index, index })),
      );
    render(h(BatchedApp), batchedContainer);
    expect(batchedContainer.querySelectorAll("span")).toHaveLength(itemCount);
    await nextTick();

    bench.add("1000 component batched reactive update", async () => {
      batchedState.count += 1;
      batchedState.count += 1;
      batchedState.count += 1;
      await nextTick();
    });

    const parentState = reactive({ count: 0 });
    const parentContainer = document.createElement("div");
    const Child = (props: { index: number }) => () =>
      h("span", { "data-index": props.index }, `child ${props.index}`);
    const ParentApp = () => () =>
      h("div", null, [
        h("p", { "data-parent": "count" }, `parent: ${parentState.count}`),
        ...Array.from({ length: itemCount }, (_, index) => h(Child, { key: index, index })),
      ]);
    render(h(ParentApp), parentContainer);
    expect(parentContainer.querySelectorAll("span")).toHaveLength(itemCount);
    await nextTick();

    bench.add("1000 stable child components parent update", async () => {
      parentState.count += 1;
      parentState.count += 1;
      parentState.count += 1;
      await nextTick();
    });

    await bench.run();
    reportBenchmark(bench, import.meta.url);

    expect(batchedContainer.querySelector('[data-index="0"]')?.textContent).toBe(
      `item 0: ${batchedState.count}`,
    );
    expect(batchedContainer.querySelector(`[data-index="${itemCount - 1}"]`)?.textContent).toBe(
      `item ${itemCount - 1}: ${batchedState.count}`,
    );
    expect(parentContainer.querySelector("[data-parent='count']")?.textContent).toBe(
      `parent: ${parentState.count}`,
    );

    const result = bench.tasks[0].result;
    expect(result.state).toBe("completed");
    if (result.state === "completed") {
      expect(result.latency.mean).toBeGreaterThan(0);
    }
  });
});
