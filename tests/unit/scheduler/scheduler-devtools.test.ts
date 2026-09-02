import { afterEach, describe, expect, it } from "vitest";

import {
  clearDevtoolsListeners,
  onDevtoolsEvent,
  type DevtoolsEvent,
} from "../../../src/devtools/events";
import { nextTick } from "../../../src/index";
import {
  associateJobCause,
  peekJobCause,
  queueJob,
  type SchedulerJob,
} from "../../../src/scheduler/scheduler";

function setupEventCapture(): DevtoolsEvent[] {
  const events: DevtoolsEvent[] = [];
  onDevtoolsEvent((event) => {
    events.push(event);
  });
  return events;
}

describe("scheduler devtools signals", () => {
  afterEach(() => {
    clearDevtoolsListeners();
  });

  it("counts a stale job that returns false in skippedStaleJobs", async () => {
    const events = setupEventCapture();
    const stale: SchedulerJob = () => false;

    queueJob(stale);

    await nextTick();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "scheduler:flush",
      queuedJobs: 1,
      skippedStaleJobs: 1,
    });
  });

  it("counts multiple stale jobs alongside a normal job", async () => {
    const events = setupEventCapture();

    queueJob(() => false);
    queueJob(() => false);
    queueJob(() => undefined);

    await nextTick();

    expect(events[0]).toMatchObject({
      type: "scheduler:flush",
      queuedJobs: 3,
      skippedStaleJobs: 2,
    });
  });

  it("reports zero skipped and zero causes for normal void jobs", async () => {
    const events = setupEventCapture();

    queueJob(() => undefined);

    await nextTick();

    expect(events[0]).toMatchObject({
      type: "scheduler:flush",
      skippedStaleJobs: 0,
      distinctCauses: 0,
    });
  });

  it("reports distinct causes and clears the cause registry after flush", async () => {
    const events = setupEventCapture();
    const job: SchedulerJob = () => undefined;

    associateJobCause(job, 7);
    queueJob(job);

    await nextTick();

    expect(events[0]).toMatchObject({
      type: "scheduler:flush",
      distinctCauses: 1,
    });
    expect(peekJobCause(job)).toBeUndefined();
  });

  it("deduplicates identical cause ids and separates distinct ones", async () => {
    const sameEvents = setupEventCapture();
    const first: SchedulerJob = () => undefined;
    const second: SchedulerJob = () => undefined;

    associateJobCause(first, 1);
    associateJobCause(second, 1);
    queueJob(first);
    queueJob(second);

    await nextTick();

    expect(sameEvents[0]).toMatchObject({ distinctCauses: 1 });

    clearDevtoolsListeners();
    const distinctEvents = setupEventCapture();
    const third: SchedulerJob = () => undefined;
    const fourth: SchedulerJob = () => undefined;

    associateJobCause(third, 1);
    associateJobCause(fourth, 2);
    queueJob(third);
    queueJob(fourth);

    await nextTick();

    expect(distinctEvents[0]).toMatchObject({ distinctCauses: 2 });
  });

  it("counts a stale job that carries a cause in both signals", async () => {
    const events = setupEventCapture();
    const stale: SchedulerJob = () => false;

    associateJobCause(stale, 42);
    queueJob(stale);

    await nextTick();

    expect(events[0]).toMatchObject({
      type: "scheduler:flush",
      skippedStaleJobs: 1,
      distinctCauses: 1,
    });
  });

  it("removes a stale job from the dedupe set so it can be requeued", async () => {
    const calls: number[] = [];
    const stale: SchedulerJob = () => {
      calls.push(calls.length);
      return false;
    };

    queueJob(stale);
    await nextTick();

    queueJob(stale);
    await nextTick();

    expect(calls).toHaveLength(2);
  });
});
