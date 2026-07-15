export type DevtoolsEvent =
  | { type: "component:mount"; id: number; name: string }
  | { type: "component:update"; id: number; name: string }
  | { type: "component:unmount"; id: number; name: string }
  | { type: "component:emit"; id: number; name: string; event: string; handlerCount: number }
  | { type: "scheduler:flush"; queuedJobs: number; dedupedJobs: number; durationMs: number }
  | {
      type: "reactivity:trigger";
      targetType: string;
      keyType: string;
      effectCount: number;
      scheduledEffects: number;
      runEffects: number;
    }
  | {
      type: "renderer:element";
      operation: "mount" | "update" | "unmount";
      tag: string;
    }
  | {
      type: "store:action";
      name: string;
      status: "success" | "error";
      durationMs: number;
    };

export type DevtoolsEventListener = (event: DevtoolsEvent) => void;
export interface DevtoolsRecorderOptions {
  limit?: number;
}
export interface DevtoolsRecorder {
  clear(): void;
  snapshot(): DevtoolsEvent[];
  stop(): void;
}

const listeners = new Set<DevtoolsEventListener>();

export function onDevtoolsEvent(listener: DevtoolsEventListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function emitDevtoolsEvent(event: DevtoolsEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error("Solace DevTools listener failed", error);
    }
  }
}

export function hasDevtoolsListeners(): boolean {
  return listeners.size > 0;
}

export function clearDevtoolsListeners(): void {
  listeners.clear();
}

export function createDevtoolsRecorder(options: DevtoolsRecorderOptions = {}): DevtoolsRecorder {
  const { limit } = options;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error("DevTools recorder limit must be a positive integer");
  }

  const events: DevtoolsEvent[] = [];
  const unsubscribe = onDevtoolsEvent((event) => {
    events.push(serializeDevtoolsEvent(event));
    if (limit !== undefined && events.length > limit) {
      events.splice(0, events.length - limit);
    }
  });

  return {
    clear: () => {
      events.length = 0;
    },
    snapshot: () => [...events],
    stop: unsubscribe,
  };
}

export function serializeDevtoolsEvent(event: DevtoolsEvent): DevtoolsEvent {
  switch (event.type) {
    case "component:mount":
    case "component:update":
    case "component:unmount":
      return {
        type: event.type,
        id: event.id,
        name: event.name,
      };

    case "component:emit":
      return {
        type: event.type,
        id: event.id,
        name: event.name,
        event: event.event,
        handlerCount: event.handlerCount,
      };

    case "scheduler:flush":
      return {
        type: event.type,
        queuedJobs: event.queuedJobs,
        dedupedJobs: event.dedupedJobs,
        durationMs: event.durationMs,
      };

    case "reactivity:trigger":
      return {
        type: event.type,
        targetType: event.targetType,
        keyType: event.keyType,
        effectCount: event.effectCount,
        scheduledEffects: event.scheduledEffects,
        runEffects: event.runEffects,
      };

    case "renderer:element":
      return {
        type: event.type,
        operation: event.operation,
        tag: event.tag,
      };

    case "store:action":
      return {
        type: event.type,
        name: event.name,
        status: event.status,
        durationMs: event.durationMs,
      };
  }
}
