import { DEVTOOLS_EXTENSION_EVENT_TYPE, type DevtoolsExtensionEventMessage } from "./bridge";

export const DEVTOOLS_CONTENT_PORT = "solace-devtools-content";
export const DEVTOOLS_BRIDGE_SCRIPT = "bridge.js";

export interface RuntimePort {
  disconnect(): void;
  postMessage(message: DevtoolsExtensionEventMessage): void;
}

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

declare global {
  interface Window {
    chrome?: {
      runtime?: BrowserRuntime;
    };
  }
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

  const relayMessage = (event: Event) => {
    const messageEvent = event as MessageEvent<unknown>;
    if (messageEvent.source !== window || !isDevtoolsExtensionEventMessage(messageEvent.data)) {
      return;
    }

    port.postMessage(messageEvent.data);
  };

  injectBridge();
  addWindowListener("message", relayMessage);

  return () => {
    removeWindowListener("message", relayMessage);
    port.disconnect();
  };
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
  const runtime = window.chrome?.runtime;
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

if (typeof window !== "undefined" && window.chrome?.runtime !== undefined) {
  createContentScriptRelay();
}
