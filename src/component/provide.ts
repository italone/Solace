import { getCurrentInstance } from "./lifecycle";

export type ProvideKey = string | symbol;
export type Provides = Map<ProvideKey, unknown>;

export function provide<T>(key: ProvideKey, value: T): void {
  const instance = getCurrentInstance();

  if (instance === null) {
    return;
  }

  instance.provides.set(key, value);
}

export function inject<T>(key: ProvideKey): T | undefined;
export function inject<T>(key: ProvideKey, defaultValue: T): T;
export function inject<T>(key: ProvideKey, defaultValue?: T): T | undefined {
  const instance = getCurrentInstance();

  if (instance === null) {
    return defaultValue;
  }

  let parent = instance.parent;
  while (parent !== null) {
    if (parent.provides.has(key)) {
      return parent.provides.get(key) as T;
    }

    parent = parent.parent;
  }

  if (instance.appProvides?.has(key)) {
    return instance.appProvides.get(key) as T;
  }

  return defaultValue;
}
