import { copyDevtoolsEvent, DEVTOOLS_EXTENSION_EVENT_TYPE } from "./bridge";
import type { DevtoolsExtensionEventMessage } from "./bridge";

export const DEVTOOLS_PANEL_PORT = "solace-devtools-panel";
export const DEVTOOLS_CONTENT_PORT = "solace-devtools-content";
const DEVTOOLS_CONTENT_CONNECT_TYPE = "devtools:content:connect";
const DEVTOOLS_CONTENT_DISCONNECT_TYPE = "devtools:content:disconnect";

export type DevtoolsBackgroundMessage =
  | DevtoolsExtensionEventMessage
  | { type: "devtools:panel:connect"; tabId: number }
  | { type: "devtools:control"; paused: boolean }
  | { type: typeof DEVTOOLS_CONTENT_CONNECT_TYPE }
  | { type: typeof DEVTOOLS_CONTENT_DISCONNECT_TYPE };

export interface RuntimePort {
  name: string;
  sender?: {
    tab?: {
      id?: number;
    };
  };
  onDisconnect: RuntimeEvent<RuntimePort>;
  onMessage: RuntimeEvent<DevtoolsBackgroundMessage>;
  disconnect(): void;
  postMessage(message: DevtoolsBackgroundMessage): void;
}

export interface RuntimeEvent<T> {
  addListener(listener: (value: T) => void): void;
  removeListener?(listener: (value: T) => void): void;
}

export interface BackgroundRuntime {
  onConnect: RuntimeEvent<RuntimePort>;
}

export interface DevtoolsBackgroundRelay {
  disconnect(): void;
}

export function createDevtoolsBackgroundRelay(runtime: BackgroundRuntime): DevtoolsBackgroundRelay {
  const panelsByTab = new Map<number, Set<RuntimePort>>();
  const contentsByTab = new Map<number, Set<RuntimePort>>();

  const handleConnect = (port: RuntimePort) => {
    if (port.name === DEVTOOLS_CONTENT_PORT) {
      const tabId = getSenderTabId(port);
      if (tabId === undefined) {
        return;
      }
      registerPort(contentsByTab, tabId, port);
      if (panelsByTab.has(tabId)) {
        port.postMessage({ type: DEVTOOLS_CONTENT_CONNECT_TYPE });
      }
      port.onMessage.addListener((message) => {
        if (message.type === DEVTOOLS_EXTENSION_EVENT_TYPE) {
          const event = copyDevtoolsEvent(message.event);
          if (event !== undefined) {
            forwardToPorts(panelsByTab.get(tabId), { type: DEVTOOLS_EXTENSION_EVENT_TYPE, event });
          }
        }
      });
      return;
    }

    if (port.name !== DEVTOOLS_PANEL_PORT) {
      return;
    }

    port.onMessage.addListener((message) => {
      if (message.type === "devtools:panel:connect") {
        if (!isValidTabId(message.tabId)) {
          return;
        }
        registerPort(panelsByTab, message.tabId, port, (tabId) => {
          forwardToPorts(contentsByTab.get(tabId), { type: DEVTOOLS_CONTENT_DISCONNECT_TYPE });
        });
        forwardToPorts(contentsByTab.get(message.tabId), { type: DEVTOOLS_CONTENT_CONNECT_TYPE });
        return;
      }

      if (message.type === "devtools:control") {
        const panelTab = findPortTab(panelsByTab, port);
        if (panelTab !== undefined) {
          forwardToPorts(contentsByTab.get(panelTab), message);
        }
      }
    });
  };

  runtime.onConnect.addListener(handleConnect);

  return {
    disconnect() {
      runtime.onConnect.removeListener?.(handleConnect);
      panelsByTab.clear();
      contentsByTab.clear();
    },
  };
}

function registerPort(
  portsByTab: Map<number, Set<RuntimePort>>,
  tabId: number,
  port: RuntimePort,
  onEmpty?: (tabId: number) => void,
): void {
  const ports = portsByTab.get(tabId) ?? new Set<RuntimePort>();
  ports.add(port);
  portsByTab.set(tabId, ports);
  port.onDisconnect.addListener(() => {
    ports.delete(port);
    if (ports.size === 0) {
      portsByTab.delete(tabId);
      onEmpty?.(tabId);
    }
  });
}

function forwardToPorts(
  ports: Set<RuntimePort> | undefined,
  message: DevtoolsBackgroundMessage,
): void {
  if (ports === undefined) {
    return;
  }

  for (const port of ports) {
    port.postMessage(message);
  }
}

function findPortTab(
  portsByTab: Map<number, Set<RuntimePort>>,
  port: RuntimePort,
): number | undefined {
  for (const [tabId, ports] of portsByTab) {
    if (ports.has(port)) {
      return tabId;
    }
  }

  return undefined;
}

function getSenderTabId(port: RuntimePort): number | undefined {
  const tabId = port.sender?.tab?.id;
  return isValidTabId(tabId) ? tabId : undefined;
}

function isValidTabId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

declare const chrome:
  | {
      runtime?: BackgroundRuntime;
    }
  | undefined;

if (typeof chrome !== "undefined" && chrome.runtime !== undefined) {
  createDevtoolsBackgroundRelay(chrome.runtime);
}
