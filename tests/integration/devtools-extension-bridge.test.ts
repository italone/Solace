import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DevtoolsEvent, DevtoolsEventListener } from "@italone/solace/devtools";
import type {
  DevtoolsContentMessage,
  RuntimePort as ContentRuntimePort,
} from "../../examples/devtools-extension/src/content-script";
import type {
  BackgroundRuntime,
  DevtoolsBackgroundMessage,
  RuntimePort as BackgroundRuntimePort,
} from "../../examples/devtools-extension/src/background";

type Unsubscribe = () => void;

vi.mock("@italone/solace/devtools", () => ({
  onDevtoolsEvent: vi.fn(),
}));

const mountEvent: DevtoolsEvent = {
  type: "component:mount",
  id: 1,
  name: "Counter",
};

function createDevtoolsSession() {
  const listeners = new Set<DevtoolsEventListener>();

  return {
    emit(event: DevtoolsEvent) {
      for (const listener of listeners) {
        listener(event);
      }
    },
    subscribe(listener: DevtoolsEventListener): Unsubscribe {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}

describe("devtools extension bridge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("subscribes through the public DevTools API only", async () => {
    const bridgeSource = await readFile(
      resolve("examples/devtools-extension/src/bridge.ts"),
      "utf8",
    );

    expect(bridgeSource).toContain(`from "@italone/solace/devtools"`);
    expect(bridgeSource).not.toContain("../../src/devtools");
    expect(bridgeSource).not.toContain("emitDevtoolsEvent");
    expect(bridgeSource).not.toContain("clearDevtoolsListeners");
    expect(bridgeSource).not.toContain("hasDevtoolsListeners");
    expect(bridgeSource).not.toContain("serializeDevtoolsEvent");
  });

  it("relays serialized DevTools events without runtime objects", async () => {
    const { createDevtoolsPageBridge } =
      await import("../../examples/devtools-extension/src/bridge");
    const session = createDevtoolsSession();
    const messages: unknown[] = [];
    const rawRuntimeObjects = {
      node: document.createElement("button"),
      vnode: { type: "button", props: { onClick: () => undefined } },
      target: { count: 1 },
    };

    createDevtoolsPageBridge({
      postMessage(message) {
        messages.push(message);
      },
      subscribe: session.subscribe,
    });
    session.emit({
      ...mountEvent,
      ...rawRuntimeObjects,
    } as DevtoolsEvent);

    expect(messages).toEqual([
      { type: "devtools:event", event: { type: "component:mount", id: 1, name: "Counter" } },
    ]);
    expect(JSON.stringify(messages)).not.toContain("node");
    expect(JSON.stringify(messages)).not.toContain("vnode");
    expect(JSON.stringify(messages)).not.toContain("target");
  });

  it("keeps capture scoped to the browser session transport", async () => {
    const { createDevtoolsPageBridge } =
      await import("../../examples/devtools-extension/src/bridge");
    const firstSession = createDevtoolsSession();
    const secondSession = createDevtoolsSession();
    const firstMessages: unknown[] = [];
    const secondMessages: unknown[] = [];

    createDevtoolsPageBridge({
      postMessage(message) {
        firstMessages.push(message);
      },
      subscribe: firstSession.subscribe,
    });
    createDevtoolsPageBridge({
      postMessage(message) {
        secondMessages.push(message);
      },
      subscribe: secondSession.subscribe,
    });

    firstSession.emit(mountEvent);

    expect(firstMessages).toEqual([
      { type: "devtools:event", event: { type: "component:mount", id: 1, name: "Counter" } },
    ]);
    expect(secondMessages).toEqual([]);
  });

  it("stops forwarding when paused or disconnected", async () => {
    const { createDevtoolsPageBridge } =
      await import("../../examples/devtools-extension/src/bridge");
    const session = createDevtoolsSession();
    const messages: unknown[] = [];
    const bridge = createDevtoolsPageBridge({
      postMessage(message) {
        messages.push(message);
      },
      subscribe: session.subscribe,
    });

    bridge.pause();
    session.emit(mountEvent);
    bridge.resume();
    session.emit(mountEvent);
    bridge.disconnect();
    session.emit({
      type: "component:update",
      id: 1,
      name: "Counter",
    });

    expect(messages).toEqual([
      { type: "devtools:event", event: { type: "component:mount", id: 1, name: "Counter" } },
    ]);
  });

  it("waits for a tab-scoped panel activation before injecting the page bridge", async () => {
    const { createContentScriptRelay } =
      await import("../../examples/devtools-extension/src/content-script");
    const messages: unknown[] = [];
    const portListeners = new Set<(message: DevtoolsContentMessage) => void>();
    const windowListeners = new Set<EventListenerOrEventListenerObject>();
    const injectBridge = vi.fn();
    const port = {
      disconnect: vi.fn(),
      onMessage: {
        addListener(listener: (message: DevtoolsContentMessage) => void) {
          portListeners.add(listener);
        },
        removeListener(listener: (message: DevtoolsContentMessage) => void) {
          portListeners.delete(listener);
        },
      },
      postMessage(message: unknown) {
        messages.push(message);
      },
    } satisfies ContentRuntimePort;

    const stop = createContentScriptRelay({
      addWindowListener(_type: string, listener: EventListenerOrEventListenerObject) {
        windowListeners.add(listener);
      },
      connectRuntime: () => port,
      injectBridge,
      removeWindowListener(_type: string, listener: EventListenerOrEventListenerObject) {
        windowListeners.delete(listener);
      },
    });

    expect(injectBridge).not.toHaveBeenCalled();
    expect(windowListeners.size).toBe(0);

    for (const listener of portListeners) {
      listener({ type: "devtools:content:connect" });
    }

    expect(injectBridge).toHaveBeenCalledTimes(1);
    expect(windowListeners.size).toBe(1);

    stop();
  });

  it("activates content scripts only after a panel connects for the same tab", async () => {
    const { createDevtoolsBackgroundRelay } =
      await import("../../examples/devtools-extension/src/background");
    const runtimeListeners = new Set<(port: BackgroundRuntimePort) => void>();
    const runtime = {
      onConnect: {
        addListener(listener: (port: BackgroundRuntimePort) => void) {
          runtimeListeners.add(listener);
        },
        removeListener(listener: (port: BackgroundRuntimePort) => void) {
          runtimeListeners.delete(listener);
        },
      },
    } satisfies BackgroundRuntime;
    const contentPort = createRuntimePort("solace-devtools-content", 7);
    const otherContentPort = createRuntimePort("solace-devtools-content", 8);
    const panelPort = createRuntimePort("solace-devtools-panel");

    createDevtoolsBackgroundRelay(runtime);
    for (const listener of runtimeListeners) {
      listener(contentPort);
      listener(otherContentPort);
      listener(panelPort);
    }

    expect(contentPort.messages).toEqual([]);
    expect(otherContentPort.messages).toEqual([]);

    panelPort.emit({ type: "devtools:panel:connect", tabId: 7 });

    expect(contentPort.messages).toEqual([{ type: "devtools:content:connect" }]);
    expect(otherContentPort.messages).toEqual([]);
  });

  it("ignores content ports without a sender tab id", async () => {
    const { createDevtoolsBackgroundRelay } =
      await import("../../examples/devtools-extension/src/background");
    const runtimeListeners = new Set<(port: BackgroundRuntimePort) => void>();
    const runtime = {
      onConnect: {
        addListener(listener: (port: BackgroundRuntimePort) => void) {
          runtimeListeners.add(listener);
        },
        removeListener(listener: (port: BackgroundRuntimePort) => void) {
          runtimeListeners.delete(listener);
        },
      },
    } satisfies BackgroundRuntime;
    const contentPort = createRuntimePort("solace-devtools-content");

    createDevtoolsBackgroundRelay(runtime);

    for (const listener of runtimeListeners) {
      expect(() => listener(contentPort)).not.toThrow();
    }

    expect(contentPort.messages).toEqual([]);
  });

  it("ignores malformed content runtime messages", async () => {
    const { createContentScriptRelay } =
      await import("../../examples/devtools-extension/src/content-script");
    const portListeners = new Set<(message: DevtoolsContentMessage) => void>();
    const windowListeners = new Set<EventListenerOrEventListenerObject>();
    const injectBridge = vi.fn();
    const port = {
      disconnect: vi.fn(),
      onMessage: {
        addListener(listener: (message: DevtoolsContentMessage) => void) {
          portListeners.add(listener);
        },
        removeListener(listener: (message: DevtoolsContentMessage) => void) {
          portListeners.delete(listener);
        },
      },
      postMessage: vi.fn(),
    } satisfies ContentRuntimePort;

    createContentScriptRelay({
      addWindowListener(_type: string, listener: EventListenerOrEventListenerObject) {
        windowListeners.add(listener);
      },
      connectRuntime: () => port,
      injectBridge,
      removeWindowListener(_type: string, listener: EventListenerOrEventListenerObject) {
        windowListeners.delete(listener);
      },
    });

    for (const listener of portListeners) {
      expect(() => listener(null as never)).not.toThrow();
      expect(() => listener({ type: "unknown" } as never)).not.toThrow();
    }

    expect(injectBridge).not.toHaveBeenCalled();
    expect(windowListeners.size).toBe(0);
  });
});

function createRuntimePort(name: string, tabId?: number) {
  const messageListeners = new Set<(message: DevtoolsBackgroundMessage) => void>();
  const disconnectListeners = new Set<(port: BackgroundRuntimePort) => void>();
  const port = {
    name,
    sender: tabId === undefined ? undefined : { tab: { id: tabId } },
    messages: [] as DevtoolsBackgroundMessage[],
    onDisconnect: {
      addListener(listener: (port: BackgroundRuntimePort) => void) {
        disconnectListeners.add(listener);
      },
      removeListener(listener: (port: BackgroundRuntimePort) => void) {
        disconnectListeners.delete(listener);
      },
    },
    onMessage: {
      addListener(listener: (message: DevtoolsBackgroundMessage) => void) {
        messageListeners.add(listener);
      },
      removeListener(listener: (message: DevtoolsBackgroundMessage) => void) {
        messageListeners.delete(listener);
      },
    },
    disconnect() {
      for (const listener of disconnectListeners) {
        listener(port);
      }
    },
    emit(message: DevtoolsBackgroundMessage) {
      for (const listener of messageListeners) {
        listener(message);
      }
    },
    postMessage(message: DevtoolsBackgroundMessage) {
      port.messages.push(message);
    },
  } satisfies BackgroundRuntimePort & {
    emit(message: DevtoolsBackgroundMessage): void;
    messages: DevtoolsBackgroundMessage[];
  };

  return port;
}
