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
});
