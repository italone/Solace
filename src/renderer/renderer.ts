import { ReactiveEffect } from "../reactivity/effect";
import { getAsyncComponentMetadata } from "../component/async-component";
import { queueJob } from "../scheduler/scheduler";
import type { Provides } from "../component/provide";
import { prepareAsyncSource, type PreparedVNode } from "../shared/async-tree";
import { createDocumentStyleSink, withStyleSink, type StyleSink } from "../component/style";
import { h } from "../vnode/h";
import type { AsyncComponentType, ComponentTransport, VNode } from "../vnode/vnode";
import type { Router } from "../router/types";
import {
  createRouterSnapshot,
  parseRouterSnapshot,
  verifyRouterSnapshot,
  type RouteRecordIdentity,
} from "../router/snapshot";
import { patch } from "./diff";
import {
  assertNoExtraDomNode,
  hydratePreparedVNode,
  hydrateVNode,
  SolaceHydrationError,
  stopHydratedComponentUpdates,
  type HydrationContext,
} from "./hydration";
import { attachSelectiveEventBuffer } from "./selective-events";

export type RenderSource = VNode | (() => VNode);
export type HydrationSource = VNode | ComponentTransport;
export type AsyncHydrationSource = HydrationSource | AsyncComponentType;
export interface HydrationOptions {
  recover?: boolean;
  selective?: boolean;
  router?: Router;
  routerIdentifyRecord?: RouteRecordIdentity;
  textComparison?: "exact" | "normalized-collapsing";
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
  if (options.selective === true) {
    throw new TypeError("Selective hydration requires hydrateAsync(); hydrate() is synchronous.");
  }
  if (options.router !== undefined) {
    throw new TypeError(
      "Router-aware hydration requires hydrateAsync(); hydrate() is synchronous.",
    );
  }
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
  const job = (): void | false => {
    if (renderContainer._solaceRenderEffect === reactiveEffect) {
      runner();
      return;
    }

    return false;
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
  if (options.selective === true) {
    if (options.router !== undefined) {
      throw new TypeError(
        "Router-aware selective hydration is not supported yet; use ordered hydration.",
      );
    }
    await hydrateSelectively(source, container as RenderContainer, appProvides, options);
    return;
  }
  if (options.router !== undefined) {
    const identifyRecord = requireRouterIdentifyRecord(options);
    await prepareRouterHydration(options.router, container, identifyRecord);
  }
  const prepared = await prepareAsyncSource(source, {
    appProvides,
    collectStyles: true,
  });
  const renderContainer = container as RenderContainer;
  const context: HydrationContext = {
    hydratedInstances: [],
    textComparison: options.textComparison,
  };
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
      recoverPreparedHydration(prepared.root, renderContainer, appProvides, options);
      return;
    }

    throw error;
  }
}

async function hydrateSelectively(
  source: AsyncHydrationSource,
  renderContainer: RenderContainer,
  appProvides: Provides | null,
  options: HydrationOptions,
): Promise<void> {
  const vnode = typeof source === "function" ? h(source as ComponentTransport) : source;
  const styleSink = createDocumentStyleSink(renderContainer.ownerDocument);
  const context: HydrationContext = {
    hydratedInstances: [],
    textComparison: options.textComparison,
  };

  stopReactiveRender(renderContainer);

  // Kick off async loader requests before the walk so ready parts hydrate
  // immediately while loads resolve in the background.
  const pendingLoads: Promise<unknown>[] = [];
  collectPendingLoads(vnode, pendingLoads);

  const eventBuffer = attachSelectiveEventBuffer(renderContainer);
  let settled = false;

  try {
    try {
      withStyleSink(styleSink, () => {
        const next = hydrateVNode(vnode, renderContainer.firstChild, null, appProvides, context);
        assertNoExtraDomNode(next, "root[1]");
      });
    } catch (error) {
      stopHydratedComponentUpdates(context);

      if (shouldRecoverHydrationMismatch(error, options)) {
        renderContainer.textContent = "";
        renderContainer._solaceVNode = null;
        withStyleSink(styleSink, () => renderVNode(vnode, renderContainer, appProvides));
        return;
      }

      throw error;
    }

    renderContainer._solaceVNode = vnode;
    await settlePendingBoundaries(renderContainer, pendingLoads);
    settled = true;
  } finally {
    if (settled) {
      eventBuffer.replay();
    }
    eventBuffer.detach();
  }
}

async function settlePendingBoundaries(
  renderContainer: RenderContainer,
  pendingLoads: Promise<unknown>[],
): Promise<void> {
  // Hydrated async/Suspense instances re-render through their own update
  // machinery when loaders resolve. Await every pending loader, then give the
  // scheduler queue one turn before stripping the now-replaced boundary markers.
  await Promise.allSettled(pendingLoads);
  await new Promise((resolve) => setTimeout(resolve, 0));
  removeBoundaryMarkers(renderContainer);
}

function collectPendingLoads(node: unknown, out: Promise<unknown>[]): void {
  if (node === null || node === undefined || typeof node === "string") return;
  if (Array.isArray(node)) {
    for (const child of node) collectPendingLoads(child, out);
    return;
  }
  if (typeof node !== "object" || !("shapeFlag" in node)) return;
  const vnode = node as VNode;
  const metadata = getAsyncComponentMetadata(vnode.type);
  if (metadata !== undefined && metadata.peek() === null) {
    out.push(metadata.load().catch(() => undefined));
  }
  collectPendingLoads(vnode.children, out);
}

function removeBoundaryMarkers(container: Element): void {
  const doc = container.ownerDocument ?? document;
  const walker = doc.createTreeWalker(container, NodeFilter.SHOW_COMMENT, null);
  const removals: Comment[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Comment;
    if (/^\/?so:b:\d+$/.test(node.nodeValue ?? "")) {
      removals.push(node);
    }
  }
  for (const node of removals) {
    node.parentNode?.removeChild(node);
  }
}

function recoverPreparedHydration(
  prepared: PreparedVNode,
  container: RenderContainer,
  appProvides: Provides | null,
  options: HydrationOptions,
): void {
  container.textContent = "";
  container._solaceVNode = null;
  const materialized = materializePreparedVNode(prepared);
  renderVNode(materialized, container, appProvides);
  resetPreparedHydrationState(prepared);

  const context: HydrationContext = {
    hydratedInstances: [],
    textComparison: options.textComparison,
  };
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
  const context: HydrationContext = {
    hydratedInstances: [],
    textComparison: options.textComparison,
  };

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

  if (options.selective !== undefined && typeof options.selective !== "boolean") {
    throw new TypeError("Hydration selective option must be a boolean");
  }

  if (
    options.textComparison !== undefined &&
    options.textComparison !== "exact" &&
    options.textComparison !== "normalized-collapsing"
  ) {
    throw new TypeError(
      'Hydration textComparison option must be "exact" or "normalized-collapsing"',
    );
  }

  if (hasOwn(options, "manifest") || hasOwn(options, "clientEntry")) {
    throw new TypeError(
      "Hydration manifest integration is deferred; compose assets in an app-local shell or adapter.",
    );
  }

  if (options.router !== undefined) {
    const router = options.router as unknown as Record<string, unknown>;
    if (
      router === null ||
      typeof router !== "object" ||
      typeof router.isReady !== "function" ||
      typeof router.currentRoute !== "object"
    ) {
      throw new TypeError("Hydration router option must be a Router instance");
    }
    if (typeof options.routerIdentifyRecord !== "function") {
      throw new TypeError(
        "Hydration routerIdentifyRecord must be a function when router is provided",
      );
    }
  } else if (options.routerIdentifyRecord !== undefined) {
    throw new TypeError("Hydration routerIdentifyRecord requires the router option");
  }

  if (hasOwn(options, "stream")) {
    throw new TypeError(
      "Hydration streaming integration is deferred; hydrate() currently accepts synchronous hydration trees only.",
    );
  }

  const unknownKey = Reflect.ownKeys(options).find(
    (key) =>
      key !== "recover" &&
      key !== "selective" &&
      key !== "router" &&
      key !== "routerIdentifyRecord" &&
      key !== "textComparison",
  );
  if (unknownKey !== undefined) {
    throw new TypeError(`Unknown hydration option: ${String(unknownKey)}`);
  }
}

function assertHydrationContainer(container: Element): void {
  if (!(container instanceof Element)) {
    throw new TypeError("Hydration container must be an Element");
  }
}

const SNAPSHOT_SCRIPT_ID = "__solace-router-snapshot";
const SNAPSHOT_MARKER = "window.__SOLACE_ROUTER_SNAPSHOT__=";

function requireRouterIdentifyRecord(options: HydrationOptions): RouteRecordIdentity {
  if (typeof options.routerIdentifyRecord !== "function") {
    throw new TypeError(
      "Hydration routerIdentifyRecord must be a function when router is provided",
    );
  }
  return options.routerIdentifyRecord;
}

async function prepareRouterHydration(
  router: Router,
  container: Element,
  identifyRecord: RouteRecordIdentity,
): Promise<void> {
  await router.isReady();

  let payload: string | null = readSnapshotScriptPayload(container);
  if (payload === null) {
    const globalValue = (globalThis as unknown as Record<string, unknown>)
      .__SOLACE_ROUTER_SNAPSHOT__;
    if (globalValue === undefined) {
      throw new TypeError(
        `Router hydration requires an embedded snapshot payload (script#${SNAPSHOT_SCRIPT_ID} or window.__SOLACE_ROUTER_SNAPSHOT__).`,
      );
    }
    payload = typeof globalValue === "string" ? globalValue : JSON.stringify(globalValue);
  }

  const serverSnapshot = parseRouterSnapshot(payload);
  const clientSnapshot = createRouterSnapshot(router.currentRoute.value, identifyRecord);
  verifyRouterSnapshot(serverSnapshot, clientSnapshot);

  container.querySelector(`script#${SNAPSHOT_SCRIPT_ID}`)?.remove();
}

function readSnapshotScriptPayload(container: Element): string | null {
  const script = container.querySelector(`script#${SNAPSHOT_SCRIPT_ID}`);
  const text = script?.textContent ?? null;
  if (text === null || !text.includes(SNAPSHOT_MARKER)) {
    return null;
  }
  const start = text.indexOf(SNAPSHOT_MARKER) + SNAPSHOT_MARKER.length;
  return text.slice(start, text.lastIndexOf(";") >= start ? text.lastIndexOf(";") : undefined);
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
  const job = (): void | false => {
    if (container._solaceRenderEffect === reactiveEffect) {
      runner();
      return;
    }

    return false;
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
