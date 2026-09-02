export const DEVTOOLS_CONTRACT_VERSION = 1 as const;

let correlationCounter = 0;

export function nextDevtoolsCorrelationId(): number {
  correlationCounter += 1;
  return correlationCounter;
}

export type DevtoolsEvent =
  | { type: "component:mount"; id: number; name: string; parentId: number | null }
  | {
      type: "component:update";
      id: number;
      name: string;
      parentId: number | null;
      correlationId?: number;
    }
  | { type: "component:unmount"; id: number; name: string; parentId: number | null }
  | { type: "component:emit"; id: number; name: string; event: string; handlerCount: number }
  | {
      type: "scheduler:flush";
      queuedJobs: number;
      dedupedJobs: number;
      durationMs: number;
      skippedStaleJobs: number;
      distinctCauses: number;
    }
  | {
      type: "reactivity:trigger";
      targetType: string;
      keyType: string;
      effectCount: number;
      scheduledEffects: number;
      runEffects: number;
      correlationId: number;
    }
  | {
      type: "router:navigation";
      to: string;
      from: string;
      status: "start" | "success" | "redirect" | "error" | "cancelled";
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
const GLOBAL_DEVTOOLS_HOOK_KEY = "__SOLACE_DEVTOOLS_GLOBAL_HOOK__";

interface GlobalDevtoolsHook {
  onDevtoolsEvent(listener: DevtoolsEventListener): () => void;
}

type GlobalDevtoolsTarget = typeof globalThis & {
  [GLOBAL_DEVTOOLS_HOOK_KEY]?: GlobalDevtoolsHook;
};

export function onDevtoolsEvent(listener: DevtoolsEventListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

installGlobalDevtoolsHook();

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
    case "component:unmount":
      return {
        type: event.type,
        id: event.id,
        name: event.name,
        parentId: event.parentId,
      };

    case "component:update":
      return {
        type: event.type,
        id: event.id,
        name: event.name,
        parentId: event.parentId,
        ...(event.correlationId !== undefined ? { correlationId: event.correlationId } : {}),
      };

    case "component:emit":
      return {
        type: event.type,
        id: event.id,
        name: event.name,
        event: event.event,
        handlerCount: event.handlerCount,
      };

    case "router:navigation":
      return {
        type: event.type,
        to: event.to,
        from: event.from,
        status: event.status,
      };

    case "scheduler:flush":
      return {
        type: event.type,
        queuedJobs: event.queuedJobs,
        dedupedJobs: event.dedupedJobs,
        durationMs: event.durationMs,
        skippedStaleJobs: event.skippedStaleJobs,
        distinctCauses: event.distinctCauses,
      };

    case "reactivity:trigger":
      return {
        type: event.type,
        targetType: event.targetType,
        keyType: event.keyType,
        effectCount: event.effectCount,
        scheduledEffects: event.scheduledEffects,
        runEffects: event.runEffects,
        correlationId: event.correlationId,
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

function installGlobalDevtoolsHook(): void {
  const target = globalThis as GlobalDevtoolsTarget;
  target[GLOBAL_DEVTOOLS_HOOK_KEY] ??= {
    onDevtoolsEvent,
  };
}
