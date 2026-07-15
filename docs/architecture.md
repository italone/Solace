# Architecture

## Layers

Solace is organized as a small runtime pipeline:

```text
reactivity -> scheduler -> component -> vnode -> renderer -> DOM
```

- `reactivity`: tracks reads and triggers effects on writes.
- `scheduler`: batches component update jobs and exposes `nextTick`.
- `component`: creates component instances, owns props, render effects, emit, and lifecycle hooks.
- `vnode`: represents elements, components, Fragment, props, keys, and children.
- `renderer`: mounts, patches, diffs, and unmounts VNodes.
- `event`: patches DOM event listeners through invoker caching.
- `store`: composes `reactive` and `computed` into a centralized state container.

## Update Flow

1. A component render function reads reactive state.
2. The active component `ReactiveEffect` tracks those reads.
3. A state write calls `trigger`.
4. The component effect scheduler queues the component update with `queueJob`.
5. The queued job reruns the component render.
6. The renderer patches the previous subtree against the next subtree.
7. `nextTick` resolves after the scheduler queue is flushed.

## Component Flow

Mounting a component creates a `ComponentInstance` with:

- `vnode`, `type`, `props`, `subTree`
- `render`, `effect`, `update`
- `emit`
- lifecycle arrays for mounted, updated, and unmounted hooks

The first render mounts the component subtree. Later renders patch the old subtree against the new subtree. Unmounting stops the component effect, recursively unmounts the subtree, and calls unmounted hooks.

## DOM Patch Flow

The renderer compares VNode type and key:

- Different type or key: unmount old node, mount new node.
- Same element: patch props, then patch children.
- Same component: update props, then run the component update.
- Fragment: patch or unmount its children without adding a wrapper element.

Children diff currently favors correctness and DOM reuse. Keyed children support insert, delete, move, and patch. The implementation does not yet include LIS optimization.

## Event Flow

DOM event props use the `onXxx` convention. Each DOM element caches event invokers:

- First listener: add one native listener.
- Handler update: replace `invoker.value`.
- Prop removal or element unmount: remove the cached native listener.

This avoids repeated add/remove work when only the handler function changes.

## Package Shape

The package exposes:

- `solace`: root runtime APIs.
- `solace/jsx-runtime`: automatic JSX runtime.
- `solace/jsx-dev-runtime`: development JSX runtime.

Rollup builds ESM, CJS, and `.d.ts` artifacts for each public entry point.

## Examples

The Vite examples in `examples/` exercise the package through local aliases:

- `basic-counter`: JSX runtime, reactive state, and DOM events.
- `todo-app`: form input, keyed list updates, checkbox state, and deletion.
- `large-list`: 10,000 keyed rows and targeted text/class patching.

See `docs/examples.md` for run commands and e2e coverage.
