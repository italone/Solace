import type { ComponentInstance } from "./component";
import type { ComponentProps, VNodeProps } from "../vnode/vnode";

export function initProps(instance: ComponentInstance, rawProps: VNodeProps | null): void {
  instance.props = normalizeProps(rawProps);
}

export function updateProps(instance: ComponentInstance, rawProps: VNodeProps | null): void {
  const nextProps = normalizeProps(rawProps);

  for (const key of Object.keys(instance.props)) {
    if (!(key in nextProps)) {
      delete instance.props[key];
    }
  }

  for (const [key, value] of Object.entries(nextProps)) {
    instance.props[key] = value;
  }
}

function normalizeProps(rawProps: VNodeProps | null): ComponentProps {
  if (rawProps === null) {
    return {};
  }

  const props: ComponentProps = {};

  for (const [key, value] of Object.entries(rawProps)) {
    if (key !== "key") {
      props[key] = value;
    }
  }

  return props;
}
