import { jsx, type JSX } from "./jsx-runtime";

export { Fragment, jsx, jsxs } from "./jsx-runtime";
export type { JSX } from "./jsx-runtime";

export function jsxDEV(
  type: Parameters<typeof jsx>[0],
  props: Parameters<typeof jsx>[1],
  key?: string,
): JSX.Element {
  return jsx(type, props, key);
}
