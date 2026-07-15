import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearDevtoolsListeners,
  onDevtoolsEvent,
  type DevtoolsEvent,
} from "../../../src/devtools/events";
import {
  h,
  nextTick,
  onMounted,
  onUnmounted,
  onUpdated,
  reactive,
  render,
} from "../../../src/index";

afterEach(() => {
  clearDevtoolsListeners();
});

describe("component emit and lifecycle", () => {
  it("emits component events to parent listeners", () => {
    const container = document.createElement("div");
    const onChange = vi.fn();
    const Emitter =
      (
        _props: { onChange?: (value: string) => void },
        { emit }: { emit: (event: string, ...args: unknown[]) => void },
      ) =>
      () =>
        h("button", { onClick: () => emit("change", "next") }, "emit");

    render(h(Emitter, { onChange }), container);
    container.querySelector("button")?.click();

    expect(onChange).toHaveBeenCalledWith("next");
  });

  it("emits devtools summaries for component emits", () => {
    const events: DevtoolsEvent[] = [];
    const container = document.createElement("div");
    const onChange = vi.fn();
    const Emitter =
      (
        _props: { onChange?: (value: string) => void },
        { emit }: { emit: (event: string, ...args: unknown[]) => void },
      ) =>
      () =>
        h("button", { onClick: () => emit("change", "secret-value") }, "emit");

    onDevtoolsEvent((event) => {
      events.push(event);
    });

    render(h(Emitter, { onChange }), container);
    container.querySelector("button")?.click();

    const emitEvent = events.find((event) => event.type === "component:emit");

    expect(onChange).toHaveBeenCalledWith("secret-value");
    expect(emitEvent).toEqual({
      type: "component:emit",
      id: expect.any(Number),
      name: "Emitter",
      event: "change",
      handlerCount: 1,
    });
    expect(JSON.stringify(emitEvent)).not.toContain("secret-value");
  });

  it("emits kebab-case events to camelized listeners", () => {
    const container = document.createElement("div");
    const onValueChange = vi.fn();
    const Emitter =
      (
        _props: { onValueChange?: (value: number) => void },
        { emit }: { emit: (event: string, ...args: unknown[]) => void },
      ) =>
      () =>
        h("button", { onClick: () => emit("value-change", 1) }, "emit");

    render(h(Emitter, { onValueChange }), container);
    container.querySelector("button")?.click();

    expect(onValueChange).toHaveBeenCalledWith(1);
  });

  it("emits component events to listener arrays", () => {
    const container = document.createElement("div");
    const first = vi.fn();
    const second = vi.fn();
    const Emitter =
      (
        _props: { onChange?: Array<(value: string) => void> },
        { emit }: { emit: (event: string, ...args: unknown[]) => void },
      ) =>
      () =>
        h("button", { onClick: () => emit("change", "next") }, "emit");

    render(h(Emitter, { onChange: [first, second] }), container);
    container.querySelector("button")?.click();

    expect(first).toHaveBeenCalledWith("next");
    expect(second).toHaveBeenCalledWith("next");
  });

  it("counts callable listener array entries in devtools emit summaries", () => {
    const events: DevtoolsEvent[] = [];
    const container = document.createElement("div");
    const first = vi.fn();
    const second = vi.fn();
    const Emitter =
      (
        _props: { onChange?: Array<unknown> },
        { emit }: { emit: (event: string, ...args: unknown[]) => void },
      ) =>
      () =>
        h("button", { onClick: () => emit("change", "next") }, "emit");

    onDevtoolsEvent((event) => {
      events.push(event);
    });

    render(h(Emitter, { onChange: [first, "ignored", second] }), container);
    container.querySelector("button")?.click();

    const emitEvent = events.find((event) => event.type === "component:emit");

    expect(first).toHaveBeenCalledWith("next");
    expect(second).toHaveBeenCalledWith("next");
    expect(emitEvent).toMatchObject({
      type: "component:emit",
      name: "Emitter",
      event: "change",
      handlerCount: 2,
    });
  });

  it("emits devtools summaries for component emits without handlers", () => {
    const events: DevtoolsEvent[] = [];
    const container = document.createElement("div");
    const Emitter =
      (_props: object, { emit }: { emit: (event: string, ...args: unknown[]) => void }) =>
      () =>
        h("button", { onClick: () => emit("missing", "not-captured") }, "emit");

    onDevtoolsEvent((event) => {
      events.push(event);
    });

    render(h(Emitter), container);
    container.querySelector("button")?.click();

    const emitEvent = events.find((event) => event.type === "component:emit");

    expect(emitEvent).toEqual({
      type: "component:emit",
      id: expect.any(Number),
      name: "Emitter",
      event: "missing",
      handlerCount: 0,
    });
    expect(JSON.stringify(emitEvent)).not.toContain("not-captured");
  });

  it("runs mount, update, and unmount hooks in order", async () => {
    const calls: string[] = [];
    const state = reactive({ count: 0 });
    const container = document.createElement("div");
    const Counter = () => {
      onMounted(() => calls.push("mounted"));
      onUpdated(() => calls.push("updated"));
      onUnmounted(() => calls.push("unmounted"));

      return () => h("span", null, `count: ${state.count}`);
    };

    render(h(Counter), container);

    state.count = 1;
    await nextTick();

    render(h("div", null, "gone"), container);

    expect(calls).toEqual(["mounted", "updated", "unmounted"]);
  });

  it("cleans up component effects when a child component is removed", async () => {
    const state = reactive({ active: true });
    const container = document.createElement("div");
    const Toggle = () => () =>
      state.active ? h("button", null, "active") : h("p", null, "inactive");

    render(
      h("div", null, [h(Toggle, { key: "toggle" }), h("span", { key: "keep" }, "keep")]),
      container,
    );
    render(h("div", null, [h("span", { key: "keep" }, "keep")]), container);

    state.active = false;
    await nextTick();

    expect(container.innerHTML).toBe("<div><span>keep</span></div>");
  });

  it("unmounts component children when an element subtree is removed", () => {
    const calls: string[] = [];
    const container = document.createElement("div");
    const Child = () => {
      onUnmounted(() => calls.push("child unmounted"));
      return () => h("button", null, "child");
    };

    render(h("div", null, [h(Child)]), container);
    render(h("section", null, "gone"), container);

    expect(calls).toEqual(["child unmounted"]);
  });

  it("emits devtools component lifecycle summaries", async () => {
    const events: DevtoolsEvent[] = [];
    const state = reactive({ count: 0 });
    const container = document.createElement("div");
    const Counter = () => () => h("span", null, `count: ${state.count}`);

    onDevtoolsEvent((event) => {
      events.push(event);
    });

    render(h(Counter), container);
    state.count = 1;
    await nextTick();
    render(h("div", null, "gone"), container);

    const componentEvents = events.filter((event) => event.type.startsWith("component:"));

    expect(componentEvents).toHaveLength(3);
    expect(componentEvents[0]).toMatchObject({
      type: "component:mount",
      name: "Counter",
    });
    expect(componentEvents[1]).toMatchObject({
      type: "component:update",
      id: componentEvents[0]?.type === "component:mount" ? componentEvents[0].id : -1,
      name: "Counter",
    });
    expect(componentEvents[2]).toMatchObject({
      type: "component:unmount",
      id: componentEvents[0]?.type === "component:mount" ? componentEvents[0].id : -1,
      name: "Counter",
    });
  });

  it("uses a fallback devtools name for anonymous components", () => {
    const events: DevtoolsEvent[] = [];
    const container = document.createElement("div");

    onDevtoolsEvent((event) => {
      events.push(event);
    });

    render(
      h(() => h("span", null, "anonymous")),
      container,
    );

    const mountEvent = events.find((event) => event.type === "component:mount");

    expect(mountEvent).toMatchObject({
      type: "component:mount",
      name: "AnonymousComponent",
    });
  });
});
