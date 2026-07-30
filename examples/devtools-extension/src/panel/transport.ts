import type { DevtoolsEvent } from "@italone/solace/devtools";

export interface PanelEventSource {
  setPaused(paused: boolean): void;
  stop(): void;
}

export interface CreatePanelEventSourceOptions {
  connectRuntime?: () => RuntimePort | undefined;
  inspectedTabId?: number;
  subscribe?: (listener: (event: DevtoolsEvent) => void) => () => void;
  windowTarget?: Window;
}

interface RuntimePort {
  disconnect(): void;
  onMessage: RuntimeEvent<PanelTransportMessage>;
  postMessage(message: PanelTransportMessage): void;
}

interface RuntimeEvent<T> {
  addListener(listener: (message: T) => void): void;
  removeListener?(listener: (message: T) => void): void;
}

type PanelTransportMessage =
  | { type: "devtools:event"; event: DevtoolsEvent }
  | { type: "devtools:panel:connect"; tabId: number }
  | { type: "devtools:control"; paused: boolean };

interface BrowserRuntime {
  connect(options: { name: string }): RuntimePort;
  getURL?: (path: string) => string;
}

interface BrowserWindow extends Window {
  chrome?: {
    devtools?: {
      inspectedWindow?: {
        tabId?: number;
      };
    };
    runtime?: BrowserRuntime;
  };
}

export function createPanelEventSource(
  onEvent: (event: DevtoolsEvent) => void,
  options: CreatePanelEventSourceOptions = {},
): PanelEventSource {
  const windowTarget = options.windowTarget ?? window;
  const inspectedTabId =
    options.inspectedTabId ?? getBrowserChrome(windowTarget)?.devtools?.inspectedWindow?.tabId;
  const connectRuntime = options.connectRuntime ?? (() => connectDefaultRuntime(windowTarget));

  if (inspectedTabId !== undefined) {
    const port = connectRuntime();
    if (port === undefined) {
      return createLocalPanelEventSource(onEvent, {
        subscribe: options.subscribe,
        windowTarget,
      });
    }

    return createExtensionPanelEventSource(port, inspectedTabId, onEvent);
  }

  return createLocalPanelEventSource(onEvent, {
    subscribe: options.subscribe,
    windowTarget,
  });
}

function createExtensionPanelEventSource(
  port: RuntimePort,
  inspectedTabId: number,
  onEvent: (event: DevtoolsEvent) => void,
): PanelEventSource {
  const handleMessage = (message: PanelTransportMessage) => {
    if (message.type === "devtools:event") {
      const event = copyDevtoolsEvent(message.event);
      if (event !== undefined) {
        onEvent(event);
      }
    }
  };

  port.onMessage.addListener(handleMessage);
  port.postMessage({ type: "devtools:panel:connect", tabId: inspectedTabId });

  return {
    setPaused(paused) {
      port.postMessage({ type: "devtools:control", paused });
    },
    stop() {
      port.onMessage.removeListener?.(handleMessage);
      port.disconnect();
    },
  };
}

function createLocalPanelEventSource(
  onEvent: (event: DevtoolsEvent) => void,
  options: Pick<CreatePanelEventSourceOptions, "subscribe" | "windowTarget">,
): PanelEventSource {
  const windowTarget = options.windowTarget ?? window;
  const unsubscribe = options.subscribe?.(onEvent) ?? (() => {});
  const handleMessage = (message: MessageEvent<unknown>) => {
    if (message.source !== windowTarget || !isDevtoolsEventMessage(message.data)) {
      return;
    }

    const event = copyDevtoolsEvent(message.data.event);
    if (event !== undefined) {
      onEvent(event);
    }
  };

  windowTarget.addEventListener("message", handleMessage);

  return {
    setPaused() {},
    stop() {
      windowTarget.removeEventListener("message", handleMessage);
      unsubscribe();
    },
  };
}

function connectDefaultRuntime(windowTarget: Window): RuntimePort | undefined {
  return getBrowserChrome(windowTarget)?.runtime?.connect({ name: "solace-devtools-panel" });
}

function getBrowserChrome(windowTarget: Window): BrowserWindow["chrome"] {
  return (windowTarget as BrowserWindow).chrome;
}

function isDevtoolsEventMessage(
  value: unknown,
): value is Extract<PanelTransportMessage, { type: "devtools:event" }> {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "devtools:event" &&
    "event" in value
  );
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
