import { afterEach, describe, expect, it } from "vitest";

import { createDevtoolsRecorder } from "../../src/devtools/index";
import { clearDevtoolsListeners, type DevtoolsEvent } from "../../src/devtools/events";
import { h, nextTick, reactive, render } from "../../src/index";

const allowedKeysByType: Record<DevtoolsEvent["type"], string[]> = {
  "component:mount": ["id", "name", "type"],
  "component:update": ["id", "name", "type"],
  "component:unmount": ["id", "name", "type"],
  "component:emit": ["event", "handlerCount", "id", "name", "type"],
  "reactivity:trigger": [
    "effectCount",
    "keyType",
    "runEffects",
    "scheduledEffects",
    "targetType",
    "type",
  ],
  "renderer:element": ["operation", "tag", "type"],
  "scheduler:flush": ["dedupedJobs", "durationMs", "queuedJobs", "type"],
  "store:action": ["durationMs", "name", "status", "type"],
};

describe("devtools large-list recorder smoke", () => {
  afterEach(() => {
    clearDevtoolsListeners();
  });

  it("captures safe serialized summaries for a 10000 row keyed update", async () => {
    const recorder = createDevtoolsRecorder({ limit: 80 });
    const container = document.createElement("div");
    const state = reactive({ selected: 1 });
    const rows = Array.from({ length: 10_000 }, (_, index) => index + 1);
    const LargeList = () => () =>
      h(
        "section",
        null,
        rows.map((row) =>
          h(
            "p",
            {
              key: row,
              class: row === state.selected ? "selected" : "",
              "data-row": String(row),
            },
            row === state.selected ? `Row ${row} selected` : `Row ${row}`,
          ),
        ),
      );

    try {
      render(h(LargeList), container);
      recorder.clear();

      state.selected = 5000;
      await nextTick();

      expect(container.querySelector('[data-row="5000"]')?.textContent).toBe("Row 5000 selected");
      expect(container.querySelector('[data-row="1"]')?.textContent).toBe("Row 1");

      const snapshot = recorder.snapshot();
      expect(snapshot.length).toBeGreaterThan(0);
      expect(snapshot.some((event) => event.type === "scheduler:flush")).toBe(true);
      expect(
        snapshot.some((event) => event.type === "renderer:element" && event.operation === "update"),
      ).toBe(true);

      for (const event of snapshot) {
        expect(Object.keys(event).sort()).toEqual(allowedKeysByType[event.type].sort());
        expect(JSON.parse(JSON.stringify(event))).toEqual(event);

        for (const [key, value] of Object.entries(event)) {
          if (key === "type") {
            continue;
          }
          expect(typeof value).not.toBe("object");
          expect(typeof value).not.toBe("function");
        }

        const serialized = JSON.stringify(event);
        expect(serialized).not.toContain("Row 5000");
        expect(serialized).not.toContain("selected");
        expect(serialized).not.toContain("data-row");
        expect(event).not.toHaveProperty("target");
        expect(event).not.toHaveProperty("node");
        expect(event).not.toHaveProperty("vnode");
        expect(event).not.toHaveProperty("component");
        expect(event).not.toHaveProperty("props");
        expect(event).not.toHaveProperty("state");
        expect(event).not.toHaveProperty("args");
        expect(event).not.toHaveProperty("children");
      }
    } finally {
      recorder.stop();
    }
  });
});
