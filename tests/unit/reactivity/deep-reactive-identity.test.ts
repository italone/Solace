import { describe, expect, it, vi } from "vitest";

import { effect } from "../../../src/reactivity/effect";
import { reactive } from "../../../src/reactivity/reactive";

describe("deep reactive identity", () => {
  it("finds raw object elements with includes/indexOf through the proxy", () => {
    const raw = { id: 1 };
    const state = reactive({ items: [raw] });

    expect(state.items[0]).not.toBe(raw);
    expect(state.items.includes(raw)).toBe(true);
    expect(state.items.indexOf(raw)).toBe(0);
    expect(state.items.lastIndexOf(raw)).toBe(0);

    const missing = { id: 2 };
    expect(state.items.includes(missing)).toBe(false);
    expect(state.items.indexOf(missing)).toBe(-1);
  });

  it("finds proxied elements when searching with a proxied needle", () => {
    const state = reactive({ items: [{ id: 1 }] });
    const proxied = state.items[0];

    expect(state.items.includes(proxied)).toBe(true);
    expect(state.items.indexOf(proxied)).toBe(0);
  });

  it("does not re-trigger effects when a nested proxy is assigned back to itself", () => {
    const state = reactive({ nested: { count: 0 } });
    const spy = vi.fn(() => state.nested.count);

    effect(spy);

    expect(spy).toHaveBeenCalledTimes(1);

    state.nested = state.nested;

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("stores raw values instead of proxies when assigning nested proxies", () => {
    const state = reactive({} as { nested?: { count: number } });
    const inner = reactive({ count: 1 });

    state.nested = inner;

    // Reading back returns the same proxy, not a double wrap.
    expect(state.nested).toBe(inner);
  });
});
