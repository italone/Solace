import type { DevtoolsEvent, DevtoolsEventListener } from "@italone/solace/devtools";

export const DEVTOOLS_EXTENSION_EVENT_TYPE = "devtools:event";
export const DEVTOOLS_CONTROL_EVENT_TYPE = "devtools:control";
const GLOBAL_DEVTOOLS_HOOK_KEY = "__SOLACE_DEVTOOLS_GLOBAL_HOOK__";

export interface DevtoolsExtensionEventMessage {
  type: typeof DEVTOOLS_EXTENSION_EVENT_TYPE;
  event: DevtoolsEvent;
}

export interface DevtoolsControlMessage {
  type: typeof DEVTOOLS_CONTROL_EVENT_TYPE;
  paused: boolean;
}

export interface DevtoolsPageBridge {
  disconnect(): void;
  pause(): void;
  resume(): void;
  isPaused(): boolean;
}

export interface CreateDevtoolsPageBridgeOptions {
  postMessage?: (message: DevtoolsExtensionEventMessage) => void;
  subscribe?: (listener: DevtoolsEventListener) => () => void;
}

const BRIDGE_GLOBAL_KEY = "__solaceDevtoolsPageBridge__";

interface PageDevtoolsHook {
  onDevtoolsEvent(listener: DevtoolsEventListener): () => void;
}

declare global {
  interface Window {
    __solaceDevtoolsPageBridge__?: DevtoolsPageBridge;
    __SOLACE_DEVTOOLS_GLOBAL_HOOK__?: PageDevtoolsHook;
  }
}

export function createDevtoolsPageBridge(
  options: CreateDevtoolsPageBridgeOptions = {},
): DevtoolsPageBridge {
  const postMessage = options.postMessage ?? postWindowMessage;
  const subscribe = options.subscribe ?? getPageDevtoolsSubscribe();
  let connected = true;
  let paused = false;

  const unsubscribe = subscribe((event) => {
    if (!connected || paused) {
      return;
    }
    const serializedEvent = copyDevtoolsEvent(event);
    if (serializedEvent === undefined) {
      return;
    }

    try {
      postMessage({
        type: DEVTOOLS_EXTENSION_EVENT_TYPE,
        event: serializedEvent,
      });
    } catch {
      // Ignore unavailable page message targets so DevTools capture cannot crash the app.
    }
  });
  const handleControlMessage = (message: MessageEvent<unknown>) => {
    if (
      message.source !== window ||
      message.origin !== window.location.origin ||
      !isDevtoolsControlMessage(message.data)
    ) {
      return;
    }

    paused = message.data.paused;
  };

  if (typeof window !== "undefined") {
    window.addEventListener("message", handleControlMessage);
  }

  const bridge: DevtoolsPageBridge = {
    disconnect() {
      if (!connected) {
        return;
      }

      connected = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("message", handleControlMessage);
        if (window[BRIDGE_GLOBAL_KEY] === bridge) {
          delete window[BRIDGE_GLOBAL_KEY];
        }
      }
      unsubscribe();
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    isPaused() {
      return paused;
    },
  };

  return bridge;
}

function isDevtoolsControlMessage(value: unknown): value is DevtoolsControlMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === DEVTOOLS_CONTROL_EVENT_TYPE &&
    "paused" in value &&
    typeof value.paused === "boolean"
  );
}

function postWindowMessage(message: DevtoolsExtensionEventMessage): void {
  if (typeof window === "undefined") {
    return;
  }

  window.postMessage(message, window.location.origin);
}

function getPageDevtoolsSubscribe(): (listener: DevtoolsEventListener) => () => void {
  if (typeof window === "undefined") {
    return () => () => {};
  }

  return window[GLOBAL_DEVTOOLS_HOOK_KEY]?.onDevtoolsEvent ?? (() => () => {});
}

export function copyDevtoolsEvent(event: unknown): DevtoolsEvent | undefined {
  if (!isRecord(event) || typeof event.type !== "string") {
    return undefined;
  }

  switch (event.type) {
    case "component:mount":
    case "component:update":
    case "component:unmount":
      if (!isNumber(event.id) || !isString(event.name)) {
        return undefined;
      }
      if (event.parentId !== undefined && event.parentId !== null && !isNumber(event.parentId)) {
        return undefined;
      }
      return {
        type: event.type,
        id: event.id,
        name: event.name,
        parentId: isNumber(event.parentId) ? event.parentId : null,
        ...(event.type === "component:update" && isNumber(event.correlationId)
          ? { correlationId: event.correlationId }
          : {}),
      };

    case "component:emit":
      if (
        !isNumber(event.id) ||
        !isString(event.name) ||
        !isString(event.event) ||
        !isNumber(event.handlerCount)
      ) {
        return undefined;
      }
      return {
        type: event.type,
        id: event.id,
        name: event.name,
        event: event.event,
        handlerCount: event.handlerCount,
      };

    case "scheduler:flush":
      if (
        !isNumber(event.queuedJobs) ||
        !isNumber(event.dedupedJobs) ||
        !isNumber(event.durationMs) ||
        !isNumber(event.skippedStaleJobs) ||
        !isNumber(event.distinctCauses)
      ) {
        return undefined;
      }
      return {
        type: event.type,
        queuedJobs: event.queuedJobs,
        dedupedJobs: event.dedupedJobs,
        durationMs: event.durationMs,
        skippedStaleJobs: event.skippedStaleJobs,
        distinctCauses: event.distinctCauses,
      };

    case "reactivity:trigger":
      if (
        !isString(event.targetType) ||
        !isString(event.keyType) ||
        !isNumber(event.effectCount) ||
        !isNumber(event.scheduledEffects) ||
        !isNumber(event.runEffects) ||
        !isNumber(event.correlationId)
      ) {
        return undefined;
      }
      return {
        type: event.type,
        targetType: event.targetType,
        keyType: event.keyType,
        effectCount: event.effectCount,
        scheduledEffects: event.scheduledEffects,
        runEffects: event.runEffects,
        correlationId: event.correlationId,
      };

    case "router:navigation":
      if (
        !isString(event.to) ||
        !isString(event.from) ||
        (event.status !== "start" &&
          event.status !== "success" &&
          event.status !== "redirect" &&
          event.status !== "error" &&
          event.status !== "cancelled")
      ) {
        return undefined;
      }
      return { type: event.type, to: event.to, from: event.from, status: event.status };

    case "renderer:element":
      if (
        (event.operation !== "mount" &&
          event.operation !== "update" &&
          event.operation !== "unmount") ||
        !isString(event.tag)
      ) {
        return undefined;
      }
      return {
        type: event.type,
        operation: event.operation,
        tag: event.tag,
      };

    case "store:action":
      if (
        !isString(event.name) ||
        (event.status !== "success" && event.status !== "error") ||
        !isNumber(event.durationMs)
      ) {
        return undefined;
      }
      return {
        type: event.type,
        name: event.name,
        status: event.status,
        durationMs: event.durationMs,
      };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

if (
  typeof window !== "undefined" &&
  window.document.currentScript instanceof HTMLScriptElement &&
  window.document.currentScript.dataset.solaceDevtoolsBridge === "true" &&
  window[BRIDGE_GLOBAL_KEY] === undefined
) {
  window[BRIDGE_GLOBAL_KEY] = createDevtoolsPageBridge();
}
