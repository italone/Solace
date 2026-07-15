import { ReactiveEffect } from "../reactivity/effect";
import { queueJob } from "../scheduler/scheduler";
import type { Provides } from "../component/provide";
import type { VNode } from "../vnode/vnode";
import { patch } from "./diff";

export type RenderSource = VNode | (() => VNode);
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

  if (typeof source === "function") {
    renderReactiveSource(source, renderContainer, appProvides);
    return;
  }

  stopReactiveRender(renderContainer);
  renderVNode(source, renderContainer, appProvides);
}

function renderReactiveSource(
  source: () => VNode,
  container: RenderContainer,
  appProvides: Provides | null,
): void {
  stopReactiveRender(container);

  const update = (): void => {
    renderVNode(source(), container, appProvides);
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
