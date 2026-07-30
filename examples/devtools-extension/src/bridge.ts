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

    postMessage({
      type: DEVTOOLS_EXTENSION_EVENT_TYPE,
      event: serializedEvent,
    });
  });
  const handleControlMessage = (message: MessageEvent<unknown>) => {
    if (message.source !== window || !isDevtoolsControlMessage(message.data)) {
      return;
    }

    paused = message.data.paused;
  };

  if (typeof window !== "undefined") {
    window.addEventListener("message", handleControlMessage);
  }

  return {
    disconnect() {
      if (!connected) {
        return;
      }

      connected = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("message", handleControlMessage);
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

function copyDevtoolsEvent(event: unknown): DevtoolsEvent | undefined {
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
      return {
        type: event.type,
        id: event.id,
        name: event.name,
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
        !isNumber(event.durationMs)
      ) {
        return undefined;
      }
      return {
        type: event.type,
        queuedJobs: event.queuedJobs,
        dedupedJobs: event.dedupedJobs,
        durationMs: event.durationMs,
      };

    case "reactivity:trigger":
      if (
        !isString(event.targetType) ||
        !isString(event.keyType) ||
        !isNumber(event.effectCount) ||
        !isNumber(event.scheduledEffects) ||
        !isNumber(event.runEffects)
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
      };

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
