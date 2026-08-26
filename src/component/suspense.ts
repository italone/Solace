import { getCurrentInstance } from "./lifecycle";
import { getAsyncComponentMetadata } from "./async-component";
import { h } from "../vnode/h";
import { Fragment, type ComponentType, type VNode, type VNodeChildren } from "../vnode/vnode";

export interface SuspenseProps {
  fallback?: VNode | (() => VNode);
}

export function resolveSuspenseFallback(props: SuspenseProps): VNode | null {
  const fallback = props.fallback;
  if (fallback === undefined) return null;
  return typeof fallback === "function" ? fallback() : fallback;
}

const suspenseMarker = Symbol("solace.suspense");

export function isSuspense(type: unknown): boolean {
  return (
    (typeof type === "object" || typeof type === "function") &&
    type !== null &&
    (type as { [suspenseMarker]?: boolean })[suspenseMarker] === true
  );
}

function markSuspense<Props extends object>(component: ComponentType<Props>): void {
  (component as unknown as { [suspenseMarker]?: boolean })[suspenseMarker] = true;
}

interface CollectedLoaders {
  loaders: (() => Promise<unknown>)[];
  allResolved: boolean;
}

export function collectAsyncLoaders(children: VNodeChildren | undefined): CollectedLoaders {
  const loaders: (() => Promise<unknown>)[] = [];
  let unresolved = false;
  walk(children);
  return { loaders, allResolved: !unresolved };

  function walk(value: VNodeChildren | VNode | null | undefined): void {
    if (value === null || value === undefined || typeof value === "string") {
      return;
    }

    if (Array.isArray(value)) {
      for (const child of value) {
        walk(child);
      }
      return;
    }

    if (!isVNodeValue(value)) {
      return;
    }

    const metadata = getAsyncComponentMetadata(value.type);
    if (metadata !== undefined) {
      if (metadata.peek() === null) {
        unresolved = true;
        loaders.push(() => metadata.load());
      }
      return;
    }

    if (isSuspense(value.type)) {
      return;
    }

    walk(value.children as VNodeChildren);
  }
}

function isVNodeValue(value: unknown): value is VNode {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "shapeFlag" in (value as object)
  );
}

export const Suspense: ComponentType<SuspenseProps> = (props, { slots }) => {
  const instance = getCurrentInstance();
  const update = instance?.update ?? null;
  const children = (slots.default?.() ?? null) as VNodeChildren;
  const { loaders, allResolved } = collectAsyncLoaders(children);

  let resolved = allResolved;

  if (!resolved) {
    void Promise.all(loaders.map((load) => load())).then(
      () => {
        resolved = true;
        update?.();
      },
      (error: unknown) => {
        console.error("Suspense subtree loader failed:", error);
        update?.();
      },
    );
  }

  return () => {
    const fallbackVNode = resolveSuspenseFallback(props);

    if (resolved) {
      return h(Fragment, null, children);
    }

    if (fallbackVNode === null) {
      return h(Fragment, null, []);
    }

    return fallbackVNode;
  };
};

markSuspense(Suspense);
