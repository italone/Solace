import type { ComponentRender, ComponentType, VNodeProps } from "../vnode/vnode";
import { Fragment } from "../vnode/vnode";
import { h } from "../vnode/h";
import { defineAsyncComponent } from "../component/async-component";
import { inject, provide } from "../component/provide";
import { RouterNavigationError, routerViewDepthKey, useRoute, useRouter } from "./router";
import type {
  LazyRouteComponent,
  RouteComponent,
  RouteLocationNormalized,
  RouteLocationRaw,
  RouteRecord,
} from "./types";

export interface RouterLinkProps extends VNodeProps {
  to: RouteLocationRaw;
  replace?: boolean;
}

export function RouterLink(
  props: RouterLinkProps,
  { slots }: { slots: { default?: () => unknown } },
): ComponentRender {
  const router = useRouter();

  return () => {
    const { to, replace, onClick, ...anchorProps } = props;
    const href = router.resolve(to).fullPath;

    return h(
      "a",
      {
        ...anchorProps,
        href,
        onClick: (event: MouseEvent) => {
          if (typeof onClick === "function") {
            onClick(event);
          }

          if (shouldIgnoreClick(event)) {
            return;
          }

          event.preventDefault();
          if (replace === true) {
            router.replace(to);
          } else {
            router.push(to);
          }
        },
      },
      (slots.default?.() as never) ?? href,
    );
  };
}

export function RouterView(): ComponentRender {
  const route = useRoute();
  const depth = inject<number>(routerViewDepthKey, 0);
  provide(routerViewDepthKey, depth + 1);

  return () => {
    const record = getRenderableRecord(route.value.matched, depth);
    const component = record?.component;
    const resolvedComponent = resolveRouteComponent(component, route.value);
    return resolvedComponent === null ? h(Fragment, null, []) : h(resolvedComponent);
  };
}

const lazyRouteComponentCache = new WeakMap<object, ComponentType>();
const lazyRouteComponentWrappers = new WeakMap<object, ComponentType>();

function resolveRouteComponent(
  component: RouteComponent | null | undefined,
  route: RouteLocationNormalized,
): ComponentType | null {
  if (component == null) {
    return null;
  }

  if (!isLazyRouteComponent(component)) {
    return component;
  }

  const cached = lazyRouteComponentCache.get(component);
  if (cached !== undefined) {
    return cached;
  }

  const wrapper = lazyRouteComponentWrappers.get(component);
  if (wrapper !== undefined) {
    return wrapper;
  }

  let loadError: RouterNavigationError | null = null;
  const asyncWrapper = defineAsyncComponent({
    loader: () =>
      component
        .load()
        .then((resolved) => {
          const resolvedComponent = typeof resolved === "function" ? resolved : resolved.default;
          lazyRouteComponentCache.set(component, resolvedComponent);
          return resolvedComponent;
        })
        .catch(() => {
          loadError = new RouterNavigationError(
            "Lazy route component failed to load",
            "lazy-load-failed",
            route,
            route,
          );
          throw loadError;
        }),
    errorComponent: () => {
      throw (
        loadError ??
        new RouterNavigationError(
          "Lazy route component failed to load",
          "lazy-load-failed",
          route,
          route,
        )
      );
    },
  });

  lazyRouteComponentWrappers.set(component, asyncWrapper);
  return asyncWrapper;
}

function getRenderableRecord(records: RouteRecord[], depth: number): RouteRecord | undefined {
  let renderable = 0;

  for (const record of records) {
    if (record.component == null) {
      continue;
    }

    if (renderable === depth) {
      return record;
    }

    renderable += 1;
  }

  return undefined;
}

function isLazyRouteComponent(
  component: RouteComponent | null | undefined | unknown,
): component is LazyRouteComponent {
  return (
    typeof component === "object" &&
    component !== null &&
    "__solaceLazyRouteComponent" in component &&
    component.__solaceLazyRouteComponent === true
  );
}

function shouldIgnoreClick(event: MouseEvent): boolean {
  return (
    event.defaultPrevented ||
    (event.button !== undefined && event.button !== 0) ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey
  );
}
