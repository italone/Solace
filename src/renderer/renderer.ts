import { ReactiveEffect } from "../reactivity/effect";
import { queueJob } from "../scheduler/scheduler";
import type { Provides } from "../component/provide";
import { createDocumentStyleSink, withStyleSink, type StyleSink } from "../component/style";
import { h } from "../vnode/h";
import type { ComponentType, VNode } from "../vnode/vnode";
import { patch } from "./diff";
import {
  assertNoExtraDomNode,
  hydrateVNode,
  SolaceHydrationError,
  stopHydratedComponentUpdates,
  type HydrationContext,
} from "./hydration";

export type RenderSource = VNode | (() => VNode);
export type HydrationSource = VNode | ComponentType;
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
  runner();
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

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
