import { afterEach, describe, expect, it } from "vitest";

import {
  clearDevtoolsListeners,
  onDevtoolsEvent,
  serializeDevtoolsEvent,
  type DevtoolsEvent,
} from "../../src/devtools/events";
import { createStore, h, nextTick, render } from "../../src/index";
import type { StoreGetterContext } from "../../src/index";

type CounterState = { count: number };

const allowedKeysByType: Record<DevtoolsEvent["type"], string[]> = {
  "component:mount": ["id", "name", "parentId", "type"],
  "component:update": ["id", "name", "parentId", "type"],
  "component:unmount": ["id", "name", "parentId", "type"],
  "component:emit": ["event", "handlerCount", "id", "name", "type"],
  "reactivity:trigger": [
    "correlationId",
    "effectCount",
    "keyType",
    "runEffects",
    "scheduledEffects",
    "targetType",
    "type",
  ],
  "renderer:element": ["operation", "tag", "type"],
  "router:navigation": ["from", "status", "to", "type"],
  "scheduler:flush": [
    "dedupedJobs",
    "distinctCauses",
    "durationMs",
    "queuedJobs",
    "skippedStaleJobs",
    "type",
  ],
  "store:action": ["durationMs", "name", "status", "type"],
};

describe("devtools payload stability", () => {
  afterEach(() => {
    clearDevtoolsListeners();
  });

  it("serializes integrated runtime events without exposing live objects", async () => {
    const events: DevtoolsEvent[] = [];
    const store = createStore({
      state: () => ({ count: 0 }),
      actions: {
        increment({ state }: StoreGetterContext<CounterState>) {
          state.count += 1;
        },
      },
    });
    const container = document.createElement("div");
    const onChange = () => undefined;
    const Counter =
      (_props: { onChange?: () => void }, { emit }: { emit: (event: string) => void }) =>
      () =>
        h("button", { onClick: () => emit("change") }, `count: ${store.state.count}`);

    onDevtoolsEvent((event) => {
      events.push(serializeDevtoolsEvent(event));
    });

    render(h(Counter, { onChange }), container);
    container.querySelector("button")?.click();
    store.actions.increment();
    await nextTick();
    render(h("span", null, "done"), container);

    expect(events.map((event) => event.type)).toEqual([
      "renderer:element",
      "component:mount",
      "component:emit",
      "reactivity:trigger",
      "store:action",
      "renderer:element",
      "component:update",
      "scheduler:flush",
      "renderer:element",
      "component:unmount",
      "renderer:element",
    ]);

    const mountEvents = events.filter(
      (event): event is Extract<DevtoolsEvent, { type: "component:mount" }> =>
        event.type === "component:mount",
    );
    // Root component reports parentId null.
    expect(mountEvents.length).toBeGreaterThanOrEqual(1);
    expect(mountEvents[0]?.parentId).toBeNull();

    for (const event of events) {
      expect(Object.keys(event).sort()).toEqual(allowedKeysByType[event.type].sort());
      expect(JSON.parse(JSON.stringify(event))).toEqual(event);

      for (const [key, value] of Object.entries(event)) {
        if (key === "type") {
          continue;
        }

        // parentId is null for root components; all other payloads are primitives.
        expect(value === null || (typeof value !== "object" && typeof value !== "function")).toBe(
          true,
        );
      }
    }
  });
});
