import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearDevtoolsListeners,
  createDevtoolsRecorder,
  emitDevtoolsEvent,
  hasDevtoolsListeners,
  onDevtoolsEvent,
  type DevtoolsEvent,
} from "../../../src/devtools/events";

const mountEvent: DevtoolsEvent = {
  type: "component:mount",
  id: 1,
  name: "Counter",
};

describe("devtools event bus", () => {
  afterEach(() => {
    clearDevtoolsListeners();
    vi.restoreAllMocks();
  });

  it("emits safely when no listeners are registered", () => {
    expect(hasDevtoolsListeners()).toBe(false);

    expect(() => emitDevtoolsEvent(mountEvent)).not.toThrow();
  });

  it("notifies listeners in registration order", () => {
    const calls: string[] = [];

    onDevtoolsEvent((event) => {
      calls.push(`first:${event.type}`);
    });
    onDevtoolsEvent((event) => {
      calls.push(`second:${event.type}`);
    });

    expect(hasDevtoolsListeners()).toBe(true);

    emitDevtoolsEvent(mountEvent);

    expect(calls).toEqual(["first:component:mount", "second:component:mount"]);
  });

  it("removes a listener when unsubscribed", () => {
    const calls: DevtoolsEvent[] = [];
    const unsubscribe = onDevtoolsEvent((event) => {
      calls.push(event);
    });

    unsubscribe();

    expect(hasDevtoolsListeners()).toBe(false);

    emitDevtoolsEvent(mountEvent);

    expect(calls).toEqual([]);
  });

  it("reports listener errors and continues notifying later listeners", () => {
    const error = new Error("listener failed");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const calls: DevtoolsEvent[] = [];

    onDevtoolsEvent(() => {
      throw error;
    });
    onDevtoolsEvent((event) => {
      calls.push(event);
    });

    expect(() => emitDevtoolsEvent(mountEvent)).not.toThrow();

    expect(consoleError).toHaveBeenCalledWith("Solace DevTools listener failed", error);
    expect(calls).toEqual([mountEvent]);
  });

  it("records serialized event snapshots until stopped", () => {
    const recorder = createDevtoolsRecorder();

    emitDevtoolsEvent({
      ...mountEvent,
      extra: { leaked: true },
    } as DevtoolsEvent);

    const firstSnapshot = recorder.snapshot();
    firstSnapshot.push({
      type: "component:unmount",
      id: 999,
      name: "Injected",
    });

    recorder.stop();
    emitDevtoolsEvent({
      type: "component:update",
      id: 1,
      name: "Counter",
    });

    expect(firstSnapshot).toEqual([
      mountEvent,
      {
        type: "component:unmount",
        id: 999,
        name: "Injected",
      },
    ]);
    expect(recorder.snapshot()).toEqual([mountEvent]);
    expect(hasDevtoolsListeners()).toBe(false);
  });

  it("clears recorded events without stopping the recorder", () => {
    const recorder = createDevtoolsRecorder();

    emitDevtoolsEvent(mountEvent);
    recorder.clear();
    emitDevtoolsEvent({
      type: "component:update",
      id: 1,
      name: "Counter",
    });

    expect(recorder.snapshot()).toEqual([
      {
        type: "component:update",
        id: 1,
        name: "Counter",
      },
    ]);
    expect(hasDevtoolsListeners()).toBe(true);

    recorder.stop();
  });

  it("keeps only the latest events when a recorder limit is configured", () => {
    const recorder = createDevtoolsRecorder({ limit: 2 });

    emitDevtoolsEvent({
      type: "component:mount",
      id: 1,
      name: "First",
    });
    emitDevtoolsEvent({
      type: "component:update",
      id: 1,
      name: "First",
    });
    emitDevtoolsEvent({
      type: "component:unmount",
      id: 1,
      name: "First",
    });

    expect(recorder.snapshot()).toEqual([
      {
        type: "component:update",
        id: 1,
        name: "First",
      },
      {
        type: "component:unmount",
        id: 1,
        name: "First",
      },
    ]);

    recorder.stop();
  });

  it("rejects invalid recorder limits", () => {
    expect(() => createDevtoolsRecorder({ limit: 0 })).toThrow(
      "DevTools recorder limit must be a positive integer",
    );
    expect(() => createDevtoolsRecorder({ limit: 1.5 })).toThrow(
      "DevTools recorder limit must be a positive integer",
    );
  });
});
