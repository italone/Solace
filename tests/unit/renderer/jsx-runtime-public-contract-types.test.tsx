import { describe, expect, it } from "vitest";

import {
  createApp,
  createMemoryHistory,
  createRouter,
  defineComponent,
  h,
  render,
} from "../../../src";
import { jsxDEV } from "../../../src/jsx-dev-runtime";
import { jsx, jsxs } from "../../../src/jsx-runtime";
import type {
  ComponentEventMap,
  ComponentSetupContext,
  RouteComponent,
  VNodeChildren,
} from "../../../src";
import type { RenderToStringSource } from "../../../src/server";

const incrementCalls: number[] = [];
type CounterEvents = {
  increment: [count: number];
  reset: [];
  rename: [name: string, source?: "user" | "sync"];
  collect: [label: string, ...values: number[]];
  "value-change": [value: number];
};

type CounterSlots = {
  header?: () => VNodeChildren;
  default?: (props: { label: string; count?: number }) => VNodeChildren;
};

type RequiredCounterSlots = {
  default: (props: { label: string }) => VNodeChildren;
};

type HeaderOnlySlots = {
  header?: () => VNodeChildren;
};

type RequiredNamedCounterSlots = {
  header: () => VNodeChildren;
  default?: (props: { label: string }) => VNodeChildren;
};

type InvalidCounterSlots = {
  default: string;
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type EmptyCounterSlots = {};

type TypedEmitterProps = {
  count: number;
  onIncrement?: (count: string) => unknown;
  onFocus?: (reason: string) => unknown;
};

const eventMap: ComponentEventMap = {} as CounterEvents;
void eventMap;

const TypedEmitter = defineComponent<TypedEmitterProps, CounterEvents, CounterSlots>(
  (props, { emit, slots }) => {
    emit("increment", props.count);
    emit("reset");
    emit("rename", "Ada");
    emit("rename", "Ada", "user");
    emit("collect", "values", 1, 2, 3);
    emit("value-change", props.count);
    slots.header?.();
    slots.default?.({ label: "counter", count: props.count });

    // @ts-expect-error typed emit rejects unknown event names
    emit("missing");
    // @ts-expect-error typed emit requires the declared payload
    emit("increment");
    // @ts-expect-error typed emit rejects incompatible payloads
    emit("increment", "1");
    // @ts-expect-error typed emit rejects payloads for zero-argument events
    emit("reset", 1);
    // @ts-expect-error typed emit rejects incompatible optional tuple values
    emit("rename", "Ada", "external");
    // @ts-expect-error typed emit rejects incompatible rest tuple values
    emit("collect", "values", "1");

    return <button>{props.count}</button>;
  },
);

function acceptTypedContext({ emit }: ComponentSetupContext<CounterEvents>): void {
  emit("increment", 1);
  // @ts-expect-error direct setup contexts retain the event map
  emit("increment", "1");
}

acceptTypedContext({ emit: (() => undefined) as never, slots: {} });

function acceptTypedSlots({
  emit,
  slots,
}: ComponentSetupContext<CounterEvents, CounterSlots>): void {
  emit("increment", 1);
  slots.header?.();
  slots.default?.({ label: "counter" });
  slots.default?.({ label: "counter", count: 1 });
  // @ts-expect-error typed slots reject unknown slot names
  slots.missing?.();
  // @ts-expect-error typed header slots reject props
  slots.header?.({ label: "counter" });
  // @ts-expect-error typed default slots require their scoped props
  slots.default?.();
  // @ts-expect-error typed default slots reject incompatible labels
  slots.default?.({ label: 1 });
  // @ts-expect-error typed default slots reject incompatible optional counts
  slots.default?.({ label: "counter", count: "1" });
  // @ts-expect-error typed scoped props reject undeclared fields
  slots.default?.({ label: "counter", extra: true });
}

function acceptRequiredSlots({
  slots,
}: ComponentSetupContext<ComponentEventMap, RequiredCounterSlots>): void {
  slots.default({ label: "required" });
}

function acceptEmptySlots({
  slots,
}: ComponentSetupContext<ComponentEventMap, EmptyCounterSlots>): void {
  // @ts-expect-error empty slot maps reject default slots
  slots.default();
}

function acceptPermissiveSlots({ slots }: ComponentSetupContext): void {
  slots.anything?.({ label: "permissive" });
}

type InvalidSlotContext = ComponentSetupContext<ComponentEventMap, InvalidCounterSlots>;

function rejectInvalidSlots({ slots }: InvalidSlotContext): void {
  // @ts-expect-error invalid slot maps reject non-function slots
  slots.default?.();
}

acceptTypedSlots({ emit: (() => undefined) as never, slots: {} });
acceptRequiredSlots({ emit: () => undefined, slots: { default: () => null } });
void acceptEmptySlots;
acceptPermissiveSlots({ emit: () => undefined, slots: {} });
void (0 as unknown as InvalidSlotContext);
void rejectInvalidSlots;

const UntypedEmitter = defineComponent((_props: object, { emit }) => {
  emit("legacy-event", Symbol("payload"), 1);
  return <span>legacy</span>;
});

const ExactRenderComponent = defineComponent(() => () => <span>exact</span>);
const exactRender = ExactRenderComponent({}, { emit: () => undefined, slots: {} });
exactRender();

const RequiredSlotPanel = defineComponent<object, ComponentEventMap, RequiredCounterSlots>(
  (_props, { slots }) => <section>{slots.default({ label: "required" })}</section>,
);
const HeaderOnlyPanel = defineComponent<object, ComponentEventMap, HeaderOnlySlots>(
  (_props, { slots }) => {
    slots.header?.();
    return <section>header only</section>;
  },
);
const RequiredNamedPanel = defineComponent<object, ComponentEventMap, RequiredNamedCounterSlots>(
  (_props, { slots }) => {
    slots.header();
    slots.default?.({ label: "named" });
    return <section>named</section>;
  },
);

const requiredSlotRouteTransport: RouteComponent = RequiredSlotPanel;
const requiredSlotServerTransport: RenderToStringSource = RequiredSlotPanel;
createApp(RequiredSlotPanel);
createRouter({
  history: createMemoryHistory(),
  routes: [{ path: "/required-slot", component: RequiredSlotPanel }],
});
void requiredSlotRouteTransport;
void requiredSlotServerTransport;

const Row = (props: { label: string }) => <li>{props.label}</li>;
const GenericRow = <Value,>(props: { value: Value; formatValue: (value: Value) => string }) => (
  <li>{props.formatValue(props.value)}</li>
);
const typedEventRouteTransport: RouteComponent = TypedEmitter;
const typedEventServerTransport: RenderToStringSource = TypedEmitter;
const genericRouteTransport: RouteComponent = GenericRow;
const genericServerTransport: RenderToStringSource = GenericRow;
createApp(TypedEmitter);
createApp(GenericRow);
createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: "/typed-event", component: TypedEmitter },
    { path: "/generic", component: GenericRow },
  ],
});
void typedEventRouteTransport;
void typedEventServerTransport;
void genericRouteTransport;
void genericServerTransport;
const CounterButton = (props: { count: number }, { emit, slots }: ComponentSetupContext) => (
  <button onClick={() => emit("increment", props.count)}>
    <span>count: {props.count}</span>
    <small>{slots.default?.()}</small>
  </button>
);
const Panel = (props: { title: string }, { slots }: ComponentSetupContext) => (
  <section>
    <h2>{props.title}</h2>
    <div>{slots.default?.()}</div>
  </section>
);
const FragmentList = () => (
  <>
    <Row key="ada" label="Ada" />
    <Row key="grace" label="Grace" />
  </>
);

<Row key="stable-row" label="Ada" />;
<Row key={1} label="Grace" />;
<GenericRow value="Ada" formatValue={(value) => value.toUpperCase()} />;
<Panel title="Profile">
  <span>Ada</span>
</Panel>;
<CounterButton count={1} onIncrement={(count: number) => incrementCalls.push(count)}>
  click me
</CounterButton>;
<CounterButton
  count={1}
  onIncrement={[
    (count: number) => incrementCalls.push(count),
    (count: number) => incrementCalls.push(count + 1),
  ]}
>
  click me
</CounterButton>;
<FragmentList />;
<RequiredSlotPanel>required</RequiredSlotPanel>;
<HeaderOnlyPanel />;
h(RequiredSlotPanel, null, "required");
h(RequiredSlotPanel, null, { default: ({ label }) => <span>{label}</span> });
h(
  TypedEmitter,
  { count: 1 },
  {
    header: () => <strong>header</strong>,
    default: ({ label, count }) => <span>{`${label}:${count ?? 0}`}</span>,
  },
);
h(RequiredNamedPanel, null, {
  header: () => <strong>required header</strong>,
});
h(GenericRow, { value: 42, formatValue: (value: number) => value.toFixed(0) });
jsx(RequiredSlotPanel, { children: "required" });
jsxDEV(RequiredSlotPanel, { children: "required" });
jsx(GenericRow, { value: "Ada", formatValue: (value: string) => value.toUpperCase() });
jsxDEV(GenericRow, { value: 42, formatValue: (value: number) => value.toFixed(0) });

// @ts-expect-error required default slots require JSX children
<RequiredSlotPanel />;

// @ts-expect-error direct jsx required default slots require children
jsx(RequiredSlotPanel, {});

// @ts-expect-error direct jsxDEV required default slots require children
jsxDEV(RequiredSlotPanel, {});

// @ts-expect-error components without a default slot reject JSX children
<HeaderOnlyPanel>unexpected</HeaderOnlyPanel>;

// @ts-expect-error required default slots require h() children
h(RequiredSlotPanel);

// @ts-expect-error required named slots require a slot object
h(RequiredNamedPanel, null, "default only");

// @ts-expect-error required named slots cannot be omitted
h(RequiredNamedPanel, null, { default: ({ label }) => <span>{label}</span> });

// @ts-expect-error typed h() slots reject unknown names
h(RequiredSlotPanel, null, {
  unknownProducerSlot: (props?: Record<string, unknown>) => <span>{String(props?.value)}</span>,
});

// @ts-expect-error typed h() scoped slots retain their declared props
h(RequiredSlotPanel, null, { default: (props: { label: number }) => <span>{props.label}</span> });

// @ts-expect-error direct h() retains generic component prop relationships
h(GenericRow, { value: 42, formatValue: (value: string) => value });

// @ts-expect-error direct jsx retains generic component prop relationships
jsx(GenericRow, { value: 42, formatValue: (value: string) => value });

// Untyped components retain the broad producer contract.
h(
  Panel,
  { title: "legacy" },
  {
    unknownProducerSlot: (props?: Record<string, unknown>) => <span>{String(props?.value)}</span>,
  },
);
<TypedEmitter
  count={1}
  onIncrement={(count: number) => incrementCalls.push(count)}
  onReset={() => undefined}
  onRename={(name: string, source?: "user" | "sync") => [name, source]}
  onCollect={(label: string, ...values: number[]) => [label, values]}
  onValueChange={(value: number) => value}
  onFocus={(reason: string) => reason}
/>;
<TypedEmitter
  count={1}
  onIncrement={[
    (count: number) => incrementCalls.push(count),
    (count: number) => incrementCalls.push(count + 1),
  ]}
/>;
<UntypedEmitter
  onLegacyEvent={(payload: symbol) => payload}
  onOtherEvent={[(value: Date) => value]}
/>;
<Row label="permissive" onAnything={(value: Date) => value} />;

<button onClick={(event: MouseEvent) => event.preventDefault()}>click</button>;

// @ts-expect-error component props still require declared fields
<Row key="missing-label" />;

// @ts-expect-error JSX key only accepts strings or numbers
<Row key={false} label="Invalid" />;

// @ts-expect-error JSX event handlers must be functions or arrays of functions
<CounterButton count={1} onIncrement="increment">
  click me
</CounterButton>;

// @ts-expect-error typed increment listeners receive the declared number payload
<TypedEmitter count={1} onIncrement={(count: string) => count} />;

// @ts-expect-error typed listener arrays reject incompatible item payloads
<TypedEmitter count={1} onIncrement={[(count: string) => count]} />;

// @ts-expect-error typed components reject listeners for unknown events
<TypedEmitter count={1} onMissing={(value: unknown) => value} />;

// @ts-expect-error typed reset listeners cannot require a payload
<TypedEmitter count={1} onReset={(value: number) => value} />;

// @ts-expect-error typed rename listeners retain the declared optional source union
<TypedEmitter count={1} onRename={(name: string, source?: "external") => [name, source]} />;

// @ts-expect-error typed collect listeners retain the declared numeric rest payload
<TypedEmitter count={1} onCollect={(label: string, ...values: string[]) => [label, values]} />;

// @ts-expect-error typed value-change listeners receive the declared number payload
<TypedEmitter count={1} onValueChange={(value: string) => value} />;

// @ts-expect-error DOM event handlers must be functions
<button onClick="click">click</button>;

// @ts-expect-error DOM event handlers do not accept function arrays
<button onClick={[() => undefined]}>click</button>;

// @ts-expect-error direct jsx DOM props reject non-function handlers
jsx("button", { onClick: "click" });

// @ts-expect-error direct jsx component props reject non-function handlers
jsx(CounterButton, { count: 1, onIncrement: "increment" });

// @ts-expect-error typed kebab-case events only accept canonical camelized listeners
jsx(TypedEmitter, { count: 1, "onValue-change": (value: number) => value });

jsx(TypedEmitter, { count: 1, onIncrement: (count: number) => count });
jsxs(TypedEmitter, {
  count: 1,
  onIncrement: [(count: number) => count],
  children: ["typed"],
});
jsxDEV(TypedEmitter, { count: 1, onValueChange: (value: number) => value });

// @ts-expect-error direct jsx typed listeners receive the declared number payload
jsx(TypedEmitter, { count: 1, onIncrement: (count: string) => count });

// @ts-expect-error direct jsxs typed components reject listeners for unknown events
jsxs(TypedEmitter, { count: 1, onMissing: (value: unknown) => value });

// @ts-expect-error direct jsxs typed listener arrays reject incompatible item payloads
jsxs(TypedEmitter, { count: 1, onIncrement: [(count: string) => count] });

// @ts-expect-error direct jsxDEV typed listeners receive the declared number payload
jsxDEV(TypedEmitter, { count: 1, onValueChange: (value: string) => value });

// @ts-expect-error direct jsxDEV DOM props reject non-function handlers
jsxDEV("button", { onClick: "click" });

// @ts-expect-error direct jsxDEV component props reject non-function handlers
jsxDEV(CounterButton, { count: 1, onIncrement: "increment" });

describe("JSX runtime public contract types", () => {
  it("keeps JSX type expectations in the TypeScript program", () => {
    expect(true).toBe(true);
  });

  it("passes JSX component children through the default slot", () => {
    const container = document.createElement("div");

    render(
      <Panel title="Profile">
        <span>Ada</span>
      </Panel>,
      container,
    );

    expect(container.innerHTML).toBe(
      "<section><h2>Profile</h2><div><span>Ada</span></div></section>",
    );
  });

  it("passes JSX component event handlers through props for emit", () => {
    const container = document.createElement("div");
    const calls: number[] = [];

    render(
      <CounterButton count={2} onIncrement={(count: number) => calls.push(count)}>
        click me
      </CounterButton>,
      container,
    );
    container.querySelector("button")?.click();

    expect(calls).toEqual([2]);
    expect(container.innerHTML).toBe(
      "<button><span>count: 2</span><small>click me</small></button>",
    );
  });

  it("passes JSX component event handler arrays through props for emit", () => {
    const container = document.createElement("div");
    const calls: number[] = [];

    render(
      <CounterButton
        count={3}
        onIncrement={[
          (count: number) => calls.push(count),
          (count: number) => calls.push(count + 10),
        ]}
      >
        click me
      </CounterButton>,
      container,
    );
    container.querySelector("button")?.click();

    expect(calls).toEqual([3, 13]);
  });

  it("supports JSX fragment shorthand in TSX component trees", () => {
    const container = document.createElement("div");

    render(<FragmentList />, container);

    expect(container.innerHTML).toBe("<li>Ada</li><li>Grace</li>");
  });
});
