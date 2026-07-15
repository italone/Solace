import { emitDevtoolsEvent, hasDevtoolsListeners } from "../devtools/events";

export type SchedulerJob = () => void;

const queue: SchedulerJob[] = [];
const queuedJobs = new Set<SchedulerJob>();
const resolvedPromise = Promise.resolve();

let currentFlushPromise: Promise<void> | null = null;

export function queueJob(job: SchedulerJob): void {
  if (queuedJobs.has(job)) {
    return;
  }

  queuedJobs.add(job);
  queue.push(job);
  queueFlush();
}

export function nextTick<T = void>(callback?: () => T): Promise<T | void> {
  const promise = currentFlushPromise ?? resolvedPromise;

  return callback === undefined ? promise : promise.then(callback);
}

function queueFlush(): void {
  currentFlushPromise ??= resolvedPromise.then(flushJobs);
}

function flushJobs(): void {
  const shouldEmitDevtoolsEvent = hasDevtoolsListeners();
  const startedAt = shouldEmitDevtoolsEvent ? now() : 0;
  let flushedJobs = 0;

  try {
    for (let index = 0; index < queue.length; index += 1) {
      const job = queue[index];
      job();
      flushedJobs += 1;
    }
  } finally {
    if (shouldEmitDevtoolsEvent) {
      emitDevtoolsEvent({
        type: "scheduler:flush",
        queuedJobs: flushedJobs,
        durationMs: Math.max(0, now() - startedAt),
      });
    }

    queue.length = 0;
    queuedJobs.clear();
    currentFlushPromise = null;
  }
}

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}
