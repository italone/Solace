import type { ComponentRender, ComponentType, VNodeProps } from "../vnode/vnode";
import type { ComponentSetupContext } from "../component/component";
import { Fragment } from "../vnode/vnode";
import { h } from "../vnode/h";
import { defineAsyncComponent } from "../component/async-component";
import { inject, provide } from "../component/provide";
import type { Ref } from "../reactivity/ref";
import { routerHrefFormatterKey, type RouterHrefFormatter } from "./internal";
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
  { slots }: ComponentSetupContext,
): ComponentRender {
  const router = useRouter();

  return () => {
    const { to, replace, onClick, ...anchorProps } = props;
    const hrefFormatter = router as typeof router & Partial<RouterHrefFormatter>;
    const href = hrefFormatter[routerHrefFormatterKey]?.(to) ?? router.resolve(to).fullPath;

    return h(
      "a",
      {
        ...anchorProps,
        href,
        onClick: (event: MouseEvent) => {
          if (typeof onClick === "function") {
            onClick(event);
          }

          if (shouldIgnoreClick(event, anchorProps)) {
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
    const resolvedComponent = resolveRouteComponent(component, route);
    if (resolvedComponent === null) {
      return h(Fragment, null, []);
    }

    return h(resolvedComponent, resolveRouteProps(record, route.value));
  };
}

const lazyRouteComponentCache = new WeakMap<object, ComponentType>();
const lazyRouteComponentWrappers = new WeakMap<object, WeakMap<object, ComponentType>>();

function resolveRouteComponent(
  component: RouteComponent | null | undefined,
  route: Ref<RouteLocationNormalized>,
): ComponentType | null {
  if (component == null) {
    return null;
  }

  if (!isLazyRouteComponent(component)) {
    return component as ComponentType;
  }

  const cached = lazyRouteComponentCache.get(component);
  if (cached !== undefined) {
    return cached;
  }

  const wrappers = lazyRouteComponentWrappers.get(component);
  const wrapper = wrappers?.get(route);
  if (wrapper !== undefined) {
    return wrapper;
  }

  const asyncWrapper = defineAsyncComponent({
    loader: () =>
      component
        .load()
        .then((resolved) => {
          const resolvedComponent = typeof resolved === "function" ? resolved : resolved.default;
          const normalizedComponent = resolvedComponent as ComponentType;
          lazyRouteComponentCache.set(component, normalizedComponent);
          return normalizedComponent;
        })
        .catch(() => {
          const errorRoute = route.value;
          throw new RouterNavigationError(
            "Lazy route component failed to load",
            "lazy-load-failed",
            errorRoute,
            errorRoute,
          );
        }),
    errorComponent: () => {
      const errorRoute = route.value;
      throw new RouterNavigationError(
        "Lazy route component failed to load",
        "lazy-load-failed",
        errorRoute,
        errorRoute,
      );
    },
  });

  const routeWrappers = wrappers ?? new WeakMap<object, ComponentType>();
  routeWrappers.set(route, asyncWrapper);
  lazyRouteComponentWrappers.set(component, routeWrappers);
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

function resolveRouteProps(
  record: RouteRecord | undefined,
  route: RouteLocationNormalized,
): Record<string, unknown> | null {
  const props = record?.props;

  if (props === undefined || props === false) {
    return null;
  }

  if (props === true) {
    return { ...route.params };
  }

  if (typeof props === "function") {
    const resolved = props(route);
    if (!isPlainObject(resolved)) {
      throw new TypeError("Router route record props function must return a plain object");
    }

    return resolved;
  }

  return props;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
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

function shouldIgnoreClick(event: MouseEvent, anchorProps: VNodeProps): boolean {
  return (
    event.defaultPrevented ||
    (event.button !== undefined && event.button !== 0) ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey ||
    hasNonSelfTarget(anchorProps.target) ||
    hasDownloadAttribute(anchorProps.download)
  );
}

function hasNonSelfTarget(target: unknown): boolean {
  return typeof target === "string" && target !== "" && target.toLowerCase() !== "_self";
}

function hasDownloadAttribute(download: unknown): boolean {
  return download !== undefined && download !== null && download !== false;
}
