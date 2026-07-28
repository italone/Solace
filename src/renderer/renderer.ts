import { ReactiveEffect } from "../reactivity/effect";
import { queueJob } from "../scheduler/scheduler";
import type { Provides } from "../component/provide";
import { createDocumentStyleSink, withStyleSink, type StyleSink } from "../component/style";
import { h } from "../vnode/h";
import type { ComponentType, VNode } from "../vnode/vnode";
import { patch } from "./diff";
import { hydrateVNode, SolaceHydrationError } from "./hydration";

export type RenderSource = VNode | (() => VNode);
export type HydrationSource = VNode | ComponentType;
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
): void {
  const renderContainer = container as RenderContainer;
  const styleSink = createDocumentStyleSink(container.ownerDocument);
  const getVNode = (): VNode => normalizeHydrationSource(source);

  stopReactiveRender(renderContainer);

  let hydrated = false;
  const update = (): void => {
    withStyleSink(styleSink, () => {
      const vnode = getVNode();
      if (!hydrated) {
        hydrateVNode(vnode, renderContainer.firstChild, null, appProvides);
        renderContainer._solaceVNode = vnode;
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
