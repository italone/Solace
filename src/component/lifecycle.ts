import type { ComponentInstance } from "./component";

export type LifecycleHook = () => void;

let currentInstance: ComponentInstance | null = null;

export function setCurrentInstance(instance: ComponentInstance | null): void {
  currentInstance = instance;
}

export function getCurrentInstance(): ComponentInstance | null {
  return currentInstance;
}

export function onMounted(hook: LifecycleHook): void {
  injectHook("mounted", hook);
}

export function onUpdated(hook: LifecycleHook): void {
  injectHook("updated", hook);
}

export function onUnmounted(hook: LifecycleHook): void {
  injectHook("unmounted", hook);
}

export function callHooks(hooks: LifecycleHook[]): void {
  for (const hook of hooks) {
    hook();
  }
}

function injectHook(type: "mounted" | "updated" | "unmounted", hook: LifecycleHook): void {
  if (currentInstance === null) {
    return;
  }

  currentInstance[type].push(hook);
}
