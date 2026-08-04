import type { DevtoolsExtensionEventMessage } from "./bridge";

export const DEVTOOLS_CONTENT_PORT = "solace-devtools-content";
export const DEVTOOLS_BRIDGE_SCRIPT = "bridge.js";
const DEVTOOLS_EXTENSION_EVENT_TYPE = "devtools:event";
const DEVTOOLS_CONTROL_EVENT_TYPE = "devtools:control";
const DEVTOOLS_CONTENT_CONNECT_TYPE = "devtools:content:connect";
const DEVTOOLS_CONTENT_DISCONNECT_TYPE = "devtools:content:disconnect";

export interface RuntimePort {
  disconnect(): void;
  onMessage: RuntimeEvent<DevtoolsContentMessage>;
  postMessage(message: DevtoolsExtensionEventMessage): void;
}

export interface RuntimeEvent<T> {
  addListener(listener: (value: T) => void): void;
  removeListener?(listener: (value: T) => void): void;
}

export interface DevtoolsControlMessage {
  type: typeof DEVTOOLS_CONTROL_EVENT_TYPE;
  paused: boolean;
}

export type DevtoolsContentMessage =
  | DevtoolsControlMessage
  | { type: typeof DEVTOOLS_CONTENT_CONNECT_TYPE }
  | { type: typeof DEVTOOLS_CONTENT_DISCONNECT_TYPE };

export interface CreateContentScriptRelayOptions {
  addWindowListener?: typeof window.addEventListener;
  connectRuntime?: () => RuntimePort;
  injectBridge?: () => void;
  removeWindowListener?: typeof window.removeEventListener;
}

interface BrowserRuntime {
  connect(options: { name: string }): RuntimePort;
  getURL(path: string): string;
}

interface BrowserWindow extends Window {
  chrome?: {
    runtime?: BrowserRuntime;
  };
}

export function createContentScriptRelay(
  options: CreateContentScriptRelayOptions = {},
): () => void {
  const addWindowListener = options.addWindowListener ?? window.addEventListener.bind(window);
  const removeWindowListener =
    options.removeWindowListener ?? window.removeEventListener.bind(window);
  const connectRuntime = options.connectRuntime ?? connectDefaultRuntime;
  const injectBridge = options.injectBridge ?? injectDevtoolsPageBridge;
  const port = connectRuntime();
  let active = false;
  let bridgeInjected = false;
  let stopped = false;
  const relayContentMessage = (message: DevtoolsContentMessage) => {
    if (stopped) {
      return;
    }

    if (!isDevtoolsContentMessage(message)) {
      return;
    }

    if (message.type === DEVTOOLS_CONTENT_CONNECT_TYPE) {
      if (!bridgeInjected) {
        injectBridge();
        bridgeInjected = true;
      }
      postControlMessage(false);
      if (!active) {
        addWindowListener("message", relayMessage);
        active = true;
      }
      return;
    }

    if (message.type === DEVTOOLS_CONTENT_DISCONNECT_TYPE) {
      if (active) {
        removeWindowListener("message", relayMessage);
        active = false;
      }
      postControlMessage(true);
      return;
    }

    if (message.type === DEVTOOLS_CONTROL_EVENT_TYPE && active) {
      window.postMessage(message, window.location.origin);
    }
  };

  const relayMessage = (event: Event) => {
    const messageEvent = event as MessageEvent<unknown>;
    if (
      messageEvent.source !== window ||
      messageEvent.origin !== window.location.origin ||
      !isDevtoolsExtensionEventMessage(messageEvent.data)
    ) {
      return;
    }

    const devtoolsEvent = copyDevtoolsEvent(messageEvent.data.event);
    if (devtoolsEvent === undefined) {
      return;
    }

    port.postMessage({ type: DEVTOOLS_EXTENSION_EVENT_TYPE, event: devtoolsEvent });
  };

  port.onMessage.addListener(relayContentMessage);

  return () => {
    if (stopped) {
      return;
    }
    stopped = true;
    if (active) {
      removeWindowListener("message", relayMessage);
      active = false;
    }
    port.onMessage.removeListener?.(relayContentMessage);
    port.disconnect();
  };
}

function postControlMessage(paused: boolean): void {
  window.postMessage({ type: DEVTOOLS_CONTROL_EVENT_TYPE, paused }, window.location.origin);
}

export function injectDevtoolsPageBridge(): void {
  const runtime = getRuntime();
  const script = document.createElement("script");
  script.src = runtime.getURL(DEVTOOLS_BRIDGE_SCRIPT);
  script.dataset.solaceDevtoolsBridge = "true";
  script.onload = () => {
    script.remove();
  };

  (document.head ?? document.documentElement).appendChild(script);
}

function connectDefaultRuntime(): RuntimePort {
  return getRuntime().connect({ name: DEVTOOLS_CONTENT_PORT });
}

function getRuntime(): BrowserRuntime {
  const runtime = (window as BrowserWindow).chrome?.runtime;
  if (runtime === undefined) {
    throw new Error("Solace DevTools content script requires the extension runtime");
  }

  return runtime;
}

function isDevtoolsExtensionEventMessage(value: unknown): value is DevtoolsExtensionEventMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === DEVTOOLS_EXTENSION_EVENT_TYPE &&
    "event" in value
  );
}

function isDevtoolsContentMessage(value: unknown): value is DevtoolsContentMessage {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (
    value.type === DEVTOOLS_CONTENT_CONNECT_TYPE ||
    value.type === DEVTOOLS_CONTENT_DISCONNECT_TYPE
  ) {
    return true;
  }

  return (
    value.type === DEVTOOLS_CONTROL_EVENT_TYPE &&
    "paused" in value &&
    typeof value.paused === "boolean"
  );
}

function copyDevtoolsEvent(event: unknown): DevtoolsExtensionEventMessage["event"] | undefined {
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
      return { type: event.type, id: event.id, name: event.name };

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
      return { type: event.type, operation: event.operation, tag: event.tag };

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

if (typeof window !== "undefined" && (window as BrowserWindow).chrome?.runtime !== undefined) {
  createContentScriptRelay();
}
