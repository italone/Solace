import { hasChanged } from "../shared/utils";
import { track, trigger } from "./effect";

export interface Ref<T> {
  value: T;
}

export function ref<T>(value: T): Ref<T> {
  const refObject = {
    get value(): T {
      track(refObject, "value");

      return value;
    },
    set value(newValue: T) {
      if (!hasChanged(newValue, value)) {
        return;
      }

      value = newValue;
      trigger(refObject, "value");
    },
  };

  return refObject;
}
