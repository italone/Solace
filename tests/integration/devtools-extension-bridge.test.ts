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
  parentId: null,
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

function dispatchWindowMessage(listener: EventListenerOrEventListenerObject, origin: string): void {
  const event = new MessageEvent("message", {
    data: { type: "devtools:event", event: mountEvent },
    origin,
    source: window,
  });

  if (typeof listener === "function") {
    listener(event);
    return;
  }

  listener.handleEvent(event);
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
      { type: "devtools:event", event: { type: "component:mount", id: 1, name: "Counter", parentId: null } },
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
      { type: "devtools:event", event: { type: "component:mount", id: 1, name: "Counter", parentId: null } },
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
      parentId: null,
    });

    expect(messages).toEqual([
      { type: "devtools:event", event: { type: "component:mount", id: 1, name: "Counter", parentId: null } },
    ]);
  });

  it("ignores page bridge post message failures", async () => {
    const { createDevtoolsPageBridge } =
      await import("../../examples/devtools-extension/src/bridge");
    const session = createDevtoolsSession();
    const bridge = createDevtoolsPageBridge({
      postMessage() {
        throw new Error("page message target unavailable");
      },
      subscribe: session.subscribe,
    });

    expect(() => session.emit(mountEvent)).not.toThrow();

    bridge.disconnect();
  });

  it("clears the page bridge global when the mounted bridge disconnects", async () => {
    const { createDevtoolsPageBridge } =
      await import("../../examples/devtools-extension/src/bridge");
    const firstBridge = createDevtoolsPageBridge({ subscribe: () => () => {} });
    const secondBridge = createDevtoolsPageBridge({ subscribe: () => () => {} });

    window.__solaceDevtoolsPageBridge__ = firstBridge;
    firstBridge.disconnect();
    expect(window.__solaceDevtoolsPageBridge__).toBeUndefined();

    window.__solaceDevtoolsPageBridge__ = secondBridge;
    firstBridge.disconnect();
    expect(window.__solaceDevtoolsPageBridge__).toBe(secondBridge);

    secondBridge.disconnect();
  });

  it("ignores page bridge control messages from unexpected origins", async () => {
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

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: "https://example.invalid",
        data: { type: "devtools:control", paused: true },
      }),
    );
    session.emit(mountEvent);
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: { type: "devtools:control", paused: true },
      }),
    );
    session.emit({ type: "component:update", id: 1, name: "Counter", parentId: null });

    expect(messages).toEqual([
      { type: "devtools:event", event: { type: "component:mount", id: 1, name: "Counter", parentId: null } },
    ]);

    bridge.disconnect();
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

  it("ignores page bridge messages from unexpected origins", async () => {
    const { createContentScriptRelay } =
      await import("../../examples/devtools-extension/src/content-script");
    const messages: unknown[] = [];
    const portListeners = new Set<(message: DevtoolsContentMessage) => void>();
    const windowListeners = new Set<EventListenerOrEventListenerObject>();
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
      injectBridge: vi.fn(),
      removeWindowListener(_type: string, listener: EventListenerOrEventListenerObject) {
        windowListeners.delete(listener);
      },
    });

    for (const listener of portListeners) {
      listener({ type: "devtools:content:connect" });
    }
    for (const listener of windowListeners) {
      dispatchWindowMessage(listener, "https://example.invalid");
      dispatchWindowMessage(listener, window.location.origin);
    }

    expect(messages).toEqual([
      { type: "devtools:event", event: { type: "component:mount", id: 1, name: "Counter", parentId: null } },
    ]);

    stop();
  });

  it("stops content relays when runtime event forwarding fails", async () => {
    const { createContentScriptRelay } =
      await import("../../examples/devtools-extension/src/content-script");
    let runtimeListener: ((message: DevtoolsContentMessage) => void) | undefined;
    const windowListeners = new Set<EventListenerOrEventListenerObject>();
    const port = {
      disconnect: vi.fn(),
      onMessage: {
        addListener(listener: (message: DevtoolsContentMessage) => void) {
          runtimeListener = listener;
        },
        removeListener(listener: (message: DevtoolsContentMessage) => void) {
          if (runtimeListener === listener) {
            runtimeListener = undefined;
          }
        },
      },
      postMessage: vi.fn(() => {
        throw new Error("content runtime port disconnected");
      }),
    } satisfies ContentRuntimePort;

    const stop = createContentScriptRelay({
      addWindowListener(_type: string, listener: EventListenerOrEventListenerObject) {
        windowListeners.add(listener);
      },
      connectRuntime: () => port,
      injectBridge: vi.fn(),
      removeWindowListener(_type: string, listener: EventListenerOrEventListenerObject) {
        windowListeners.delete(listener);
      },
    });

    runtimeListener?.({ type: "devtools:content:connect" });
    const [windowListener] = windowListeners;

    expect(() => dispatchWindowMessage(windowListener, window.location.origin)).not.toThrow();
    expect(port.postMessage).toHaveBeenCalledTimes(1);
    expect(port.disconnect).toHaveBeenCalledTimes(1);
    expect(runtimeListener).toBeUndefined();
    expect(windowListeners.size).toBe(0);

    stop();

    expect(port.disconnect).toHaveBeenCalledTimes(1);
  });

  it("resumes the page bridge when content capture reconnects", async () => {
    const { createContentScriptRelay } =
      await import("../../examples/devtools-extension/src/content-script");
    let runtimeListener: ((message: DevtoolsContentMessage) => void) | undefined;
    const postWindowMessage = vi.spyOn(window, "postMessage");
    const port = {
      disconnect: vi.fn(),
      onMessage: {
        addListener(listener: (message: DevtoolsContentMessage) => void) {
          runtimeListener = listener;
        },
        removeListener(listener: (message: DevtoolsContentMessage) => void) {
          if (runtimeListener === listener) {
            runtimeListener = undefined;
          }
        },
      },
      postMessage: vi.fn(),
    } satisfies ContentRuntimePort;

    const stop = createContentScriptRelay({
      connectRuntime: () => port,
      injectBridge: vi.fn(),
    });

    runtimeListener?.({ type: "devtools:content:connect" });
    runtimeListener?.({ type: "devtools:content:disconnect" });
    runtimeListener?.({ type: "devtools:content:connect" });

    expect(postWindowMessage).toHaveBeenCalledWith(
      { type: "devtools:control", paused: true },
      window.location.origin,
    );
    expect(postWindowMessage).toHaveBeenCalledWith(
      { type: "devtools:control", paused: false },
      window.location.origin,
    );

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

  it("serializes content events before forwarding them to panels", async () => {
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
    const panelPort = createRuntimePort("solace-devtools-panel");

    createDevtoolsBackgroundRelay(runtime);
    for (const listener of runtimeListeners) {
      listener(contentPort);
      listener(panelPort);
    }

    panelPort.emit({ type: "devtools:panel:connect", tabId: 7 });
    contentPort.emit({
      type: "devtools:event",
      event: {
        ...mountEvent,
        target: { count: 1 },
        vnode: { type: "button" },
      },
    } as never);
    contentPort.emit({ type: "devtools:event", event: { type: "component:mount" } } as never);

    expect(panelPort.messages).toEqual([
      { type: "devtools:event", event: { type: "component:mount", id: 1, name: "Counter", parentId: null } },
    ]);
  });

  it("continues forwarding content events when one panel port rejects messages", async () => {
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
    const brokenPanelPort = createRuntimePort("solace-devtools-panel");
    const panelPort = createRuntimePort("solace-devtools-panel");
    brokenPanelPort.postMessage = () => {
      throw new Error("panel port disconnected");
    };

    createDevtoolsBackgroundRelay(runtime);
    for (const listener of runtimeListeners) {
      listener(contentPort);
      listener(brokenPanelPort);
      listener(panelPort);
    }

    brokenPanelPort.emit({ type: "devtools:panel:connect", tabId: 7 });
    panelPort.emit({ type: "devtools:panel:connect", tabId: 7 });

    expect(() => contentPort.emit({ type: "devtools:event", event: mountEvent })).not.toThrow();
    expect(panelPort.messages).toEqual([
      { type: "devtools:event", event: { type: "component:mount", id: 1, name: "Counter", parentId: null } },
    ]);
  });

  it("drops panel ports that reject forwarded content events", async () => {
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
    const brokenPanelPort = createRuntimePort("solace-devtools-panel");
    const healthyPanelPort = createRuntimePort("solace-devtools-panel");
    const brokenPostMessage = vi.fn(() => {
      throw new Error("panel port disconnected");
    });
    brokenPanelPort.postMessage = brokenPostMessage;

    createDevtoolsBackgroundRelay(runtime);
    for (const listener of runtimeListeners) {
      listener(contentPort);
      listener(brokenPanelPort);
      listener(healthyPanelPort);
    }

    brokenPanelPort.emit({ type: "devtools:panel:connect", tabId: 7 });
    healthyPanelPort.emit({ type: "devtools:panel:connect", tabId: 7 });
    contentPort.emit({ type: "devtools:event", event: mountEvent });
    contentPort.emit({ type: "devtools:event", event: mountEvent });

    expect(brokenPanelPort.messages).toEqual([]);
    expect(brokenPostMessage).toHaveBeenCalledTimes(1);
    expect(healthyPanelPort.messages).toEqual([
      { type: "devtools:event", event: { type: "component:mount", id: 1, name: "Counter", parentId: null } },
      { type: "devtools:event", event: { type: "component:mount", id: 1, name: "Counter", parentId: null } },
    ]);
  });

  it("drops content ports that reject panel-present connect notifications", async () => {
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
    const panelPort = createRuntimePort("solace-devtools-panel");
    const brokenContentPort = createRuntimePort("solace-devtools-content", 7);
    const healthyContentPort = createRuntimePort("solace-devtools-content", 7);
    const brokenPostMessage = vi.fn(() => {
      throw new Error("content port disconnected");
    });
    brokenContentPort.postMessage = brokenPostMessage;

    createDevtoolsBackgroundRelay(runtime);
    for (const listener of runtimeListeners) {
      listener(panelPort);
    }
    panelPort.emit({ type: "devtools:panel:connect", tabId: 7 });

    for (const listener of runtimeListeners) {
      expect(() => listener(brokenContentPort)).not.toThrow();
      listener(healthyContentPort);
    }
    panelPort.emit({ type: "devtools:control", paused: true });

    expect(brokenContentPort.messages).toEqual([]);
    expect(brokenPostMessage).toHaveBeenCalledTimes(1);
    expect(healthyContentPort.messages).toEqual([
      { type: "devtools:content:connect" },
      { type: "devtools:control", paused: true },
    ]);
  });

  it("keeps a panel scoped to its latest connected tab", async () => {
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
    const firstContentPort = createRuntimePort("solace-devtools-content", 7);
    const secondContentPort = createRuntimePort("solace-devtools-content", 8);
    const panelPort = createRuntimePort("solace-devtools-panel");

    createDevtoolsBackgroundRelay(runtime);
    for (const listener of runtimeListeners) {
      listener(firstContentPort);
      listener(secondContentPort);
      listener(panelPort);
    }

    panelPort.emit({ type: "devtools:panel:connect", tabId: 7 });
    panelPort.emit({ type: "devtools:panel:connect", tabId: 8 });

    firstContentPort.emit({ type: "devtools:event", event: mountEvent });
    secondContentPort.emit({ type: "devtools:event", event: mountEvent });

    expect(firstContentPort.messages).toEqual([
      { type: "devtools:content:connect" },
      { type: "devtools:content:disconnect" },
    ]);
    expect(secondContentPort.messages).toEqual([{ type: "devtools:content:connect" }]);
    expect(panelPort.messages).toEqual([
      { type: "devtools:event", event: { type: "component:mount", id: 1, name: "Counter", parentId: null } },
    ]);
  });

  it("does not send duplicate disconnects to a panel's previous tab after tab switching", async () => {
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
    const firstContentPort = createRuntimePort("solace-devtools-content", 7);
    const secondContentPort = createRuntimePort("solace-devtools-content", 8);
    const panelPort = createRuntimePort("solace-devtools-panel");

    createDevtoolsBackgroundRelay(runtime);
    for (const listener of runtimeListeners) {
      listener(firstContentPort);
      listener(secondContentPort);
      listener(panelPort);
    }

    panelPort.emit({ type: "devtools:panel:connect", tabId: 7 });
    panelPort.emit({ type: "devtools:panel:connect", tabId: 8 });
    panelPort.disconnect();

    expect(firstContentPort.messages).toEqual([
      { type: "devtools:content:connect" },
      { type: "devtools:content:disconnect" },
    ]);
    expect(secondContentPort.messages).toEqual([
      { type: "devtools:content:connect" },
      { type: "devtools:content:disconnect" },
    ]);
  });

  it("ignores duplicate panel connections for the same tab", async () => {
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
    const panelPort = createRuntimePort("solace-devtools-panel");

    createDevtoolsBackgroundRelay(runtime);
    for (const listener of runtimeListeners) {
      listener(contentPort);
      listener(panelPort);
    }

    panelPort.emit({ type: "devtools:panel:connect", tabId: 7 });
    panelPort.emit({ type: "devtools:panel:connect", tabId: 7 });
    panelPort.disconnect();

    expect(contentPort.messages).toEqual([
      { type: "devtools:content:connect" },
      { type: "devtools:content:disconnect" },
    ]);
  });

  it("ignores duplicate content connections for the same port", async () => {
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
    const panelPort = createRuntimePort("solace-devtools-panel");

    createDevtoolsBackgroundRelay(runtime);
    for (const listener of runtimeListeners) {
      listener(contentPort);
      listener(contentPort);
      listener(panelPort);
    }

    panelPort.emit({ type: "devtools:panel:connect", tabId: 7 });
    contentPort.emit({ type: "devtools:event", event: mountEvent });

    expect(contentPort.messages).toEqual([{ type: "devtools:content:connect" }]);
    expect(panelPort.messages).toEqual([
      { type: "devtools:event", event: { type: "component:mount", id: 1, name: "Counter", parentId: null } },
    ]);
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

  it("does not reactivate content relays after stop", async () => {
    const { createContentScriptRelay } =
      await import("../../examples/devtools-extension/src/content-script");
    let runtimeListener: ((message: DevtoolsContentMessage) => void) | undefined;
    const windowListeners = new Set<EventListenerOrEventListenerObject>();
    const injectBridge = vi.fn();
    const port = {
      disconnect: vi.fn(),
      onMessage: {
        addListener(listener: (message: DevtoolsContentMessage) => void) {
          runtimeListener = listener;
        },
        removeListener(listener: (message: DevtoolsContentMessage) => void) {
          if (runtimeListener === listener) {
            runtimeListener = undefined;
          }
        },
      },
      postMessage: vi.fn(),
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
    const staleRuntimeListener = runtimeListener;

    stop();
    staleRuntimeListener?.({ type: "devtools:content:connect" });
    stop();

    expect(injectBridge).not.toHaveBeenCalled();
    expect(windowListeners.size).toBe(0);
    expect(port.disconnect).toHaveBeenCalledTimes(1);
  });

  it("ignores content relay stop disconnect failures", async () => {
    const { createContentScriptRelay } =
      await import("../../examples/devtools-extension/src/content-script");
    let runtimeListener: ((message: DevtoolsContentMessage) => void) | undefined;
    const windowListeners = new Set<EventListenerOrEventListenerObject>();
    const port = {
      disconnect: vi.fn(() => {
        throw new Error("content runtime port already disconnected");
      }),
      onMessage: {
        addListener(listener: (message: DevtoolsContentMessage) => void) {
          runtimeListener = listener;
        },
        removeListener(listener: (message: DevtoolsContentMessage) => void) {
          if (runtimeListener === listener) {
            runtimeListener = undefined;
          }
        },
      },
      postMessage: vi.fn(),
    } satisfies ContentRuntimePort;

    const stop = createContentScriptRelay({
      addWindowListener(_type: string, listener: EventListenerOrEventListenerObject) {
        windowListeners.add(listener);
      },
      connectRuntime: () => port,
      injectBridge: vi.fn(),
      removeWindowListener(_type: string, listener: EventListenerOrEventListenerObject) {
        windowListeners.delete(listener);
      },
    });

    runtimeListener?.({ type: "devtools:content:connect" });

    expect(() => stop()).not.toThrow();
    expect(port.disconnect).toHaveBeenCalledTimes(1);
    expect(runtimeListener).toBeUndefined();
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
