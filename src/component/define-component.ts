import type { ComponentEventMap, ComponentSetupContext, Slots } from "./component";
import type { ComponentRender, ComponentType, VNode } from "../vnode/vnode";

export function defineComponent<Props extends object, Result extends ComponentRender | VNode>(
  component: (props: Props, context: ComponentSetupContext) => Result,
): (props: Props, context: ComponentSetupContext) => Result;
export function defineComponent<
  Props extends object,
  Events extends ComponentEventMap,
  SlotMap extends object = Slots,
>(component: ComponentType<Props, Events, SlotMap>): ComponentType<Props, Events, SlotMap>;
export function defineComponent<Component>(component: Component): Component {
  return component;
}
