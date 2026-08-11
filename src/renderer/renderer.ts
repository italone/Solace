import { ReactiveEffect } from "../reactivity/effect";
import { queueJob } from "../scheduler/scheduler";
import type { Provides } from "../component/provide";
import { prepareAsyncSource, type PreparedVNode } from "../shared/async-tree";
import { createDocumentStyleSink, withStyleSink, type StyleSink } from "../component/style";
import { h } from "../vnode/h";
import type { AsyncComponentType, ComponentType, VNode } from "../vnode/vnode";
import { patch } from "./diff";
import {
  assertNoExtraDomNode,
  hydratePreparedVNode,
  hydrateVNode,
  SolaceHydrationError,
  stopHydratedComponentUpdates,
  type HydrationContext,
} from "./hydration";

export type RenderSource = VNode | (() => VNode);
export type HydrationSource = VNode | ComponentType;
export type AsyncHydrationSource = HydrationSource | AsyncComponentType;
export interface HydrationOptions {
  recover?: boolean;
}
type RenderContainer = Element & {
  _solaceRenderEffect?: ReactiveEffect<void>;
  _solaceVNode?: VNode | null;
};

export function render(
  source: RenderSource,
  container: Element,
  appProvides: Provides | null = null,
): void {
  const renderContainer = container as RenderContainer;
  const styleSink = createDocumentStyleSink(container.ownerDocument);

  if (typeof source === "function") {
    renderReactiveSource(source, renderContainer, appProvides, styleSink);
    return;
  }

  stopReactiveRender(renderContainer);
  withStyleSink(styleSink, () => renderVNode(source, renderContainer, appProvides));
}

export function hydrate(
  source: HydrationSource,
  container: Element,
  appProvides: Provides | null = null,
  options: HydrationOptions = {},
): void {
  assertNoDeferredIntegrationOptions(options);
  assertNoAsyncHydrationSource(source);
  const renderContainer = container as RenderContainer;
  const styleSink = createDocumentStyleSink(container.ownerDocument);
  const getVNode = (): VNode => normalizeHydrationSource(source);

  stopReactiveRender(renderContainer);

  let hydrated = false;
  const update = (): void => {
    withStyleSink(styleSink, () => {
      const vnode = getVNode();
      if (!hydrated) {
        hydrateInitialTree(vnode, renderContainer, appProvides, options);
        hydrated = true;
        return;
      }

      renderVNode(vnode, renderContainer, appProvides);
    });
  };
  const reactiveEffect = new ReactiveEffect(update, () => {
    queueJob(job);
  });
  const runner = reactiveEffect.run.bind(reactiveEffect);
  const job = (): void => {
    if (renderContainer._solaceRenderEffect === reactiveEffect) {
      runner();
    }
  };

  renderContainer._solaceRenderEffect = reactiveEffect;
  try {
    runner();
  } catch (error) {
    if (renderContainer._solaceRenderEffect === reactiveEffect) {
      reactiveEffect.stop();
      renderContainer._solaceRenderEffect = undefined;
    }

    throw error;
  }
}

export async function hydrateAsync(
  source: AsyncHydrationSource,
  container: Element,
  appProvides: Provides | null = null,
  options: HydrationOptions = {},
): Promise<void> {
  assertHydrationContainer(container);
  assertNoDeferredIntegrationOptions(options);
  const prepared = await prepareAsyncSource(source, {
    appProvides,
    collectStyles: true,
  });
  const renderContainer = container as RenderContainer;
  const context: HydrationContext = { hydratedInstances: [] };
  const styleSink = createDocumentStyleSink(container.ownerDocument);

  stopReactiveRender(renderContainer);
  for (const registration of prepared.registrations) {
    styleSink.register(registration.scopeId, registration.css);
  }

  try {
    const next = hydratePreparedVNode(
      prepared.root,
      renderContainer.firstChild,
      null,
      appProvides,
      context,
    );
    assertNoExtraDomNode(next, "root[1]");
    renderContainer._solaceVNode = prepared.root.vnode;
  } catch (error) {
    stopHydratedComponentUpdates(context);

    if (shouldRecoverHydrationMismatch(error, options)) {
      recoverPreparedHydration(prepared.root, renderContainer, appProvides);
      return;
    }

    throw error;
  }
}

function recoverPreparedHydration(
  prepared: PreparedVNode,
  container: RenderContainer,
  appProvides: Provides | null,
): void {
  container.textContent = "";
  container._solaceVNode = null;
  const materialized = materializePreparedVNode(prepared);
  renderVNode(materialized, container, appProvides);
  resetPreparedHydrationState(prepared);

  const context: HydrationContext = { hydratedInstances: [] };
  try {
    const next = hydratePreparedVNode(prepared, container.firstChild, null, appProvides, context);
    assertNoExtraDomNode(next, "root[1]");
    container._solaceVNode = prepared.vnode;
  } catch (error) {
    stopHydratedComponentUpdates(context);
    throw error;
  }
}

function materializePreparedVNode(prepared: PreparedVNode): VNode {
  if (prepared.component !== null) {
    return materializePreparedVNode(prepared.component.subtree);
  }

  const vnode: VNode = {
    ...prepared.vnode,
    props: prepared.vnode.props === null ? null : { ...prepared.vnode.props },
    el: null,
    component: null,
  };

  if (typeof prepared.children === "string" || prepared.children === null) {
    vnode.children = prepared.children;
  } else {
    vnode.children = prepared.children.map(materializePreparedVNode);
  }

  return vnode;
}

function resetPreparedHydrationState(prepared: PreparedVNode): void {
  prepared.vnode.el = null;

  if (prepared.component !== null) {
    const { instance, subtree } = prepared.component;
    instance.effect?.stop();
    instance.effect = null;
    instance.update = null;
    instance.isMounted = false;
    instance.isUnmounted = false;
    instance.isUpdateQueued = false;
    resetPreparedHydrationState(subtree);
    return;
  }

  if (Array.isArray(prepared.children)) {
    for (const child of prepared.children) {
      resetPreparedHydrationState(child);
    }
  }
}

export { SolaceHydrationError };

function hydrateInitialTree(
  vnode: VNode,
  container: RenderContainer,
  appProvides: Provides | null,
  options: HydrationOptions,
): void {
  const context: HydrationContext = { hydratedInstances: [] };

  try {
    const next = hydrateVNode(vnode, container.firstChild, null, appProvides, context);
    assertNoExtraDomNode(next, "root[1]");
    container._solaceVNode = vnode;
  } catch (error) {
    stopHydratedComponentUpdates(context);

    if (!shouldRecoverHydrationMismatch(error, options)) {
      throw error;
    }

    container.textContent = "";
    container._solaceVNode = null;
    renderVNode(vnode, container, appProvides);
  }
}

function shouldRecoverHydrationMismatch(
  error: unknown,
  options: HydrationOptions,
): error is SolaceHydrationError {
  return options.recover === true && error instanceof SolaceHydrationError;
}

function assertNoDeferredIntegrationOptions(options: HydrationOptions): void {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Hydration options must be an object");
  }

  if (options.recover !== undefined && typeof options.recover !== "boolean") {
    throw new TypeError("Hydration recover option must be a boolean");
  }

  if (hasOwn(options, "manifest") || hasOwn(options, "clientEntry")) {
    throw new TypeError(
      "Hydration manifest integration is deferred; compose assets in an app-local shell or adapter.",
    );
  }

  if (hasOwn(options, "router")) {
    throw new TypeError(
      "Router-aware hydration integration is deferred; pass explicit render sources instead.",
    );
  }

  if (hasOwn(options, "stream")) {
    throw new TypeError(
      "Hydration streaming integration is deferred; hydrate() currently accepts synchronous hydration trees only.",
    );
  }

  const unknownKey = Reflect.ownKeys(options).find((key) => key !== "recover");
  if (unknownKey !== undefined) {
    throw new TypeError(`Unknown hydration option: ${String(unknownKey)}`);
  }
}

function assertHydrationContainer(container: Element): void {
  if (!(container instanceof Element)) {
    throw new TypeError("Hydration container must be an Element");
  }
}

function renderReactiveSource(
  source: () => VNode,
  container: RenderContainer,
  appProvides: Provides | null,
  styleSink: StyleSink,
): void {
  stopReactiveRender(container);

  const update = (): void => {
    withStyleSink(styleSink, () => renderVNode(source(), container, appProvides));
  };
  const reactiveEffect = new ReactiveEffect(update, () => {
    queueJob(job);
  });
  const runner = reactiveEffect.run.bind(reactiveEffect);
  const job = (): void => {
    if (container._solaceRenderEffect === reactiveEffect) {
      runner();
    }
  };

  container._solaceRenderEffect = reactiveEffect;
  runner();
}

function stopReactiveRender(container: RenderContainer): void {
  container._solaceRenderEffect?.stop();
  container._solaceRenderEffect = undefined;
}

function renderVNode(vnode: VNode, container: RenderContainer, appProvides: Provides | null): void {
  patch(container._solaceVNode ?? null, vnode, container, null, null, appProvides);
  container._solaceVNode = vnode;
}

function normalizeHydrationSource(source: HydrationSource): VNode {
  return typeof source === "function" ? h(source) : source;
}

function assertNoAsyncHydrationSource(source: HydrationSource): void {
  if (isThenable(source)) {
    throw new TypeError(
      "Async hydration is deferred; hydrate() currently accepts synchronous hydration sources only.",
    );
  }
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
