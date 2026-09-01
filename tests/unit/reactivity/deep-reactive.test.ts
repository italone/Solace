import { describe, expect, it, vi } from "vitest";

import { effect } from "../../../src/reactivity/effect";
import { reactive, shallowReactive } from "../../../src/reactivity/reactive";

describe("deep reactive", () => {
  it("reruns effects when a nested object property mutates through the proxy", () => {
    const state = reactive({ nested: { count: 0 } });
    const spy = vi.fn(() => state.nested.count);

    effect(spy);

    expect(spy).toHaveBeenCalledTimes(1);

    state.nested.count = 1;

    expect(spy).toHaveBeenCalledTimes(2);
    expect(state.nested.count).toBe(1);
  });

  it("reruns effects reading array length when an item is pushed", () => {
    const state = reactive({ items: [] as number[] });
    const spy = vi.fn(() => state.items.length);

    effect(spy);

    expect(spy).toHaveBeenCalledTimes(1);

    state.items.push(1);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(state.items.length).toBe(1);
  });

  it("reruns effects reading an array index when an item is pushed", () => {
    const state = reactive({ items: [] as number[] });
    const spy = vi.fn(() => state.items[0]);

    effect(spy);

    state.items.push(1);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(state.items[0]).toBe(1);
  });

  it("returns the same nested proxy on repeated reads", () => {
    const state = reactive({ nested: { count: 0 } });

    expect(state.nested).toBe(state.nested);
  });

  it("returns the same proxy for repeated reactive() calls on the same target", () => {
    const target = { count: 0 };

    expect(reactive(target)).toBe(reactive(target));
  });

  it("is idempotent on an already-reactive proxy", () => {
    const proxy = reactive({ count: 0 });

    expect(reactive(proxy)).toBe(proxy);
  });

  it("returns non-plain values like Date unwrapped", () => {
    const date = new Date(0);
    const state = reactive({ when: date });

    expect(state.when).toBe(date);
  });

  it("tracks two levels deep", () => {
    const state = reactive({ a: { b: { c: 0 } } });
    const spy = vi.fn(() => state.a.b.c);

    effect(spy);

    state.a.b.c = 42;

    expect(spy).toHaveBeenCalledTimes(2);
    expect(state.a.b.c).toBe(42);
  });

  it("keeps shallowReactive shallow while reactive stays deep", () => {
    const shallow = shallowReactive({ nested: { count: 0 } });
    const deepSpy = vi.fn(() => shallow.nested.count);

    effect(deepSpy);

    shallow.nested.count = 1;

    expect(deepSpy).toHaveBeenCalledTimes(1);
    expect(shallow.nested).toEqual({ count: 1 });
    expect(shallow.nested).not.toBe(undefined);
  });
});
