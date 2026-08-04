import { describe, expect, it } from "vitest";

import { h, nextTick, reactive, render } from "../../../src/index";
import type { DevtoolsEvent } from "@italone/solace/devtools";
import { TimelinePanel } from "../../../examples/devtools-extension/src/panel/components";
import {
  createPanelState,
  recordDevtoolsEvent,
  type PanelState,
} from "../../../examples/devtools-extension/src/panel/state";

const componentMount: DevtoolsEvent = {
  type: "component:mount",
  id: 1,
  name: "Counter",
};

const schedulerFlush: DevtoolsEvent = {
  type: "scheduler:flush",
  queuedJobs: 2,
  dedupedJobs: 1,
  durationMs: 3,
};

describe("devtools extension timeline panel", () => {
  it("renders timeline controls, family filters, bounded recorder controls, and event details", () => {
    const { container } = renderPanel(
      recordDevtoolsEvent(
        recordDevtoolsEvent(createPanelState({ limit: 250 }), schedulerFlush, { now: 20 }),
        componentMount,
        {
          now: 10,
        },
      ),
    );

    expect(container.querySelector("[data-testid='timeline-list']")).not.toBeNull();
    expect(container.querySelector("[data-testid='family-filters']")).not.toBeNull();
    expect(findButton(container, "Pause")).not.toBeNull();
    expect(findButton(container, "Clear")).not.toBeNull();
    expect(container.querySelector("[data-testid='event-details']")).not.toBeNull();
    expect(getLimitInput(container)?.value).toBe("250");

    expect(getFilterLabels(container)).toEqual([
      "component",
      "scheduler",
      "reactivity",
      "renderer",
      "store",
    ]);
    expect(getTimelineRows(container).map((row) => row.textContent)).toEqual([
      "component:mountCounter #1 mounted",
      "scheduler:flush2 jobs flushed, 1 deduped in 3ms",
    ]);
    expect(getDetailsText(container)).toBe(JSON.stringify(componentMount, null, 2));
  });

  it("keeps the selected event details as the exact received payload without row metadata", async () => {
    const hiddenFields = {
      timestamp: 10,
      family: "component",
      summary: "Counter #1 mounted",
      selectedEventId: "timeline-1",
    };
    const { container } = renderPanel(
      recordDevtoolsEvent(createPanelState(), componentMount, { now: hiddenFields.timestamp }),
    );

    expect(getDetailsText(container)).toBe(JSON.stringify(componentMount, null, 2));
    for (const hiddenField of Object.keys(hiddenFields)) {
      expect(getDetailsText(container)).not.toContain(`"${hiddenField}"`);
    }

    getTimelineRows(container)[0]?.querySelector("button")?.click();
    await nextTick();

    expect(getDetailsText(container)).toBe(JSON.stringify(componentMount, null, 2));
  });

  it("updates filtering, pause state, clear action, and recorder limit through the existing state helpers", async () => {
    const initialState = recordDevtoolsEvent(
      recordDevtoolsEvent(createPanelState(), componentMount, { now: 1 }),
      schedulerFlush,
      { now: 2 },
    );
    const { container, state } = renderPanel(initialState);

    findButton(container, "scheduler")?.click();
    await nextTick();

    expect(state.filter.family).toBe("scheduler");
    expect(getTimelineRows(container).map((row) => row.textContent)).toEqual([
      "scheduler:flush2 jobs flushed, 1 deduped in 3ms",
    ]);
    expect(getDetailsText(container)).toBe(JSON.stringify(schedulerFlush, null, 2));

    findButton(container, "Pause")?.click();
    await nextTick();

    expect(state.paused).toBe(true);
    expect(findButton(container, "Resume")).not.toBeNull();

    const limitInput = getLimitInput(container);
    expect(limitInput).not.toBeNull();
    if (limitInput !== null) {
      limitInput.value = "1";
      limitInput.dispatchEvent(new Event("change", { bubbles: true }));
      await nextTick();
    }

    expect(state.limit).toBe(1);
    expect(state.events.map((row) => row.event.type)).toEqual(["scheduler:flush"]);

    findButton(container, "Clear")?.click();
    await nextTick();

    expect(state.events).toEqual([]);
    expect(getTimelineRows(container)).toEqual([]);
    expect(getDetailsText(container)).toBe("");
  });
});

function renderPanel(initialState: PanelState): { container: HTMLDivElement; state: PanelState } {
  const container = document.createElement("div");
  const state = reactive(initialState);
  const replaceState = (nextState: PanelState): void => {
    state.paused = nextState.paused;
    state.limit = nextState.limit;
    state.filter = nextState.filter;
    state.selectedEventId = nextState.selectedEventId;
    state.events = nextState.events;
    state.nextEventId = nextState.nextEventId;
  };

  render(h(TimelinePanel, { state, onStateChange: replaceState }), container);

  return { container, state };
}

function findButton(container: ParentNode, label: string): HTMLButtonElement | null {
  return (
    Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === label,
    ) ?? null
  );
}

function getFilterLabels(container: ParentNode): string[] {
  return Array.from(container.querySelectorAll("[data-testid='family-filters'] button")).map(
    (button) => button.textContent?.trim() ?? "",
  );
}

function getTimelineRows(container: ParentNode): HTMLLIElement[] {
  return Array.from(container.querySelectorAll("[data-testid='timeline-list'] li"));
}

function getDetailsText(container: ParentNode): string {
  return container.querySelector("[data-testid='event-details'] pre")?.textContent ?? "";
}

function getLimitInput(container: ParentNode): HTMLInputElement | null {
  return container.querySelector("input[name='recorder-limit']");
}
