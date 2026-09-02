import { afterEach, describe, expect, it } from "vitest";

import {
  clearDevtoolsListeners,
  createDevtoolsRecorder,
  type DevtoolsEvent,
  onDevtoolsEvent,
} from "../../../src/devtools/events";
import { effect, h, nextTick, reactive, render } from "../../../src/index";

function setupEventCapture(): DevtoolsEvent[] {
  const events: DevtoolsEvent[] = [];
  onDevtoolsEvent((event) => {
    events.push(event);
  });
  return events;
}

function ofTypes(events: DevtoolsEvent[], types: DevtoolsEvent["type"][]): DevtoolsEvent[] {
  return events.filter((event) => types.includes(event.type));
}

function renderCounter(source: { count: number }): HTMLParagraphElement {
  const container = document.createElement("div");
  const Counter = () => () => h("p", null, String(source.count));

  render(h(Counter, null), container);

  return container.querySelector("p") as HTMLParagraphElement;
}

describe("reactivity devtools correlation", () => {
  afterEach(() => {
    clearDevtoolsListeners();
  });

  it("propagates the trigger correlationId to the correlated component:update", async () => {
    const events = setupEventCapture();
    const state = reactive({ count: 0 });

    renderCounter(state);
    events.length = 0;

    state.count += 1;
    await nextTick();

    const correlated = ofTypes(events, ["reactivity:trigger", "component:update"]);
    expect(correlated).toHaveLength(2);

    const trigger = correlated[0] as Extract<DevtoolsEvent, { type: "reactivity:trigger" }>;
    const update = correlated[1] as Extract<DevtoolsEvent, { type: "component:update" }>;

    expect(trigger.type).toBe("reactivity:trigger");
    expect(typeof trigger.correlationId).toBe("number");
    expect(update.type).toBe("component:update");
    expect(update.correlationId).toBe(trigger.correlationId);
  });

  it("increases the correlationId across separate mutations", async () => {
    const events = setupEventCapture();
    const state = reactive({ count: 0 });

    renderCounter(state);
    events.length = 0;

    state.count += 1;
    await nextTick();

    const firstTrigger = ofTypes(events, ["reactivity:trigger"])[0] as Extract<
      DevtoolsEvent,
      { type: "reactivity:trigger" }
    >;
    const firstUpdate = ofTypes(events, ["component:update"])[0] as Extract<
      DevtoolsEvent,
      { type: "component:update" }
    >;
    events.length = 0;

    state.count += 1;
    await nextTick();

    const secondTrigger = ofTypes(events, ["reactivity:trigger"])[0] as Extract<
      DevtoolsEvent,
      { type: "reactivity:trigger" }
    >;
    const secondUpdate = ofTypes(events, ["component:update"])[0] as Extract<
      DevtoolsEvent,
      { type: "component:update" }
    >;

    expect(secondTrigger.correlationId).toBeGreaterThan(firstTrigger.correlationId);
    expect(firstUpdate.correlationId).toBe(firstTrigger.correlationId);
    expect(secondUpdate.correlationId).toBe(secondTrigger.correlationId);
  });

  it("emits a correlated trigger without component:update for a bare reactive effect", async () => {
    const events = setupEventCapture();
    const state = reactive({ count: 0 });

    effect(() => state.count);
    events.length = 0;

    state.count += 1;
    await nextTick();

    const triggers = ofTypes(events, ["reactivity:trigger"]);
    expect(triggers).toHaveLength(1);
    expect(typeof (triggers[0] as { correlationId?: number }).correlationId).toBe("number");
    expect(ofTypes(events, ["component:update"])).toHaveLength(0);
  });

  it("preserves the correlationId through recorder serialization", async () => {
    const recorder = createDevtoolsRecorder();
    const state = reactive({ count: 0 });

    renderCounter(state);
    recorder.clear();

    state.count += 1;
    await nextTick();

    const snapshot = recorder.snapshot();
    const trigger = snapshot.find(
      (event): event is Extract<DevtoolsEvent, { type: "reactivity:trigger" }> =>
        event.type === "reactivity:trigger",
    );
    const update = snapshot.find(
      (event): event is Extract<DevtoolsEvent, { type: "component:update" }> =>
        event.type === "component:update",
    );

    expect(trigger).toBeDefined();
    expect(update).toBeDefined();
    expect(snapshot.indexOf(trigger as DevtoolsEvent)).toBeLessThan(
      snapshot.indexOf(update as DevtoolsEvent),
    );
    expect(update?.correlationId).toBe(trigger?.correlationId);

    recorder.stop();
  });

  it("stops correlating after unsubscribing the listener", async () => {
    const recorder = createDevtoolsRecorder();
    const state = reactive({ count: 0 });

    renderCounter(state);
    recorder.clear();

    state.count += 1;
    await nextTick();

    const recordedAfterStopBaseline = recorder.snapshot().length;
    recorder.stop();

    state.count += 1;
    await nextTick();

    expect(recorder.snapshot()).toHaveLength(recordedAfterStopBaseline);
  });
});
