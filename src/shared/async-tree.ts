import {
  createComponentInstance,
  setupComponent,
  type ComponentInstance,
} from "../component/component";
import { getAsyncComponentMetadata } from "../component/async-component";
import { getCurrentInstance, setCurrentInstance } from "../component/lifecycle";
import type { Provides } from "../component/provide";
import {
  createServerStyleSink,
  withStyleSink,
  type ServerStyleSink,
  type StyleRegistration,
} from "../component/style";
import { ShapeFlags } from "./flags";
import { isThenable } from "./utils";
import { h } from "../vnode/h";
import type {
  AsyncComponentType,
  ComponentRender,
  ComponentType,
  VNode,
  VNodeChild,
} from "../vnode/vnode";

export type AsyncTreeSource =
  | VNode
  | ComponentType
  | AsyncComponentType
  | PromiseLike<VNode | ComponentType | AsyncComponentType>;

export interface PreparedVNode {
  vnode: VNode;
  component: PreparedComponent | null;
  children: string | PreparedVNode[] | null;
}

export interface PreparedComponent {
  instance: ComponentInstance;
  render: ComponentRender | null;
  subtree: PreparedVNode;
  fixed: boolean;
}

export interface PreparedAsyncTree {
  root: PreparedVNode;
  styles: string[];
  registrations: StyleRegistration[];
}

export interface PrepareAsyncSourceOptions {
  appProvides: Provides | null;
  collectStyles: boolean;
}

export async function prepareAsyncSource(
  source: AsyncTreeSource,
  options: PrepareAsyncSourceOptions,
): Promise<PreparedAsyncTree> {
  const styleSink = createServerStyleSink();
  const resolvedSource = await resolveThenable(source);
  const vnode = normalizeSource(resolvedSource);
  const root = await prepareVNode(vnode, null, options.appProvides, styleSink);

  return {
    root,
    styles: options.collectStyles ? [...styleSink.styles] : [],
    registrations: styleSink.registrations.map((registration) => ({ ...registration })),
  };
}

async function prepareVNode(
  sourceVNode: VNode,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  styleSink: ServerStyleSink,
): Promise<PreparedVNode> {
  const vnode = cloneVNode(sourceVNode);

  if (vnode.shapeFlag & ShapeFlags.COMPONENT) {
    return prepareComponent(vnode, parentComponent, appProvides, styleSink);
  }

  const children = await prepareChildren(vnode, parentComponent, appProvides, styleSink);
  applyPreparedChildren(vnode, children);

  return {
    vnode,
    component: null,
    children,
  };
}

async function prepareComponent(
  vnode: VNode,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  styleSink: ServerStyleSink,
): Promise<PreparedVNode> {
  const metadata = getAsyncComponentMetadata(vnode.type);
  if (metadata !== undefined) {
    await metadata.load();
  }

  const instance = createComponentInstance(vnode, parentComponent, appProvides);
  vnode.component = instance;
  setupComponent(instance);

  const initialResult = withStyleSink(styleSink, () => instance.render()) as unknown;
  let fixed = false;
  let render: ComponentRender | null = instance.render;
  let subtreeSource: unknown = initialResult;

  if (isThenable(initialResult)) {
    const resolvedResult = await initialResult;

    if (typeof resolvedResult === "function") {
      const resolvedRender = resolvedResult as ComponentRender;
      const renderWithInstance = (): VNode => runWithInstance(instance, resolvedRender);
      render = renderWithInstance;
      instance.render = renderWithInstance;
      subtreeSource = withStyleSink(styleSink, renderWithInstance);
    } else if (isVNode(resolvedResult)) {
      fixed = true;
      render = null;
      instance.render = () => resolvedResult;
      subtreeSource = resolvedResult;
    } else {
      throw new TypeError("Async component must resolve to a VNode or render function");
    }
  }

  if (isThenable(subtreeSource)) {
    throw new TypeError("Async component render functions must return a synchronous VNode");
  }

  if (!isVNode(subtreeSource)) {
    throw new TypeError("Component render must return a VNode");
  }

  const subtree = await prepareVNode(subtreeSource, instance, instance.appProvides, styleSink);
  instance.subTree = subtree.vnode;

  return {
    vnode,
    component: {
      instance,
      render,
      subtree,
      fixed,
    },
    children: null,
  };
}

async function prepareChildren(
  vnode: VNode,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
  styleSink: ServerStyleSink,
): Promise<string | PreparedVNode[] | null> {
  const { children } = vnode;

  if (children === null) {
    return null;
  }

  if (typeof children === "string") {
    return children;
  }

  if (!Array.isArray(children)) {
    return null;
  }

  const preparedChildren: PreparedVNode[] = [];
  let resolvedText: string | null = null;

  for (let index = 0; index < children.length; index += 1) {
    if (!(index in children)) {
      throw new TypeError("Async VNode children must not be sparse");
    }

    const child = await resolveThenable(children[index] as VNodeChild | PromiseLike<VNodeChild>);
    if (typeof child === "string") {
      if (children.length !== 1) {
        throw new TypeError("Async text children cannot be mixed with VNodes");
      }

      resolvedText = child;
      continue;
    }

    if (!isVNode(child)) {
      throw new TypeError("Async child must resolve to a string or VNode");
    }

    preparedChildren.push(await prepareVNode(child, parentComponent, appProvides, styleSink));
  }

  return resolvedText ?? preparedChildren;
}

function applyPreparedChildren(vnode: VNode, children: string | PreparedVNode[] | null): void {
  vnode.shapeFlag &= ~(ShapeFlags.TEXT_CHILDREN | ShapeFlags.ARRAY_CHILDREN);

  if (typeof children === "string") {
    vnode.children = children;
    vnode.shapeFlag |= ShapeFlags.TEXT_CHILDREN;
    return;
  }

  if (children === null) {
    vnode.children = null;
    return;
  }

  vnode.children = children.map((child) => child.vnode);
  vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
}

function normalizeSource(source: VNode | ComponentType | AsyncComponentType): VNode {
  if (isVNode(source)) {
    return source;
  }

  if (typeof source === "function") {
    return h(source as ComponentType);
  }

  throw new TypeError("Async source must resolve to a VNode or component function");
}

function cloneVNode(vnode: VNode): VNode {
  return {
    ...vnode,
    props: vnode.props === null ? null : { ...vnode.props },
    el: null,
    component: null,
  };
}

async function resolveThenable<T>(value: T | PromiseLike<T>): Promise<T> {
  return isThenable(value) ? Promise.resolve(value) : value;
}

function isVNode(value: unknown): value is VNode {
  return (
    value !== null &&
    typeof value === "object" &&
    "type" in value &&
    "shapeFlag" in value &&
    "children" in value
  );
}

function runWithInstance(instance: ComponentInstance, render: ComponentRender): VNode {
  const previousInstance = getCurrentInstance();
  setCurrentInstance(instance);
  try {
    return render();
  } finally {
    setCurrentInstance(previousInstance);
  }
}
