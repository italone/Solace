import type { ComponentTransport } from "../vnode/vnode";
import type { LazyRouteComponent } from "./types";

export function lazyRoute(
  load: () => Promise<{ default: ComponentTransport } | ComponentTransport>,
): LazyRouteComponent {
  return {
    __solaceLazyRouteComponent: true,
    load,
  };
}
