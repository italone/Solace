import { hasChanged, isObject } from "../shared/utils";
import { track, trigger } from "./effect";

const proxyCache = new WeakMap<object, object>();

function isPlainObjectOrArray(value: object): boolean {
  if (Array.isArray(value)) {
    return true;
  }

  const proto = Object.getPrototypeOf(value);

  return proto === Object.prototype || proto === null;
}

export function shallowReactive<T extends object>(target: T): T {
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

export function reactive<T extends object>(target: T): T {
  if (!isObject(target)) {
    return target;
  }

  const cached = proxyCache.get(target);
  if (cached !== undefined) {
    return cached as T;
  }

  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver);

      track(target, key);

      if (isObject(result) && isPlainObjectOrArray(result)) {
        return reactive(result);
      }

      return result;
    },
    set(target, key, value, receiver) {
      const oldValue = Reflect.get(target, key, receiver);
      const arrayTarget = Array.isArray(target) ? (target as unknown[]) : undefined;
      const oldLength = arrayTarget?.length;
      const result = Reflect.set(target, key, value, receiver);

      if (hasChanged(value, oldValue)) {
        trigger(target, key);
      }

      if (arrayTarget !== undefined && arrayTarget.length !== oldLength) {
        trigger(target, "length");
      }

      return result;
    },
  });

  proxyCache.set(target, proxy);
  proxyCache.set(proxy, proxy);

  return proxy;
}
