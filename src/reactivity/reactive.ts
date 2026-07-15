import { hasChanged, isObject } from "../shared/utils";
import { track, trigger } from "./effect";

export function reactive<T extends object>(target: T): T {
  if (!isObject(target)) {
    return target;
  }

  return new Proxy(target, {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver);

      track(target, key);

      return result;
    },
    set(target, key, value, receiver) {
      const oldValue = Reflect.get(target, key, receiver);
      const result = Reflect.set(target, key, value, receiver);

      if (hasChanged(value, oldValue)) {
        trigger(target, key);
      }

      return result;
    },
  });
}
