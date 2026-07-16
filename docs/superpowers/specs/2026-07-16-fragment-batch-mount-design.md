# Fragment Batch Mount Design

## Context

The current renderer mounts a Fragment by patching each child directly into the parent container. This is correct, but
for Fragment-heavy render paths it performs one parent-container insertion per top-level child. The existing
`tests/performance/fragment.bench.ts` benchmark measures a 5,000 child Fragment initial render, so this is a narrow
renderer hotspot with an existing benchmark.

Keyed children already have an LIS optimization, and component batching changes scheduler semantics. Fragment initial
mount is the smallest remaining renderer/performance cut because it can improve one hot path without changing public
APIs, keyed diff behavior, scheduler behavior, or DevTools payload shape.

## Goals

- Reduce parent-container insertions when mounting a Fragment whose top-level children are plain elements.
- Keep Fragment DOM output, VNode `el` assignment, child node identity, and DevTools event payloads unchanged.
- Keep component, mixed child, unkeyed, keyed, patch, update, and unmount behavior unchanged.
- Validate the change with a targeted renderer test and the existing Fragment benchmark.

## Non-Goals

- Do not change keyed diff semantics or the existing LIS path.
- Do not change component scheduler batching.
- Do not introduce Fragment start/end marker nodes.
- Do not batch mixed Fragment children containing top-level components in this step.
- Do not add absolute performance thresholds.

## Design

Add a batch path inside `mountFragment()`.

When the Fragment has array children and every top-level child is an element VNode, create a `DocumentFragment`, patch
those children into the document fragment, then insert that document fragment into the real parent container once at the
original anchor. Browser DOM insertion moves the document fragment's children into the parent while preserving each
child element's `el`.

When the Fragment has no array children or any top-level child is not a plain element, keep the existing per-child mount
path. This avoids changing mount timing for top-level component children.

The renderer currently types `patch()` and several mount/patch helpers with `Element` containers. The batch path needs a
`DocumentFragment` container, so the container type should be widened to `Node` for helpers that only insert, remove, or
set text. Element-specific operations remain typed as `Element` where props are patched.

## Testing

Add a renderer unit test that renders a root Fragment with multiple keyed element children, spies on the parent
container's `insertBefore`, and asserts the parent receives one insertion while all child DOM nodes render in order.
This test fails before the batch path because each child is inserted into the parent separately.

Run the existing Fragment benchmark after implementation:

```bash
pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/fragment.bench.ts
```

The benchmark remains a smoke benchmark. It should complete and print the existing Fragment task metrics; the change
does not add threshold assertions.

## Risks

- Widening renderer container types must not leak `DocumentFragment` into element prop patching.
- Batching top-level component children could alter lifecycle timing, so this first step deliberately excludes them.
- DOM insertion counts are a proxy for this optimization; final performance still depends on browser and jsdom behavior.

## Recommendation

Implement only the all-element Fragment initial mount batch path. It is local, measurable with existing Fragment
benchmark coverage, and avoids the broader semantic risk of component batching or another keyed diff rewrite.
