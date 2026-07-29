import {
  onDevtoolsEvent,
  type DevtoolsEvent,
  type DevtoolsEventListener,
} from "@italone/solace/devtools";

export const DEVTOOLS_EXTENSION_EVENT_TYPE = "devtools:event";

export interface DevtoolsExtensionEventMessage {
  type: typeof DEVTOOLS_EXTENSION_EVENT_TYPE;
  event: DevtoolsEvent;
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

declare global {
  interface Window {
    __solaceDevtoolsPageBridge__?: DevtoolsPageBridge;
  }
}

export function createDevtoolsPageBridge(
  options: CreateDevtoolsPageBridgeOptions = {},
): DevtoolsPageBridge {
  const postMessage = options.postMessage ?? postWindowMessage;
  const subscribe = options.subscribe ?? onDevtoolsEvent;
  let connected = true;
  let paused = false;

  const unsubscribe = subscribe((event) => {
    if (!connected || paused) {
      return;
    }

    postMessage({
      type: DEVTOOLS_EXTENSION_EVENT_TYPE,
      event: copyDevtoolsEvent(event),
    });
  });

  return {
    disconnect() {
      if (!connected) {
        return;
      }

      connected = false;
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

function postWindowMessage(message: DevtoolsExtensionEventMessage): void {
  if (typeof window === "undefined") {
    return;
  }

  window.postMessage(message, window.location.origin);
}

function copyDevtoolsEvent(event: DevtoolsEvent): DevtoolsEvent {
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

if (
  typeof window !== "undefined" &&
  window.document.currentScript instanceof HTMLScriptElement &&
  window.document.currentScript.dataset.solaceDevtoolsBridge === "true" &&
  window[BRIDGE_GLOBAL_KEY] === undefined
) {
  window[BRIDGE_GLOBAL_KEY] = createDevtoolsPageBridge();
}
