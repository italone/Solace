import { describe, expect, it, vi } from "vitest";

import { computed, effect, reactive, ref, watch, watchEffect } from "../../../src/index";

describe("computed", () => {
  it("runs the getter on first read", () => {
    const getter = vi.fn(() => 2);
    const value = computed(getter);

    expect(getter).not.toHaveBeenCalled();
    expect(value.value).toBe(2);
    expect(getter).toHaveBeenCalledTimes(1);
  });

  it("returns the cached value when dependencies have not changed", () => {
    const state = reactive({ count: 1 });
    const getter = vi.fn(() => state.count + 1);
    const value = computed(getter);

    expect(value.value).toBe(2);
    expect(value.value).toBe(2);

    expect(getter).toHaveBeenCalledTimes(1);
  });

  it("recomputes on the next read after a dependency changes", () => {
    const state = reactive({ count: 1 });
    const getter = vi.fn(() => state.count + 1);
    const value = computed(getter);

    expect(value.value).toBe(2);

    state.count = 2;

    expect(getter).toHaveBeenCalledTimes(1);
    expect(value.value).toBe(3);
    expect(getter).toHaveBeenCalledTimes(2);
  });

  it("can be tracked by an effect reading value", () => {
    const state = reactive({ count: 1 });
    const value = computed(() => state.count + 1);
    let observed = 0;

    effect(() => {
      observed = value.value;
    });

    state.count = 2;

    expect(observed).toBe(3);
  });
});

describe("ref", () => {
  it("tracks value reads inside an effect", () => {
    const count = ref(1);
    let observed = 0;

    effect(() => {
      observed = count.value;
    });

    count.value = 2;

    expect(observed).toBe(2);
  });

  it("does not trigger effects when assigning the same value", () => {
    const count = ref(1);
    let runs = 0;

    effect(() => {
      runs += 1;
      void count.value;
    });

    count.value = 1;

    expect(runs).toBe(1);
  });
});

describe("watch", () => {
  it("passes new and old values to the callback", () => {
    const state = reactive({ count: 1 });
    const callback = vi.fn();

    watch(() => state.count, callback);

    state.count = 2;

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(2, 1);
  });

  it("advances the old value after each callback", () => {
    const state = reactive({ count: 1 });
    const callback = vi.fn();

    watch(() => state.count, callback);

    state.count = 2;
    state.count = 3;

    expect(callback).toHaveBeenNthCalledWith(1, 2, 1);
    expect(callback).toHaveBeenNthCalledWith(2, 3, 2);
  });

  it("returns a stop function that prevents future callbacks", () => {
    const state = reactive({ count: 1 });
    const callback = vi.fn();
    const stop = watch(() => state.count, callback);

    stop();
    state.count = 2;

    expect(callback).not.toHaveBeenCalled();
  });
});

describe("watchEffect", () => {
  it("runs immediately and tracks dependencies", () => {
    const state = reactive({ count: 1 });
    const callback = vi.fn(() => state.count);

    watchEffect(callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveReturnedWith(1);

    state.count = 2;

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveReturnedWith(2);
  });

  it("returns a stop function that prevents future runs", () => {
    const state = reactive({ count: 1 });
    const callback = vi.fn(() => state.count);
    const stop = watchEffect(callback);

    stop();
    state.count = 2;

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
