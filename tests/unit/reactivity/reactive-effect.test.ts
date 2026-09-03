import { afterEach, describe, expect, it } from "vitest";

import {
  clearDevtoolsListeners,
  onDevtoolsEvent,
  type DevtoolsEvent,
} from "../../../src/devtools/events";
import { ReactiveEffect } from "../../../src/reactivity/effect";
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

  it("runs every subscribed effect when one effect tracks a new dependency mid-trigger", () => {
    const state = reactive({ x: 1, y: 1 });
    let aRuns = 0;
    let bRuns = 0;
    let yRuns = 0;

    const a = new ReactiveEffect(() => {
      aRuns += 1;
      void state.x;
      void state.y; // new track (state.y) happens inside the first run of this trigger
    });
    a.run();

    const b = new ReactiveEffect(() => {
      bRuns += 1;
      void state.x;
    });
    b.run();

    const yOnly = new ReactiveEffect(() => {
      yRuns += 1;
      void state.y;
    });
    yOnly.run();

    state.x = 2;

    expect(aRuns).toBe(2);
    expect(bRuns).toBe(2);
    // yOnly subscribed to state.y only after the trigger began re-tracking a;
    // it must not run as part of the state.x trigger.
    expect(yRuns).toBe(1);

    state.y = 2;

    expect(aRuns).toBe(3);
    expect(yRuns).toBe(2);
  });

  it("keeps other effects running when an effect stops itself during its run", () => {
    const state = reactive({ x: 1 });
    let aRuns = 0;
    let bRuns = 0;

    const a = new ReactiveEffect(() => {
      aRuns += 1;
      void state.x;
      if (aRuns > 1) {
        a.stop(); // stops itself mid-trigger, on its second run
      }
    });
    a.run();

    const b = new ReactiveEffect(() => {
      bRuns += 1;
      void state.x;
    });
    b.run();

    expect(() => {
      state.x = 2;
    }).not.toThrow();

    expect(aRuns).toBe(2); // a ran once more, then stopped itself mid-trigger
    expect(bRuns).toBe(2); // b still runs exactly once per trigger

    state.x = 3;

    expect(aRuns).toBe(2); // a is stopped and no longer tracked
    expect(bRuns).toBe(3);
  });

  it("does not rerun an effect stopped by an earlier effect in the same trigger", () => {
    const state = reactive({ x: 1 });
    let aRuns = 0;
    let bRuns = 0;

    let b: ReactiveEffect | undefined;
    const a = new ReactiveEffect(() => {
      aRuns += 1;
      void state.x;
      b?.stop();
    });
    a.run(); // a is first in dep insertion order

    b = new ReactiveEffect(() => {
      bRuns += 1;
      void state.x;
    });
    b.run();

    state.x = 2;

    expect(aRuns).toBe(2);
    // Snapshot semantics: b was subscribed at trigger time, but stop() marks it
    // inactive before its turn, so the trigger skips it.
    expect(bRuns).toBe(1);
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

    expect(events).toMatchObject([
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

    expect(events).toMatchObject([
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
