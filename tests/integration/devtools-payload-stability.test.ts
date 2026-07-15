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

    for (const event of events) {
      expect(Object.keys(event).sort()).toEqual(allowedKeysByType[event.type].sort());
      expect(JSON.parse(JSON.stringify(event))).toEqual(event);

      for (const [key, value] of Object.entries(event)) {
        if (key === "type") {
          continue;
        }

        expect(typeof value).not.toBe("object");
        expect(typeof value).not.toBe("function");
      }
    }
  });
});
