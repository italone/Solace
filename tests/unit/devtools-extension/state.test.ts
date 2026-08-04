import { describe, expect, it } from "vitest";

import type { DevtoolsEvent } from "@italone/solace/devtools";
import {
  clearTimeline,
  createPanelState,
  filterTimeline,
  getSelectedTimelineRow,
  recordDevtoolsEvent,
  selectTimelineEvent,
  setPanelPaused,
  setRecorderLimit,
  setTimelineFilter,
} from "../../../examples/devtools-extension/src/panel/state";

const componentMount: DevtoolsEvent = {
  type: "component:mount",
  id: 1,
  name: "Counter",
};

describe("devtools extension panel state", () => {
  it("normalizes incoming events into timeline rows with timestamps and compact summaries", () => {
    const state = recordDevtoolsEvent(createPanelState(), componentMount, { now: 10 });

    expect(state.events).toEqual([
      {
        id: "timeline-1",
        timestamp: 10,
        family: "component",
        summary: "Counter #1 mounted",
        event: componentMount,
      },
    ]);
  });

  it("filters timeline rows by event family", () => {
    const events: DevtoolsEvent[] = [
      componentMount,
      {
        type: "scheduler:flush",
        queuedJobs: 2,
        dedupedJobs: 1,
        durationMs: 3,
      },
      {
        type: "component:update",
        id: 1,
        name: "Counter",
      },
      {
        type: "reactivity:trigger",
        targetType: "reactive",
        keyType: "set",
        effectCount: 3,
        scheduledEffects: 2,
        runEffects: 1,
      },
      {
        type: "renderer:element",
        operation: "mount",
        tag: "button",
      },
      {
        type: "store:action",
        name: "increment",
        status: "success",
        durationMs: 4,
      },
    ];
    const state = events.reduce((panelState, event, index) => {
      return recordDevtoolsEvent(panelState, event, { now: index + 1 });
    }, createPanelState());

    expect(
      filterTimeline(state.events, { family: "component" }).map((row) => row.event.type),
    ).toEqual(["component:mount", "component:update"]);
    expect(
      filterTimeline(state.events, { family: "scheduler" }).map((row) => row.event.type),
    ).toEqual(["scheduler:flush"]);
    expect(
      filterTimeline(state.events, { family: "reactivity" }).map((row) => row.event.type),
    ).toEqual(["reactivity:trigger"]);
    expect(
      filterTimeline(state.events, { family: "renderer" }).map((row) => row.event.type),
    ).toEqual(["renderer:element"]);
    expect(filterTimeline(state.events, { family: "store" }).map((row) => row.event.type)).toEqual([
      "store:action",
    ]);
  });

  it("preserves chronological ordering after repeated inserts", () => {
    const state = [
      { event: componentMount, now: 30 },
      {
        event: {
          type: "component:update",
          id: 1,
          name: "Counter",
        } satisfies DevtoolsEvent,
        now: 10,
      },
      {
        event: {
          type: "component:unmount",
          id: 1,
          name: "Counter",
        } satisfies DevtoolsEvent,
        now: 20,
      },
    ].reduce((panelState, item) => {
      return recordDevtoolsEvent(panelState, item.event, { now: item.now });
    }, createPanelState());

    expect(state.events.map((row) => row.event.type)).toEqual([
      "component:update",
      "component:unmount",
      "component:mount",
    ]);
    expect(state.events.map((row) => row.timestamp)).toEqual([10, 20, 30]);
  });

  it("toggles pause and resume without losing the current event buffer", () => {
    const active = recordDevtoolsEvent(createPanelState(), componentMount, { now: 1 });
    const paused = setPanelPaused(active, true);
    const ignored = recordDevtoolsEvent(
      paused,
      {
        type: "component:update",
        id: 1,
        name: "Counter",
      },
      { now: 2 },
    );
    const resumed = setPanelPaused(ignored, false);
    const finalState = recordDevtoolsEvent(
      resumed,
      {
        type: "component:unmount",
        id: 1,
        name: "Counter",
      },
      { now: 3 },
    );

    expect(ignored.paused).toBe(true);
    expect(ignored.events.map((row) => row.event.type)).toEqual(["component:mount"]);
    expect(finalState.paused).toBe(false);
    expect(finalState.events.map((row) => row.event.type)).toEqual([
      "component:mount",
      "component:unmount",
    ]);
  });

  it("applies a numeric recorder limit by trimming the oldest buffered rows first", () => {
    const limited = setRecorderLimit(createPanelState(), 2);
    const events: DevtoolsEvent[] = [
      componentMount,
      {
        type: "component:update",
        id: 1,
        name: "Counter",
      },
      {
        type: "component:unmount",
        id: 1,
        name: "Counter",
      },
    ];
    const state = events.reduce((panelState, event, index) => {
      return recordDevtoolsEvent(panelState, event, { now: index + 1 });
    }, limited);

    expect(state.limit).toBe(2);
    expect(state.events.map((row) => row.event.type)).toEqual([
      "component:update",
      "component:unmount",
    ]);
  });

  it("selects event details and clears the current session view", () => {
    const state = [
      componentMount,
      {
        type: "component:update",
        id: 1,
        name: "Counter",
      } satisfies DevtoolsEvent,
    ].reduce((panelState, event, index) => {
      return recordDevtoolsEvent(panelState, event, { now: index + 1 });
    }, createPanelState());
    const selected = selectTimelineEvent(state, "timeline-1");
    const cleared = clearTimeline(selected);

    expect(getSelectedTimelineRow(selected)?.event).toBe(componentMount);
    expect(cleared.events).toEqual([]);
    expect(cleared.selectedEventId).toBeNull();
  });

  it("keeps selected details aligned with the active family filter", () => {
    const state = [
      componentMount,
      {
        type: "scheduler:flush",
        queuedJobs: 2,
        dedupedJobs: 1,
        durationMs: 3,
      } satisfies DevtoolsEvent,
    ].reduce((panelState, event, index) => {
      return recordDevtoolsEvent(panelState, event, { now: index + 1 });
    }, createPanelState());
    const selectedComponent = selectTimelineEvent(state, "timeline-1");

    const schedulerOnly = setTimelineFilter(selectedComponent, { family: "scheduler" });
    expect(schedulerOnly.selectedEventId).toBe("timeline-2");
    expect(getSelectedTimelineRow(schedulerOnly)?.event.type).toBe("scheduler:flush");

    const emptyFilter = setTimelineFilter(schedulerOnly, { family: "store" });
    expect(emptyFilter.selectedEventId).toBeNull();
    expect(getSelectedTimelineRow(emptyFilter)).toBeUndefined();
  });

  it("does not select newly recorded events hidden by the active family filter", () => {
    const filtered = setTimelineFilter(createPanelState(), { family: "scheduler" });
    const hiddenComponent = recordDevtoolsEvent(filtered, componentMount, { now: 1 });

    expect(hiddenComponent.selectedEventId).toBeNull();
    expect(getSelectedTimelineRow(hiddenComponent)).toBeUndefined();

    const visibleScheduler = recordDevtoolsEvent(
      hiddenComponent,
      {
        type: "scheduler:flush",
        queuedJobs: 2,
        dedupedJobs: 1,
        durationMs: 3,
      },
      { now: 2 },
    );

    expect(visibleScheduler.selectedEventId).toBe("timeline-2");
    expect(getSelectedTimelineRow(visibleScheduler)?.event.type).toBe("scheduler:flush");
  });
});
