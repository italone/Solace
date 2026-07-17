import { Bench } from "tinybench";
import { describe, expect, it } from "vitest";

import { reportBenchmark } from "./benchmark-report";
import { h, nextTick, reactive, render } from "../../src/index";

const itemCount = 1000;

describe("component update benchmark", () => {
  it("measures batched reactive updates across many components", async () => {
    const bench = new Bench({ iterations: 1, time: 20, warmup: false });

    bench.add("1000 component batched reactive update", async () => {
      const state = reactive({ count: 0 });
      const container = document.createElement("div");
      const Counter = (props: { index: number }) => () =>
        h("span", { "data-index": props.index }, `item ${props.index}: ${state.count}`);
      const App = () =>
        h(
          "div",
          null,
          Array.from({ length: itemCount }, (_, index) => h(Counter, { key: index, index })),
        );

      render(h(App), container);
      expect(container.querySelectorAll("span")).toHaveLength(itemCount);

      state.count = 1;
      state.count = 2;
      state.count = 3;

      await nextTick();

      expect(container.querySelector('[data-index="0"]')?.textContent).toBe("item 0: 3");
      expect(container.querySelector(`[data-index="${itemCount - 1}"]`)?.textContent).toBe(
        `item ${itemCount - 1}: 3`,
      );
    });

    bench.add("1000 stable child components parent update", async () => {
      const state = reactive({ count: 0 });
      const container = document.createElement("div");
      const Child = (props: { index: number }) => () =>
        h("span", { "data-index": props.index }, `child ${props.index}`);
      const App = () => () =>
        h("div", null, [
          h("p", { "data-parent": "count" }, `parent: ${state.count}`),
          ...Array.from({ length: itemCount }, (_, index) => h(Child, { key: index, index })),
        ]);

      render(h(App), container);
      expect(container.querySelectorAll("span")).toHaveLength(itemCount);

      state.count = 1;
      state.count = 2;
      state.count = 3;

      await nextTick();

      expect(container.querySelector("[data-parent='count']")?.textContent).toBe("parent: 3");
      expect(container.querySelector(`[data-index="${itemCount - 1}"]`)?.textContent).toBe(
        `child ${itemCount - 1}`,
      );
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
