import { emitDevtoolsEvent, hasDevtoolsListeners } from "../devtools/events";

export type SchedulerJob = () => void | false;

const queue: SchedulerJob[] = [];
const queuedJobs = new Set<SchedulerJob>();
const jobCauses = new WeakMap<SchedulerJob, number>();
const resolvedPromise = Promise.resolve();

let currentFlushPromise: Promise<void> | null = null;
let dedupedJobs = 0;

export function associateJobCause(job: SchedulerJob, correlationId: number): void {
  jobCauses.set(job, correlationId);
}

export function peekJobCause(job: SchedulerJob): number | undefined {
  return jobCauses.get(job);
}

export function queueJob(job: SchedulerJob): void {
  if (queuedJobs.has(job)) {
    if (hasDevtoolsListeners()) {
      dedupedJobs += 1;
    }
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
  let skippedStaleJobs = 0;
  const causes = new Set<number>();

  try {
    for (let index = 0; index < queue.length; index += 1) {
      const job = queue[index];
      const cause = jobCauses.get(job);
      if (cause !== undefined) {
        causes.add(cause);
      }
      try {
        if (job() === false) {
          skippedStaleJobs += 1;
        }
      } finally {
        // Deleted after the run so the job itself can still peek its cause.
        jobCauses.delete(job);
      }
      flushedJobs += 1;
    }
  } finally {
    if (shouldEmitDevtoolsEvent) {
      emitDevtoolsEvent({
        type: "scheduler:flush",
        queuedJobs: flushedJobs,
        dedupedJobs,
        durationMs: Math.max(0, now() - startedAt),
        skippedStaleJobs,
        distinctCauses: causes.size,
      });
    }

    queue.length = 0;
    queuedJobs.clear();
    dedupedJobs = 0;
    currentFlushPromise = null;
  }
}

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}
