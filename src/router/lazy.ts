import type { ComponentType } from "../vnode/vnode";
import type { LazyRouteComponent } from "./types";

export function lazyRoute(
  load: () => Promise<{ default: ComponentType } | ComponentType>,
): LazyRouteComponent {
  return {
    __solaceLazyRouteComponent: true,
    load,
  };
}
