import type { ComponentTransport, ComponentType } from "../vnode/vnode";
import type { LazyRouteComponent } from "./types";

const loadedLazyRouteComponents = new WeakMap<LazyRouteComponent, ComponentType>();

export function lazyRoute(
  load: () => Promise<{ default: ComponentTransport } | ComponentTransport>,
): LazyRouteComponent {
  return {
    __solaceLazyRouteComponent: true,
    load,
  };
}

export function getCachedLazyRouteComponent(
  component: LazyRouteComponent,
): ComponentType | undefined {
  return loadedLazyRouteComponents.get(component);
}

export function cacheLazyRouteComponent(
  component: LazyRouteComponent,
  resolved: ComponentType,
): void {
  loadedLazyRouteComponents.set(component, resolved);
}

export async function preloadLazyRouteComponent(component: LazyRouteComponent): Promise<void> {
  if (loadedLazyRouteComponents.has(component)) {
    return;
  }

  const resolved = await component.load();
  const resolvedComponent = typeof resolved === "function" ? resolved : resolved.default;
  cacheLazyRouteComponent(component, resolvedComponent as ComponentType);
}
