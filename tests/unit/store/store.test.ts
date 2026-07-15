import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearDevtoolsListeners,
  onDevtoolsEvent,
  type DevtoolsEvent,
} from "../../../src/devtools/events";
import { createStore, effect } from "../../../src/index";
import type { StoreGetterContext } from "../../../src/index";

type CounterState = { count: number };

describe("createStore", () => {
  afterEach(() => {
    clearDevtoolsListeners();
    vi.restoreAllMocks();
  });

  it("returns reactive state", () => {
    const store = createStore({
      state: () => ({ count: 0 }),
    });
    let latest = 0;

    effect(() => {
      latest = store.state.count;
    });

    store.state.count = 1;

    expect(latest).toBe(1);
  });

  it("runs actions with an explicit store context", () => {
    const store = createStore({
      state: () => ({ count: 0 }),
      actions: {
        increment({ state }: StoreGetterContext<CounterState>, amount: number) {
          state.count += amount;
        },
      },
    });

    store.actions.increment(2);

    expect(store.state.count).toBe(2);
  });

  it("caches getters and invalidates them when dependencies change", () => {
    let getterRuns = 0;
    const store = createStore({
      state: () => ({ count: 1 }),
      getters: {
        double({ state }: StoreGetterContext<CounterState>) {
          getterRuns += 1;
          return state.count * 2;
        },
      },
    });

    expect(store.getters.double).toBe(2);
    expect(store.getters.double).toBe(2);
    expect(getterRuns).toBe(1);

    store.state.count = 2;

    expect(store.getters.double).toBe(4);
    expect(getterRuns).toBe(2);
  });

  it("emits a devtools summary for successful actions", () => {
    const events: DevtoolsEvent[] = [];
    const store = createStore({
      state: () => ({ count: 0 }),
      actions: {
        increment({ state }: StoreGetterContext<CounterState>, amount: number) {
          state.count += amount;

          return state.count;
        },
      },
    });

    onDevtoolsEvent((event) => {
      events.push(event);
    });

    expect(store.actions.increment(2)).toBe(2);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "store:action",
      name: "increment",
      status: "success",
    });
    expect(events[0]?.type === "store:action" ? events[0].durationMs : -1).toBeGreaterThanOrEqual(
      0,
    );
    expect(events[0]).not.toHaveProperty("args");
    expect(events[0]).not.toHaveProperty("result");
    expect(events[0]).not.toHaveProperty("state");
  });

  it("emits a devtools summary for failed actions without swallowing the error", () => {
    const events: DevtoolsEvent[] = [];
    const error = new Error("failed");
    const store = createStore({
      state: () => ({ count: 0 }),
      actions: {
        fail() {
          throw error;
        },
      },
    });

    onDevtoolsEvent((event) => {
      events.push(event);
    });

    expect(() => store.actions.fail()).toThrow(error);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "store:action",
      name: "fail",
      status: "error",
    });
    expect(events[0]?.type === "store:action" ? events[0].durationMs : -1).toBeGreaterThanOrEqual(
      0,
    );
    expect(events[0]).not.toHaveProperty("error");
    expect(events[0]).not.toHaveProperty("state");
  });
});
