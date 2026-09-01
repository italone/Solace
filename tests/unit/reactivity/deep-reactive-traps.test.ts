import { describe, expect, it, vi } from "vitest";

import { effect } from "../../../src/reactivity/effect";
import { reactive } from "../../../src/reactivity/reactive";

function lastResult<T>(spy: { mock: { results: { value: T }[] } }): T {
  const results = spy.mock.results;
  return results[results.length - 1].value;
}

describe("deep reactive collection traps", () => {
  it("reruns effects enumerating keys when a key is added or deleted", () => {
    const state = reactive<{ a?: number; b?: number }>({ a: 1 });
    const spy = vi.fn(() => Object.keys(state).join(","));

    effect(spy);
    expect(spy).toHaveBeenCalledTimes(1);

    state.b = 2;
    expect(spy).toHaveBeenCalledTimes(2);

    delete state.a;
    expect(spy).toHaveBeenCalledTimes(3);
    expect(lastResult(spy)).toBe("b");
  });

  it("reruns effects using the in operator when a key is deleted", () => {
    const state = reactive<{ nested: { a?: number } }>({ nested: { a: 1 } });
    const spy = vi.fn(() => "a" in state.nested);

    effect(spy);
    expect(spy).toHaveBeenCalledTimes(1);

    delete state.nested.a;
    expect(spy).toHaveBeenCalledTimes(2);
    expect(lastResult(spy)).toBe(false);
  });

  it("triggers effects when a nested object property is deleted", () => {
    const state = reactive<{ nested: { count?: number } }>({ nested: { count: 1 } });
    const spy = vi.fn(() => state.nested.count);

    effect(spy);

    delete state.nested.count;

    expect(spy).toHaveBeenCalledTimes(2);
    expect(lastResult(spy)).toBe(undefined);
  });

  it("triggers length effects when array elements are deleted", () => {
    const state = reactive({ items: [1, 2, 3] });
    const spy = vi.fn(() => state.items.length);

    effect(spy);

    delete state.items[2];

    expect(spy).toHaveBeenCalledTimes(2);
  });
});
