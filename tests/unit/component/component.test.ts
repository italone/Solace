import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createApp,
  defineAsyncComponent,
  defineComponent,
  Fragment,
  h,
  inject,
  nextTick,
  provide,
  reactive,
  render,
} from "../../../src/index";
import type { ComponentSetupContext } from "../../../src/index";
import * as scheduler from "../../../src/scheduler/scheduler";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function flushPromises(cycles: number): Promise<void> {
  for (let index = 0; index < cycles; index += 1) {
    await Promise.resolve();
  }
}

describe("component renderer", () => {
  it("mounts a function component that returns a render function", () => {
    const container = document.createElement("div");
    const Message = () => () => h("p", null, "hello component");

    render(h(Message), container);

    expect(container.innerHTML).toBe("<p>hello component</p>");
  });

  it("passes props to function components", () => {
    const container = document.createElement("div");
    const Greeting = (props: { name?: string }) => () =>
      h("span", { id: "message" }, `hello ${props.name}`);

    render(h(Greeting, { name: "Ada" }), container);

    expect(container.innerHTML).toBe('<span id="message">hello Ada</span>');
  });

  it("rerenders a component when props change without remounting its DOM", () => {
    const container = document.createElement("div");
    const Counter = (props: { count?: number }) => () =>
      h("button", { class: "counter" }, `count: ${props.count}`);

    render(h(Counter, { count: 1 }), container);
    const button = container.querySelector("button");

    render(h(Counter, { count: 2 }), container);

    expect(container.innerHTML).toBe('<button class="counter">count: 2</button>');
    expect(container.querySelector("button")).toBe(button);
  });

  it("skips child component updates when parent rerenders with unchanged props", async () => {
    const state = reactive({ count: 0 });
    const container = document.createElement("div");
    const childRender = vi.fn((label: string) => h("span", { "data-child": label }, label));
    const Child = (props: { label: string }) => () => childRender(props.label);
    const Parent = () => () =>
      h("section", null, [
        h("p", null, `parent: ${state.count}`),
        h(Child, { key: "stable", label: "stable" }),
      ]);

    render(h(Parent), container);

    state.count = 1;
    await nextTick();

    expect(container.querySelector("p")?.textContent).toBe("parent: 1");
    expect(container.querySelector("[data-child='stable']")?.textContent).toBe("stable");
    expect(childRender).toHaveBeenCalledTimes(1);
  });

  it("queues each pending component update only once per tick", async () => {
    const state = reactive({ count: 0 });
    const queueJob = vi.spyOn(scheduler, "queueJob");
    const container = document.createElement("div");
    const childCount = 20;
    const Child = (props: { index: number }) => () =>
      h("span", { "data-index": props.index }, `item ${props.index}: ${state.count}`);
    const Parent = () => () =>
      h(
        "div",
        null,
        Array.from({ length: childCount }, (_, index) => h(Child, { key: index, index })),
      );

    render(h(Parent), container);
    queueJob.mockClear();

    state.count = 1;
    state.count = 2;
    state.count = 3;

    expect(queueJob).toHaveBeenCalledTimes(childCount);

    await nextTick();

    expect(container.querySelector('[data-index="0"]')?.textContent).toBe("item 0: 3");
    expect(container.querySelector(`[data-index="${childCount - 1}"]`)?.textContent).toBe(
      `item ${childCount - 1}: 3`,
    );

    state.count = 4;
    await nextTick();

    expect(queueJob).toHaveBeenCalledTimes(childCount * 2);
  });

  it("schedules rerender when reactive state is read inside a component render", async () => {
    const state = reactive({ count: 0 });
    const container = document.createElement("div");
    const Counter = () => () => h("button", null, `count: ${state.count}`);

    render(h(Counter), container);
    const button = container.querySelector("button");

    state.count = 1;

    expect(container.innerHTML).toBe("<button>count: 0</button>");

    await nextTick();

    expect(container.innerHTML).toBe("<button>count: 1</button>");
    expect(container.querySelector("button")).toBe(button);
  });

  it("reruns direct VNode function components when props change", () => {
    const container = document.createElement("div");
    const Label = (props: { text?: string }) => h("span", null, props.text ?? "");

    render(h(Label, { text: "before" }), container);
    const span = container.querySelector("span");

    render(h(Label, { text: "after" }), container);

    expect(container.innerHTML).toBe("<span>after</span>");
    expect(container.querySelector("span")).toBe(span);
  });

  it("calls direct VNode function components once during initial mount", () => {
    const container = document.createElement("div");
    let calls = 0;
    const Label = () => {
      calls += 1;
      return h("span", null, "once");
    };

    render(h(Label), container);

    expect(container.innerHTML).toBe("<span>once</span>");
    expect(calls).toBe(1);
  });

  it("batches initial mount of component children into one parent insert", () => {
    const container = document.createElement("div");
    const insertBefore = vi.spyOn(Element.prototype, "insertBefore");
    const childCount = 20;
    const Child = (props: { index: number }) => () =>
      h("span", { "data-index": props.index }, `item ${props.index}`);
    const Parent = () => () =>
      h(
        "div",
        null,
        Array.from({ length: childCount }, (_, index) => h(Child, { key: index, index })),
      );

    render(h(Parent), container);

    expect(insertBefore).toHaveBeenCalledTimes(2);
    expect(container.querySelectorAll("span")).toHaveLength(childCount);
    expect(container.querySelector('[data-index="0"]')?.textContent).toBe("item 0");
    expect(container.querySelector(`[data-index="${childCount - 1}"]`)?.textContent).toBe(
      `item ${childCount - 1}`,
    );
  });

  it("stops component reactive updates after unmount", async () => {
    const state = reactive({ active: true });
    const container = document.createElement("div");
    const Toggle = () => () =>
      state.active ? h("button", null, "active") : h("p", null, "inactive");

    render(h(Toggle), container);
    render(h("span", null, "gone"), container);

    state.active = false;
    await nextTick();

    expect(container.innerHTML).toBe("<span>gone</span>");
  });

  it("ignores queued component updates after unmount", async () => {
    const state = reactive({ active: true });
    const container = document.createElement("div");
    const Toggle = () => () =>
      state.active ? h("button", null, "active") : h("p", null, "inactive");

    render(h(Toggle), container);

    state.active = false;
    render(h("span", null, "gone"), container);

    await nextTick();

    expect(container.innerHTML).toBe("<span>gone</span>");
  });

  it("injects values provided by an ancestor component", () => {
    const container = document.createElement("div");
    const Child = () => {
      const message = inject("message");

      return () => h("span", null, String(message));
    };
    const Parent = () => {
      provide("message", "hello from parent");

      return () => h(Child);
    };

    render(h(Parent), container);

    expect(container.innerHTML).toBe("<span>hello from parent</span>");
  });

  it("uses the nearest provider when ancestors provide the same key", () => {
    const container = document.createElement("div");
    const Child = () => {
      const message = inject("message");

      return () => h("span", null, String(message));
    };
    const Middle = () => {
      provide("message", "middle");

      return () => h(Child);
    };
    const Parent = () => {
      provide("message", "parent");

      return () => h(Middle);
    };

    render(h(Parent), container);

    expect(container.innerHTML).toBe("<span>middle</span>");
  });

  it("supports symbol injection keys", () => {
    const key = Symbol("message");
    const container = document.createElement("div");
    const Child = () => {
      const message = inject(key);

      return () => h("span", null, String(message));
    };
    const Parent = () => {
      provide(key, "symbol value");

      return () => h(Child);
    };

    render(h(Parent), container);

    expect(container.innerHTML).toBe("<span>symbol value</span>");
  });

  it("returns a default value when no provider matches the key", () => {
    const container = document.createElement("div");
    const Child = () => {
      const message = inject("missing", "fallback");

      return () => h("span", null, String(message));
    };

    render(h(Child), container);

    expect(container.innerHTML).toBe("<span>fallback</span>");
  });

  it("injects app-level values into descendant components", () => {
    const container = document.createElement("div");
    const Child = () => {
      const theme = inject("theme", "light");

      return () => h("span", null, String(theme));
    };
    const Parent = () => () => h(Child);

    createApp(Parent).provide("theme", "dark").mount(container);

    expect(container.innerHTML).toBe("<span>dark</span>");
  });

  it("uses component providers before app-level providers", () => {
    const container = document.createElement("div");
    const Child = () => {
      const theme = inject("theme", "light");

      return () => h("span", null, String(theme));
    };
    const Parent = () => {
      provide("theme", "component");

      return () => h(Child);
    };

    createApp(Parent).provide("theme", "app").mount(container);

    expect(container.innerHTML).toBe("<span>component</span>");
  });

  it("mounts a component declared with defineComponent", () => {
    const container = document.createElement("div");
    const Message = defineComponent(() => () => h("p", null, "defined component"));

    render(h(Message), container);

    expect(container.innerHTML).toBe("<p>defined component</p>");
  });

  it("passes props to a component declared with defineComponent", () => {
    const container = document.createElement("div");
    const Greeting = defineComponent(
      (props: { name?: string }) => () => h("span", null, `hello ${props.name}`),
    );

    render(h(Greeting, { name: "Ada" }), container);

    expect(container.innerHTML).toBe("<span>hello Ada</span>");
  });

  it("renders component default slot children", () => {
    const container = document.createElement("div");
    const Panel =
      (_props: object, { slots }: ComponentSetupContext) =>
      () =>
        h("section", null, slots.default?.() ?? null);

    render(h(Panel, null, h("span", null, "inside")), container);

    expect(container.innerHTML).toBe("<section><span>inside</span></section>");
  });

  it("omits the default slot when component children are empty", () => {
    const container = document.createElement("div");
    const Panel =
      (_props: object, { slots }: ComponentSetupContext) =>
      () =>
        h("section", null, slots.default?.() ?? h("em", null, "empty"));

    render(h(Panel), container);

    expect(container.innerHTML).toBe("<section><em>empty</em></section>");
  });

  it("updates default slot children when component children change", () => {
    const container = document.createElement("div");
    const Panel =
      (_props: object, { slots }: ComponentSetupContext) =>
      () =>
        h("section", null, slots.default?.() ?? null);

    render(h(Panel, null, h("span", null, "before")), container);
    const section = container.querySelector("section");

    render(h(Panel, null, h("strong", null, "after")), container);

    expect(container.innerHTML).toBe("<section><strong>after</strong></section>");
    expect(container.querySelector("section")).toBe(section);
  });

  it("renders named slot children", () => {
    const container = document.createElement("div");
    const Layout =
      (_props: object, { slots }: ComponentSetupContext) =>
      () =>
        h("section", null, [
          h("header", null, slots.header?.() ?? null),
          h("main", null, slots.default?.() ?? null),
          h("footer", null, slots.footer?.() ?? null),
        ]);

    render(
      h(Layout, null, {
        header: () => h("h1", null, "Title"),
        default: () => h("p", null, "Body"),
        footer: () => h("small", null, "Meta"),
      }),
      container,
    );

    expect(container.innerHTML).toBe(
      "<section><header><h1>Title</h1></header><main><p>Body</p></main><footer><small>Meta</small></footer></section>",
    );
  });

  it("omits missing named slots", () => {
    const container = document.createElement("div");
    const Layout =
      (_props: object, { slots }: ComponentSetupContext) =>
      () =>
        h("section", null, [
          h("header", null, slots.header?.() ?? null),
          h("main", null, slots.default?.() ?? null),
        ]);

    render(
      h(Layout, null, {
        default: () => h("p", null, "Body"),
      }),
      container,
    );

    expect(container.innerHTML).toBe(
      "<section><header></header><main><p>Body</p></main></section>",
    );
  });

  it("updates named slot children when component children change", () => {
    const container = document.createElement("div");
    const Layout =
      (_props: object, { slots }: ComponentSetupContext) =>
      () =>
        h("section", null, [
          h("header", null, slots.header?.() ?? null),
          h("main", null, slots.default?.() ?? null),
        ]);

    render(
      h(Layout, null, {
        header: () => h("h1", null, "Before"),
        default: () => h("p", null, "Body"),
      }),
      container,
    );
    const section = container.querySelector("section");

    render(
      h(Layout, null, {
        default: () => h("p", null, "Updated"),
      }),
      container,
    );

    expect(container.innerHTML).toBe(
      "<section><header></header><main><p>Updated</p></main></section>",
    );
    expect(container.querySelector("section")).toBe(section);
  });

  it("passes props to named slot children", () => {
    const container = document.createElement("div");
    const List =
      (_props: object, { slots }: ComponentSetupContext) =>
      () =>
        h("ul", null, [
          h(Fragment, null, slots.item?.({ value: "Ada", index: 0 }) ?? null),
          h(Fragment, null, slots.item?.({ value: "Grace", index: 1 }) ?? null),
        ]);

    render(
      h(List, null, {
        item: (slotProps) =>
          h("li", null, `${String(slotProps?.index)}:${String(slotProps?.value)}`),
      }),
      container,
    );

    expect(container.innerHTML).toBe("<ul><li>0:Ada</li><li>1:Grace</li></ul>");
  });

  it("passes props to default slot children", () => {
    const container = document.createElement("div");
    const Message =
      (_props: object, { slots }: ComponentSetupContext) =>
      () =>
        h("section", null, slots.default?.({ text: "hello" }) ?? null);

    render(
      h(Message, null, {
        default: (slotProps) => h("p", null, String(slotProps?.text)),
      }),
      container,
    );

    expect(container.innerHTML).toBe("<section><p>hello</p></section>");
  });

  it("updates slot props when the child component rerenders", async () => {
    const state = reactive({ count: 0 });
    const container = document.createElement("div");
    const Counter =
      (_props: object, { slots }: ComponentSetupContext) =>
      () =>
        h("section", null, slots.default?.({ count: state.count }) ?? null);

    render(
      h(Counter, null, {
        default: (slotProps) => h("span", null, `count: ${String(slotProps?.count)}`),
      }),
      container,
    );

    state.count = 1;
    await nextTick();

    expect(container.innerHTML).toBe("<section><span>count: 1</span></section>");
  });

  it("renders an async component after its loader resolves", async () => {
    const container = document.createElement("div");
    let resolveLoader!: (component: (props: { message?: string }) => ReturnType<typeof h>) => void;
    const LazyMessage = defineAsyncComponent(
      () =>
        new Promise<(props: { message?: string }) => ReturnType<typeof h>>((resolve) => {
          resolveLoader = resolve;
        }),
    );

    render(h(LazyMessage, { message: "loaded" }), container);

    expect(container.innerHTML).toBe("");

    resolveLoader((props) => h("p", null, props.message ?? ""));
    await Promise.resolve();
    await nextTick();

    expect(container.innerHTML).toBe("<p>loaded</p>");
  });

  it("passes the latest props to a resolved async component", async () => {
    const container = document.createElement("div");
    let resolveLoader!: (component: (props: { message?: string }) => ReturnType<typeof h>) => void;
    const LazyMessage = defineAsyncComponent(
      () =>
        new Promise<(props: { message?: string }) => ReturnType<typeof h>>((resolve) => {
          resolveLoader = resolve;
        }),
    );

    render(h(LazyMessage, { message: "before" }), container);
    render(h(LazyMessage, { message: "after" }), container);

    resolveLoader((props) => h("p", null, props.message ?? ""));
    await Promise.resolve();
    await nextTick();

    expect(container.innerHTML).toBe("<p>after</p>");
  });

  it("forwards default slot children to a resolved async component", async () => {
    const container = document.createElement("div");
    let resolveLoader!: (
      component: (_props: object, context: ComponentSetupContext) => ReturnType<typeof h>,
    ) => void;
    const LazyPanel = defineAsyncComponent(
      () =>
        new Promise<(_props: object, context: ComponentSetupContext) => ReturnType<typeof h>>(
          (resolve) => {
            resolveLoader = resolve;
          },
        ),
    );

    render(h(LazyPanel, null, h("strong", null, "slot")), container);

    resolveLoader((_props, { slots }) => h("section", null, slots.default?.() ?? null));
    await Promise.resolve();
    await nextTick();

    expect(container.innerHTML).toBe("<section><strong>slot</strong></section>");
  });

  it("loads an async component only once across rerenders", async () => {
    const state = reactive({ count: 0 });
    const container = document.createElement("div");
    let loadCalls = 0;
    const LazyCounter = defineAsyncComponent(() => {
      loadCalls += 1;
      return Promise.resolve(() => h("span", null, `count: ${state.count}`));
    });

    render(h(LazyCounter), container);
    await Promise.resolve();
    await nextTick();

    state.count = 1;
    await nextTick();

    expect(container.innerHTML).toBe("<span>count: 1</span>");
    expect(loadCalls).toBe(1);
  });

  it("renders an async loading component while loader is pending", () => {
    const container = document.createElement("div");
    const Loading = () => h("span", null, "loading");
    const LazyMessage = defineAsyncComponent({
      loader: () =>
        new Promise<(props: { message?: string }) => ReturnType<typeof h>>(() => undefined),
      loadingComponent: Loading,
    });

    render(h(LazyMessage, { message: "pending" }), container);

    expect(container.innerHTML).toBe("<span>loading</span>");
  });

  it("replaces an async loading component after loader resolves", async () => {
    const container = document.createElement("div");
    let resolveLoader!: (component: (props: { message?: string }) => ReturnType<typeof h>) => void;
    const Loading = () => h("span", null, "loading");
    const LazyMessage = defineAsyncComponent({
      loader: () =>
        new Promise<(props: { message?: string }) => ReturnType<typeof h>>((resolve) => {
          resolveLoader = resolve;
        }),
      loadingComponent: Loading,
    });

    render(h(LazyMessage, { message: "loaded" }), container);

    expect(container.innerHTML).toBe("<span>loading</span>");

    resolveLoader((props) => h("p", null, props.message ?? ""));
    await Promise.resolve();
    await nextTick();

    expect(container.innerHTML).toBe("<p>loaded</p>");
  });

  it("renders an async error component when loader rejects", async () => {
    const container = document.createElement("div");
    const ErrorView = () => h("strong", null, "failed");
    const LazyMessage = defineAsyncComponent({
      loader: () => Promise.reject(new Error("load failed")),
      errorComponent: ErrorView,
    });

    render(h(LazyMessage), container);
    await Promise.resolve();
    await nextTick();

    expect(container.innerHTML).toBe("<strong>failed</strong>");
  });

  it("passes props and slots to async loading and error components", async () => {
    const container = document.createElement("div");
    const Loading = (props: { label?: string }, { slots }: ComponentSetupContext) =>
      h("span", null, [
        h("b", null, props.label ?? ""),
        h(Fragment, null, slots.default?.() ?? null),
      ]);
    const ErrorView = (props: { label?: string }, { slots }: ComponentSetupContext) =>
      h("strong", null, [
        h("b", null, props.label ?? ""),
        h(Fragment, null, slots.default?.() ?? null),
      ]);
    const LazyMessage = defineAsyncComponent({
      loader: () => Promise.reject(new Error("load failed")),
      loadingComponent: Loading,
      errorComponent: ErrorView,
    });

    render(h(LazyMessage, { label: "state" }, h("em", null, "slot")), container);

    expect(container.innerHTML).toBe("<span><b>state</b><em>slot</em></span>");

    await Promise.resolve();
    await nextTick();

    expect(container.innerHTML).toBe("<strong><b>state</b><em>slot</em></strong>");
  });

  it("waits for delay before rendering an async loading component", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    const Loading = () => h("span", null, "loading");
    const LazyMessage = defineAsyncComponent({
      loader: () => new Promise<(props: object) => ReturnType<typeof h>>(() => undefined),
      loadingComponent: Loading,
      delay: 50,
    });

    render(h(LazyMessage), container);

    expect(container.innerHTML).toBe("");

    vi.advanceTimersByTime(49);
    await nextTick();

    expect(container.innerHTML).toBe("");

    vi.advanceTimersByTime(1);
    await nextTick();

    expect(container.innerHTML).toBe("<span>loading</span>");
  });

  it("skips delayed loading when an async component resolves before delay", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    let resolveLoader!: (component: () => ReturnType<typeof h>) => void;
    const Loading = () => h("span", null, "loading");
    const LazyMessage = defineAsyncComponent({
      loader: () =>
        new Promise<() => ReturnType<typeof h>>((resolve) => {
          resolveLoader = resolve;
        }),
      loadingComponent: Loading,
      delay: 50,
    });

    render(h(LazyMessage), container);

    resolveLoader(() => h("p", null, "loaded"));
    await Promise.resolve();
    await nextTick();

    vi.advanceTimersByTime(50);
    await nextTick();

    expect(container.innerHTML).toBe("<p>loaded</p>");
  });

  it("renders an async error component after timeout", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    const ErrorView = () => h("strong", null, "timed out");
    const LazyMessage = defineAsyncComponent({
      loader: () => new Promise<(props: object) => ReturnType<typeof h>>(() => undefined),
      errorComponent: ErrorView,
      timeout: 25,
    });

    render(h(LazyMessage), container);

    vi.advanceTimersByTime(25);
    await nextTick();

    expect(container.innerHTML).toBe("<strong>timed out</strong>");
  });

  it("keeps the error component when an async loader resolves after timeout", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    let resolveLoader!: (component: () => ReturnType<typeof h>) => void;
    const ErrorView = () => h("strong", null, "timed out");
    const LazyMessage = defineAsyncComponent({
      loader: () =>
        new Promise<() => ReturnType<typeof h>>((resolve) => {
          resolveLoader = resolve;
        }),
      errorComponent: ErrorView,
      timeout: 25,
    });

    render(h(LazyMessage), container);

    vi.advanceTimersByTime(25);
    await nextTick();

    expect(container.innerHTML).toBe("<strong>timed out</strong>");

    resolveLoader(() => h("p", null, "late"));
    await Promise.resolve();
    await nextTick();

    expect(container.innerHTML).toBe("<strong>timed out</strong>");
  });

  it("retries a rejected async component loader after retryDelay", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    let loadCalls = 0;
    const LazyMessage = defineAsyncComponent({
      loader: () => {
        loadCalls += 1;
        return loadCalls === 1
          ? Promise.reject(new Error("first failure"))
          : new Promise<() => ReturnType<typeof h>>(() => undefined);
      },
      retry: 1,
      retryDelay: 25,
    });

    render(h(LazyMessage), container);
    await Promise.resolve();
    await nextTick();

    expect(loadCalls).toBe(1);

    vi.advanceTimersByTime(24);
    await nextTick();

    expect(loadCalls).toBe(1);

    vi.advanceTimersByTime(1);
    await Promise.resolve();
    await nextTick();

    expect(loadCalls).toBe(2);
    expect(container.innerHTML).toBe("");
  });

  it("renders an async component when a retry succeeds", async () => {
    const container = document.createElement("div");
    let loadCalls = 0;
    const ErrorView = () => h("strong", null, "failed");
    const LazyMessage = defineAsyncComponent({
      loader: () => {
        loadCalls += 1;
        return loadCalls === 1
          ? Promise.reject(new Error("first failure"))
          : Promise.resolve((props: { message?: string }) => h("p", null, props.message ?? ""));
      },
      errorComponent: ErrorView,
      retry: 1,
    });

    render(h(LazyMessage, { message: "loaded" }), container);
    await Promise.resolve();
    await Promise.resolve();
    await nextTick();

    expect(loadCalls).toBe(2);
    expect(container.innerHTML).toBe("<p>loaded</p>");
  });

  it("renders an async error component after retries are exhausted", async () => {
    const container = document.createElement("div");
    let loadCalls = 0;
    const ErrorView = () => h("strong", null, "failed");
    const LazyMessage = defineAsyncComponent({
      loader: () => {
        loadCalls += 1;
        return Promise.reject(new Error("load failed"));
      },
      errorComponent: ErrorView,
      retry: 2,
    });

    render(h(LazyMessage), container);
    await flushPromises(6);
    await nextTick();

    expect(loadCalls).toBe(3);
    expect(container.innerHTML).toBe("<strong>failed</strong>");
  });

  it("retries an async component loader after timeout and renders a later success", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    let loadCalls = 0;
    const LazyMessage = defineAsyncComponent({
      loader: () => {
        loadCalls += 1;
        return loadCalls === 1
          ? new Promise<() => ReturnType<typeof h>>(() => undefined)
          : Promise.resolve(() => h("p", null, "loaded after timeout"));
      },
      timeout: 25,
      retry: 1,
    });

    render(h(LazyMessage), container);

    vi.advanceTimersByTime(25);
    await Promise.resolve();
    await nextTick();

    expect(loadCalls).toBe(2);
    expect(container.innerHTML).toBe("<p>loaded after timeout</p>");
  });

  it("keeps single-attempt behavior when retry is omitted", async () => {
    const container = document.createElement("div");
    let loadCalls = 0;
    const ErrorView = () => h("strong", null, "failed");
    const LazyMessage = defineAsyncComponent({
      loader: () => {
        loadCalls += 1;
        return Promise.reject(new Error("load failed"));
      },
      errorComponent: ErrorView,
    });

    render(h(LazyMessage), container);
    await Promise.resolve();
    await nextTick();

    expect(loadCalls).toBe(1);
    expect(container.innerHTML).toBe("<strong>failed</strong>");
  });
});
