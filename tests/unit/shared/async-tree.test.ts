import { describe, expect, it } from "vitest";

import { h, inject, onMounted, provide, useStyle } from "../../../src";
import type { AsyncComponentType, VNode } from "../../../src";
import {
  prepareAsyncSource,
  type PreparedAsyncTree,
  type PreparedVNode,
} from "../../../src/shared/async-tree";

type SerializedPreparedShape =
  | string
  | {
      type?: string;
      component?: true;
      children?: string | SerializedPreparedShape[] | null;
      subtree?: SerializedPreparedShape;
    };

function serializePreparedShape(prepared: PreparedVNode): SerializedPreparedShape {
  if (prepared.component !== null) {
    return {
      component: true,
      subtree: serializePreparedShape(prepared.component.subtree),
    };
  }

  return {
    type: String(prepared.vnode.type),
    children:
      typeof prepared.children === "string"
        ? prepared.children
        : (prepared.children?.map(serializePreparedShape) ?? null),
  };
}

describe("async tree preparation", () => {
  it("resolves promised roots, async components, and promised children", async () => {
    const AsyncChild: AsyncComponentType = async () => () => h("strong", null, "component");
    const source = Promise.resolve(
      h("section", null, [Promise.resolve(h("span", null, "child")), h(AsyncChild)]),
    );

    const prepared = await prepareAsyncSource(source, {
      appProvides: null,
      collectStyles: true,
    });

    expect(serializePreparedShape(prepared.root)).toEqual({
      type: "section",
      children: [
        { type: "span", children: "child" },
        { component: true, subtree: { type: "strong", children: "component" } },
      ],
    });
    expect(prepared.styles).toEqual([]);
  });

  it("restores component context for a resolved synchronous render function", async () => {
    const mounted = (): void => undefined;
    const Child = () =>
      h("p", null, `${inject("parent", "missing")}:${inject("child", "missing")}`);
    const AsyncParent: AsyncComponentType = async () => {
      await Promise.resolve();
      return () => {
        const parent = inject("parent", "missing");
        provide("child", "provided");
        onMounted(mounted);
        useStyle("async-context", ".async-context { color: blue; }");
        return h(Child, { parent });
      };
    };

    const prepared = await prepareAsyncSource(h(AsyncParent), {
      appProvides: new Map([["parent", "app"]]),
      collectStyles: true,
    });

    expect(prepared.root.component?.instance.mounted).toEqual([mounted]);
    expect(prepared.root.component?.subtree.component?.subtree.vnode.children).toBe("app:provided");
    expect(prepared.styles).toEqual([
      '<style data-s-id="async-context">.async-context { color: blue; }</style>',
    ]);
  });

  it("propagates source rejections without wrapping the original error", async () => {
    const failure = new Error("source failed");

    await expect(
      prepareAsyncSource(Promise.reject(failure), {
        appProvides: null,
        collectStyles: false,
      }),
    ).rejects.toBe(failure);
  });

  it("rejects invalid async component results", async () => {
    const InvalidAsyncComponent = (async () => 42) as unknown as AsyncComponentType;

    await expect(
      prepareAsyncSource(h(InvalidAsyncComponent), {
        appProvides: null,
        collectStyles: false,
      }),
    ).rejects.toThrow(TypeError("Async component must resolve to a VNode or render function"));
  });

  it("keeps concurrent style collection isolated", async () => {
    let releaseFirst!: () => void;
    let releaseSecond!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const createAsyncStyled =
      (scopeId: string, gate: Promise<void>): AsyncComponentType =>
      async () => {
        useStyle(scopeId, `.${scopeId} { color: red; }`);
        await gate;
        return () => h("p", { class: scopeId }, scopeId);
      };

    const first = prepareAsyncSource(h(createAsyncStyled("first", firstGate)), {
      appProvides: null,
      collectStyles: true,
    });
    const second = prepareAsyncSource(h(createAsyncStyled("second", secondGate)), {
      appProvides: null,
      collectStyles: true,
    });

    releaseSecond();
    releaseFirst();

    const [firstPrepared, secondPrepared]: PreparedAsyncTree[] = await Promise.all([first, second]);
    expect(firstPrepared.styles).toEqual([
      '<style data-s-id="first">.first { color: red; }</style>',
    ]);
    expect(secondPrepared.styles).toEqual([
      '<style data-s-id="second">.second { color: red; }</style>',
    ]);
  });

  it("keeps fixed async VNode results distinct from synchronous render functions", async () => {
    const FixedAsync: AsyncComponentType = async () => h("p", null, "fixed");
    const ReactiveAsync: AsyncComponentType = async () => () => h("p", null, "render");

    const fixed = await prepareAsyncSource(h(FixedAsync), {
      appProvides: null,
      collectStyles: false,
    });
    const reactive = await prepareAsyncSource(h(ReactiveAsync), {
      appProvides: null,
      collectStyles: false,
    });

    expect(fixed.root.component?.fixed).toBe(true);
    expect(reactive.root.component?.fixed).toBe(false);
    expect((fixed.root.component?.subtree.vnode as VNode).type).toBe("p");
  });
});
