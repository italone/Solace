import type { ComponentSetupContext } from "./component";
import type { ComponentRender, VNode } from "../vnode/vnode";

export function defineComponent<Props extends object, Result extends ComponentRender | VNode>(
  component: (props: Props, context: ComponentSetupContext) => Result,
): (props: Props, context: ComponentSetupContext) => Result {
  return component;
}
