import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearDevtoolsListeners,
  onDevtoolsEvent,
  type DevtoolsEvent,
} from "../../../src/devtools/events";
import { nextTick } from "../../../src/index";
import { queueJob } from "../../../src/scheduler/scheduler";

describe("scheduler", () => {
  afterEach(() => {
    clearDevtoolsListeners();
  });

  it("dedupes the same job in one flush", async () => {
    const job = vi.fn();

    queueJob(job);
    queueJob(job);

    await nextTick();

    expect(job).toHaveBeenCalledTimes(1);
  });

  it("runs jobs in the order they are queued", async () => {
    const calls: string[] = [];

    queueJob(() => calls.push("first"));
    queueJob(() => calls.push("second"));
    queueJob(() => calls.push("third"));

    await nextTick();

    expect(calls).toEqual(["first", "second", "third"]);
  });

  it("resolves nextTick after queued jobs have flushed", async () => {
    const calls: string[] = [];

    queueJob(() => calls.push("job"));

    await nextTick();
    calls.push("tick");

    expect(calls).toEqual(["job", "tick"]);
  });

  it("runs nextTick callbacks after queued jobs have flushed", async () => {
    const calls: string[] = [];

    queueJob(() => calls.push("job"));

    await nextTick(() => {
      calls.push("callback");
    });

    expect(calls).toEqual(["job", "callback"]);
  });

  it("keeps the same job deduped while the current flush is running", async () => {
    const calls: string[] = [];

    const job = () => {
      calls.push("job");
      queueJob(job);
    };

    queueJob(job);

    await nextTick();

    expect(calls).toEqual(["job"]);
  });

  it("runs a different job queued during the current flush", async () => {
    const calls: string[] = [];
    const second = () => calls.push("second");

    queueJob(() => {
      calls.push("first");
      queueJob(second);
    });

    await nextTick();

    expect(calls).toEqual(["first", "second"]);
  });

  it("emits a devtools summary after flushing queued jobs", async () => {
    const events: DevtoolsEvent[] = [];

    onDevtoolsEvent((event) => {
      events.push(event);
    });

    queueJob(() => undefined);
    queueJob(() => undefined);

    await nextTick();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "scheduler:flush",
      queuedJobs: 2,
    });
    expect(
      events[0]?.type === "scheduler:flush" ? events[0].durationMs : -1,
    ).toBeGreaterThanOrEqual(0);
  });
});
