import { describe, expect, it } from "vitest";

import { render } from "../../../src";
import { jsxDEV } from "../../../src/jsx-dev-runtime";
import { jsx } from "../../../src/jsx-runtime";
import type { ComponentSetupContext } from "../../../src";

const incrementCalls: number[] = [];
const Row = (props: { label: string }) => <li>{props.label}</li>;
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

<button onClick={(event: MouseEvent) => event.preventDefault()}>click</button>;

// @ts-expect-error component props still require declared fields
<Row key="missing-label" />;

// @ts-expect-error JSX key only accepts strings or numbers
<Row key={false} label="Invalid" />;

// @ts-expect-error JSX event handlers must be functions or arrays of functions
<CounterButton count={1} onIncrement="increment">
  click me
</CounterButton>;

// @ts-expect-error DOM event handlers must be functions
<button onClick="click">click</button>;

// @ts-expect-error DOM event handlers do not accept function arrays
<button onClick={[() => undefined]}>click</button>;

// @ts-expect-error direct jsx DOM props reject non-function handlers
jsx("button", { onClick: "click" });

// @ts-expect-error direct jsx component props reject non-function handlers
jsx(CounterButton, { count: 1, onIncrement: "increment" });

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
