import { getComponentDevtoolsName, type ComponentInstance } from "../component/component";
import { emitDevtoolsEvent, hasDevtoolsListeners } from "../devtools/events";

export function emitComponentDevtoolsEvent(
  type: "component:mount" | "component:update" | "component:unmount",
  instance: ComponentInstance,
  correlationId?: number,
): void {
  if (!hasDevtoolsListeners()) {
    return;
  }

  emitDevtoolsEvent({
    type,
    id: instance.devtoolsId,
    name: getComponentDevtoolsName(instance),
    parentId: instance.parent?.devtoolsId ?? null,
    ...(type === "component:update" && correlationId !== undefined ? { correlationId } : {}),
  });
}

export function emitRendererElementDevtoolsEvent(
  operation: "mount" | "update" | "unmount",
  tag: string,
): void {
  if (!hasDevtoolsListeners()) {
    return;
  }

  emitDevtoolsEvent({
    type: "renderer:element",
    operation,
    tag,
  });
}
