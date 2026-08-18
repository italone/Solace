import { describe, expect, expectTypeOf, it } from "vitest";

import {
  createApp,
  defineComponent,
  type ComponentEventMap,
  type ComponentSetupContext,
  type VNode,
  type VNodeChild,
} from "@italone/solace";

type CardSlots = {
  header?: () => VNodeChild;
  default?: () => VNodeChild;
  footer?: () => VNodeChild;
};

const Card = defineComponent<object, ComponentEventMap, CardSlots>(
  (_props: object, { slots }: ComponentSetupContext<ComponentEventMap, CardSlots>) => {
    return () => (
      <div>
        {slots.header?.()}
        {slots.default?.()}
        {slots.footer?.()}
      </div>
    );
  },
);

describe("typed slots (type-level)", () => {
  it("accepts named slots with correct types", () => {
    expectTypeOf(
      <Card v-slots={{ header: () => <header />, footer: () => <footer /> }}>body</Card>,
    ).toEqualTypeOf<VNode>();
  });

  it("accepts named slots without JSX children when no default slot is passed", () => {
    expectTypeOf(<Card v-slots={{ header: () => <header /> }} />).toEqualTypeOf<VNode>();
  });

  it("rejects unknown named slots", () => {
    // @ts-expect-error typed named slots reject unknown slot names
    <Card v-slots={{ aside: () => <aside /> }} />;
  });

  it("rejects non-function slot values", () => {
    // @ts-expect-error typed named slots only accept slot functions
    <Card v-slots={{ header: "header" }} />;
  });
});

describe("typed slots runtime", () => {
  it("renders named slots from JSX", () => {
    const container = document.createElement("div");

    createApp(() => (
      <Card v-slots={{ header: () => <span>header</span>, footer: () => <span>footer</span> }}>
        body
      </Card>
    )).mount(container);

    expect(container.textContent).toContain("header");
    expect(container.textContent).toContain("body");
    expect(container.textContent).toContain("footer");
  });

  it("renders named slots without JSX children", () => {
    const container = document.createElement("div");

    createApp(() => <Card v-slots={{ header: () => <span>only-header</span> }} />).mount(container);

    expect(container.textContent).toContain("only-header");
  });
});
