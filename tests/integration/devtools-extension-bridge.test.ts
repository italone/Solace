import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DevtoolsEvent, DevtoolsEventListener } from "@italone/solace/devtools";

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
});
