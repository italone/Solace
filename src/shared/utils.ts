export function hasChanged(value: unknown, oldValue: unknown): boolean {
  return !Object.is(value, oldValue);
}

export function isObject(value: unknown): value is object {
  return value !== null && typeof value === "object";
}
