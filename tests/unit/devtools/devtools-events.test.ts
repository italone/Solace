import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearDevtoolsListeners,
  createDevtoolsRecorder,
  DEVTOOLS_CONTRACT_VERSION,
  emitDevtoolsEvent,
  hasDevtoolsListeners,
  nextDevtoolsCorrelationId,
  onDevtoolsEvent,
  serializeDevtoolsEvent,
  type DevtoolsEvent,
} from "../../../src/devtools/events";

const mountEvent: DevtoolsEvent = {
  type: "component:mount",
  id: 1,
  name: "Counter",
  parentId: null,
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
      parentId: null,
    });

    recorder.stop();
    emitDevtoolsEvent({
      type: "component:update",
      id: 1,
      name: "Counter",
      parentId: null,
    });

    expect(firstSnapshot).toEqual([
      mountEvent,
      {
        type: "component:unmount",
        id: 999,
        name: "Injected",
        parentId: null,
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
      parentId: null,
    });

    expect(recorder.snapshot()).toEqual([
      {
        type: "component:update",
        id: 1,
        name: "Counter",
        parentId: null,
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
      parentId: null,
    });
    emitDevtoolsEvent({
      type: "component:update",
      id: 1,
      name: "First",
      parentId: null,
    });
    emitDevtoolsEvent({
      type: "component:unmount",
      id: 1,
      name: "First",
      parentId: null,
    });

    expect(recorder.snapshot()).toEqual([
      {
        type: "component:update",
        id: 1,
        name: "First",
        parentId: null,
      },
      {
        type: "component:unmount",
        id: 1,
        name: "First",
        parentId: null,
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

describe("devtools event contract serialization", () => {
  it("serializes router:navigation to exactly the contracted fields", () => {
    const serialized = serializeDevtoolsEvent({
      type: "router:navigation",
      to: "/about",
      from: "/",
      status: "start",
    });

    expect(serialized).toMatchObject({
      type: "router:navigation",
      to: "/about",
      from: "/",
      status: "start",
    });
    expect(Object.keys(serialized)).toHaveLength(4);
  });

  it("serializes reactivity:trigger with correlationId", () => {
    const serialized = serializeDevtoolsEvent({
      type: "reactivity:trigger",
      targetType: "object",
      keyType: "string",
      effectCount: 1,
      scheduledEffects: 1,
      runEffects: 0,
      correlationId: 7,
    });

    expect(serialized).toMatchObject({ type: "reactivity:trigger", correlationId: 7 });
  });

  it("passes correlationId through component:update when present", () => {
    const serialized = serializeDevtoolsEvent({
      type: "component:update",
      id: 1,
      name: "Counter",
      parentId: null,
      correlationId: 3,
    });

    expect(serialized).toMatchObject({ type: "component:update", correlationId: 3 });
  });

  it("omits correlationId from component:update when absent", () => {
    const serialized = serializeDevtoolsEvent({
      type: "component:update",
      id: 1,
      name: "Counter",
      parentId: null,
    });

    expect("correlationId" in serialized).toBe(false);
  });

  it("serializes scheduler:flush with skippedStaleJobs and distinctCauses", () => {
    const serialized = serializeDevtoolsEvent({
      type: "scheduler:flush",
      queuedJobs: 2,
      dedupedJobs: 1,
      durationMs: 0,
      skippedStaleJobs: 1,
      distinctCauses: 2,
    });

    expect(serialized).toMatchObject({ skippedStaleJobs: 1, distinctCauses: 2 });
  });

  it("allocates strictly increasing correlation ids", () => {
    let previous = nextDevtoolsCorrelationId();
    for (let index = 0; index < 2; index += 1) {
      const next = nextDevtoolsCorrelationId();
      expect(next).toBeGreaterThan(previous);
      previous = next;
    }
  });

  it("pins the DevTools contract version", () => {
    expect(DEVTOOLS_CONTRACT_VERSION).toBe(1);
  });
});
