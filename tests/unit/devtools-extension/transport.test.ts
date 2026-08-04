import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DevtoolsEvent } from "@italone/solace/devtools";
import type { CreatePanelEventSourceOptions } from "../../../examples/devtools-extension/src/panel/transport";

type PanelRuntimePort = Exclude<
  ReturnType<NonNullable<CreatePanelEventSourceOptions["connectRuntime"]>>,
  undefined
>;

const onDevtoolsEvent = vi.fn();

vi.mock("@italone/solace/devtools", () => ({
  onDevtoolsEvent,
}));

describe("devtools extension panel transport", () => {
  beforeEach(() => {
    onDevtoolsEvent.mockReset();
  });

  it("does not subscribe to the panel page DevTools bus in local preview mode", async () => {
    const { createPanelEventSource } =
      await import("../../../examples/devtools-extension/src/panel/transport");
    const observed: DevtoolsEvent[] = [];

    const source = createPanelEventSource((event) => {
      observed.push(event);
    });

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: {
          type: "devtools:event",
          event: { type: "component:update", id: 1, name: "Counter" },
        },
      }),
    );
    await vi.waitFor(() => {
      expect(observed).toEqual([{ type: "component:update", id: 1, name: "Counter" }]);
    });

    expect(onDevtoolsEvent).not.toHaveBeenCalled();

    source.stop();
  });

  it("ignores non-public DevTools event payloads from local preview messages", async () => {
    const { createPanelEventSource } =
      await import("../../../examples/devtools-extension/src/panel/transport");
    const observed: DevtoolsEvent[] = [];

    const source = createPanelEventSource((event) => {
      observed.push(event);
    });

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: {
          type: "devtools:event",
          event: { type: "component:mount", id: 1, name: "Counter", vnode: { type: "button" } },
        },
      }),
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: {
          type: "devtools:event",
          event: { type: "unknown:event", node: document.createElement("button") },
        },
      }),
    );

    expect(observed).toEqual([{ type: "component:mount", id: 1, name: "Counter" }]);

    source.stop();
  });

  it("ignores local preview messages from unexpected origins", async () => {
    const { createPanelEventSource } =
      await import("../../../examples/devtools-extension/src/panel/transport");
    const observed: DevtoolsEvent[] = [];

    const source = createPanelEventSource((event) => {
      observed.push(event);
    });

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: "https://example.invalid",
        data: {
          type: "devtools:event",
          event: { type: "component:mount", id: 1, name: "Counter" },
        },
      }),
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: {
          type: "devtools:event",
          event: { type: "component:update", id: 1, name: "Counter" },
        },
      }),
    );

    expect(observed).toEqual([{ type: "component:update", id: 1, name: "Counter" }]);

    source.stop();
  });

  it("stops local preview event sources only once", async () => {
    const { createPanelEventSource } =
      await import("../../../examples/devtools-extension/src/panel/transport");
    const unsubscribe = vi.fn();
    const removeWindowListener = vi.spyOn(window, "removeEventListener");

    const source = createPanelEventSource(() => {}, {
      subscribe: () => unsubscribe,
    });

    source.stop();
    source.stop();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(removeWindowListener).toHaveBeenCalledTimes(1);
  });

  it("ignores malformed extension runtime messages", async () => {
    const { createPanelEventSource } =
      await import("../../../examples/devtools-extension/src/panel/transport");
    const observed: DevtoolsEvent[] = [];
    const portListeners = new Set<(message: unknown) => void>();
    const port = {
      disconnect: vi.fn(),
      onMessage: {
        addListener(listener: (message: unknown) => void) {
          portListeners.add(listener);
        },
        removeListener(listener: (message: unknown) => void) {
          portListeners.delete(listener);
        },
      },
      postMessage: vi.fn(),
    } satisfies PanelRuntimePort;

    const source = createPanelEventSource(
      (event) => {
        observed.push(event);
      },
      {
        connectRuntime: () => port,
        inspectedTabId: 7,
      },
    );

    for (const listener of portListeners) {
      expect(() => listener(null)).not.toThrow();
      expect(() => listener({ type: "unknown" })).not.toThrow();
      expect(() => listener({ type: "devtools:event" })).not.toThrow();
      listener({
        type: "devtools:event",
        event: { type: "component:update", id: 1, name: "Counter", target: { count: 1 } },
      });
    }

    expect(port.postMessage).toHaveBeenCalledWith({ type: "devtools:panel:connect", tabId: 7 });
    expect(observed).toEqual([{ type: "component:update", id: 1, name: "Counter" }]);

    source.stop();
  });

  it("does not send extension controls after the source stops", async () => {
    const { createPanelEventSource } =
      await import("../../../examples/devtools-extension/src/panel/transport");
    const portListeners = new Set<(message: unknown) => void>();
    const port = {
      disconnect: vi.fn(),
      onMessage: {
        addListener(listener: (message: unknown) => void) {
          portListeners.add(listener);
        },
        removeListener(listener: (message: unknown) => void) {
          portListeners.delete(listener);
        },
      },
      postMessage: vi.fn(),
    } satisfies PanelRuntimePort;

    const source = createPanelEventSource(() => {}, {
      connectRuntime: () => port,
      inspectedTabId: 7,
    });

    source.setPaused(true);
    source.stop();
    source.setPaused(false);
    source.stop();

    expect(port.postMessage).toHaveBeenCalledTimes(2);
    expect(port.postMessage).toHaveBeenNthCalledWith(1, {
      type: "devtools:panel:connect",
      tabId: 7,
    });
    expect(port.postMessage).toHaveBeenNthCalledWith(2, {
      type: "devtools:control",
      paused: true,
    });
    expect(port.disconnect).toHaveBeenCalledTimes(1);
    expect(portListeners.size).toBe(0);
  });
});
