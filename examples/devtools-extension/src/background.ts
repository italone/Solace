import type { DevtoolsExtensionEventMessage } from "./bridge";

export const DEVTOOLS_PANEL_PORT = "solace-devtools-panel";
export const DEVTOOLS_CONTENT_PORT = "solace-devtools-content";

export type DevtoolsBackgroundMessage =
  | DevtoolsExtensionEventMessage
  | { type: "devtools:panel:connect"; tabId: number }
  | { type: "devtools:control"; paused: boolean };

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
      registerPort(contentsByTab, getSenderTabId(port), port);
      port.onMessage.addListener((message) => {
        if (message.type === "devtools:event") {
          forwardToPorts(panelsByTab.get(getSenderTabId(port)), message);
        }
      });
      return;
    }

    if (port.name !== DEVTOOLS_PANEL_PORT) {
      return;
    }

    port.onMessage.addListener((message) => {
      if (message.type === "devtools:panel:connect") {
        registerPort(panelsByTab, message.tabId, port);
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
): void {
  const ports = portsByTab.get(tabId) ?? new Set<RuntimePort>();
  ports.add(port);
  portsByTab.set(tabId, ports);
  port.onDisconnect.addListener(() => {
    ports.delete(port);
    if (ports.size === 0) {
      portsByTab.delete(tabId);
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

function getSenderTabId(port: RuntimePort): number {
  const tabId = port.sender?.tab?.id;
  if (tabId === undefined) {
    throw new Error("Solace DevTools relay requires a browser tab id");
  }

  return tabId;
}

declare const chrome:
  | {
      runtime?: BackgroundRuntime;
    }
  | undefined;

if (typeof chrome !== "undefined" && chrome.runtime !== undefined) {
  createDevtoolsBackgroundRelay(chrome.runtime);
}
