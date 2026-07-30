import type { ComponentRender, VNodeProps } from "../vnode/vnode";
import { Fragment } from "../vnode/vnode";
import { h } from "../vnode/h";
import { useRoute, useRouter } from "./router";
import type { LazyRouteComponent, RouteComponent, RouteLocationRaw } from "./types";

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

  return () => {
    const component = route.value.matched[0]?.component;
    return component == null || isLazyRouteComponent(component)
      ? h(Fragment, null, [])
      : h(component);
  };
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
