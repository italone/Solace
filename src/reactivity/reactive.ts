import { hasChanged, isObject } from "../shared/utils";
import { track, trigger } from "./effect";

const proxyCache = new WeakMap<object, object>();
const rawCache = new WeakMap<object, object>();

function isPlainObjectOrArray(value: object): boolean {
  if (Array.isArray(value)) {
    return true;
  }

  const proto = Object.getPrototypeOf(value);

  return proto === Object.prototype || proto === null;
}

// Assigning a nested proxy back into reactive state must store (and compare)
// the raw value, so `state.nested = state.nested` is a no-op and raw state
// never accumulates proxies.
function unwrapProxy<T>(value: T): T {
  if (isObject(value)) {
    const raw = rawCache.get(value);
    return raw !== undefined ? (raw as T) : value;
  }
  return value;
}

type ArraySearchKey = "includes" | "indexOf" | "lastIndexOf";

const arraySearchInstrumentations: Record<ArraySearchKey, (this: unknown[]) => unknown> = {
  includes(this: unknown[], ...args: unknown[]): boolean {
    return searchArray(Array.prototype.includes, this, args) as boolean;
  },
  indexOf(this: unknown[], ...args: unknown[]): number {
    return searchArray(Array.prototype.indexOf, this, args) as number;
  },
  lastIndexOf(this: unknown[], ...args: unknown[]): number {
    return searchArray(Array.prototype.lastIndexOf, this, args) as number;
  },
};

function searchArray(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  method: (this: any, ...args: any[]) => unknown,
  proxyArray: unknown[],
  args: unknown[],
): unknown {
  const result = method.apply(proxyArray, args);

  if ((result === -1 || result === false) && args.length > 0 && isObject(args[0])) {
    // The haystack yields proxied elements, so a raw needle misses even when
    // the element is present; retry with its cached proxy.
    const proxied = proxyCache.get(args[0]);
    if (proxied !== undefined) {
      return method.apply(proxyArray, [proxied, ...args.slice(1)]);
    }
  }

  return result;
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
      track(target, key);

      if (Array.isArray(target) && key in arraySearchInstrumentations) {
        return arraySearchInstrumentations[key as ArraySearchKey];
      }

      const result = Reflect.get(target, key, receiver);

      if (isObject(result) && isPlainObjectOrArray(result)) {
        return reactive(result);
      }

      return result;
    },
    set(target, key, value, receiver) {
      const rawValue = unwrapProxy(value);
      const oldValue = Reflect.get(target, key, receiver);
      const arrayTarget = Array.isArray(target) ? (target as unknown[]) : undefined;
      const oldLength = arrayTarget?.length;
      const result = Reflect.set(target, key, rawValue, receiver);

      if (hasChanged(rawValue, oldValue)) {
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
  rawCache.set(proxy, target);

  return proxy;
}
