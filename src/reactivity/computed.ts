import { ReactiveEffect, track, trigger } from "./effect";

export interface ComputedRef<T> {
  readonly value: T;
}

export function computed<T>(getter: () => T): ComputedRef<T> {
  let dirty = true;
  let value: T;

  const computedRef = {
    get value(): T {
      if (dirty) {
        value = reactiveEffect.run();
        dirty = false;
      }

      track(computedRef, "value");

      return value;
    },
  };

  const reactiveEffect = new ReactiveEffect(getter, () => {
    if (!dirty) {
      dirty = true;
      trigger(computedRef, "value");
    }
  });

  return computedRef;
}
