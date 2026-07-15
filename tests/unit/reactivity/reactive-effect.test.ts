import { afterEach, describe, expect, it } from "vitest";

import {
  clearDevtoolsListeners,
  onDevtoolsEvent,
  type DevtoolsEvent,
} from "../../../src/devtools/events";
import { effect, reactive, watch } from "../../../src/index";

describe("reactive and effect", () => {
  afterEach(() => {
    clearDevtoolsListeners();
  });

  it("collects dependencies when an effect reads an object property", () => {
    const state = reactive({ count: 1 });
    let observed = 0;

    effect(() => {
      observed = state.count;
    });

    expect(observed).toBe(1);
  });

  it("reruns the related effect when an object property is written", () => {
    const state = reactive({ count: 1 });
    let observed = 0;

    effect(() => {
      observed = state.count;
    });

    state.count = 2;

    expect(observed).toBe(2);
  });

  it("does not rerun effects when assigning the same value", () => {
    const state = reactive({ count: 1 });
    let runs = 0;

    effect(() => {
      runs += 1;
      void state.count;
    });

    state.count = 1;

    expect(runs).toBe(1);
  });

  it("returns a runner that reruns the effect and returns the result", () => {
    const state = reactive({ count: 1 });

    const runner = effect(() => state.count + 1);

    state.count = 4;

    expect(runner()).toBe(5);
  });

  it("restores the outer effect after running a nested effect", () => {
    const state = reactive({ outer: 1, inner: 1 });
    let outerObserved = 0;
    let innerObserved = 0;

    effect(() => {
      effect(() => {
        innerObserved = state.inner;
      });

      outerObserved = state.outer;
    });

    state.outer = 2;

    expect(outerObserved).toBe(2);
    expect(innerObserved).toBe(1);
  });

  it("cleans up stale dependencies when an effect reruns", () => {
    const state = reactive({ useCount: true, count: 1, fallback: 10 });
    let observed = 0;
    let runs = 0;

    effect(() => {
      runs += 1;
      observed = state.useCount ? state.count : state.fallback;
    });

    state.useCount = false;

    expect(observed).toBe(10);
    expect(runs).toBe(2);

    state.count = 2;

    expect(observed).toBe(10);
    expect(runs).toBe(2);

    state.fallback = 20;

    expect(observed).toBe(20);
    expect(runs).toBe(3);
  });

  it("emits a devtools trigger summary for direct effect runs", () => {
    const events: DevtoolsEvent[] = [];
    const state = reactive({ count: 1 });
    let observed = 0;

    onDevtoolsEvent((event) => {
      events.push(event);
    });

    effect(() => {
      observed = state.count;
    });
    state.count = 2;

    expect(observed).toBe(2);

    expect(events).toEqual([
      {
        type: "reactivity:trigger",
        targetType: "object",
        keyType: "string",
        effectCount: 1,
        scheduledEffects: 0,
        runEffects: 1,
      },
    ]);
    expect(events[0]).not.toHaveProperty("target");
    expect(events[0]).not.toHaveProperty("key");
    expect(events[0]).not.toHaveProperty("value");
    expect(events[0]).not.toHaveProperty("effects");
  });

  it("emits a devtools trigger summary for scheduled effects", () => {
    const events: DevtoolsEvent[] = [];
    const state = reactive({ count: 1 });
    let observed = 0;

    onDevtoolsEvent((event) => {
      events.push(event);
    });

    watch(
      () => state.count,
      (value) => {
        observed = value;
      },
    );
    state.count = 2;

    expect(observed).toBe(2);

    expect(events).toEqual([
      {
        type: "reactivity:trigger",
        targetType: "object",
        keyType: "string",
        effectCount: 1,
        scheduledEffects: 1,
        runEffects: 0,
      },
    ]);
  });
});
