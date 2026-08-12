import type { ComponentEventMap, ComponentSetupContext } from "./component";
import type { ComponentRender, ComponentType, VNode } from "../vnode/vnode";

export function defineComponent<Props extends object, Result extends ComponentRender | VNode>(
  component: (props: Props, context: ComponentSetupContext) => Result,
): (props: Props, context: ComponentSetupContext) => Result;
export function defineComponent<Props extends object, Events extends ComponentEventMap>(
  component: ComponentType<Props, Events>,
): ComponentType<Props, Events>;
export function defineComponent<Component>(component: Component): Component {
  return component;
}
