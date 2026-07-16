# Stable Component Update Skip Design

## Context

Solace batches component update jobs through the scheduler, but a parent component rerender still patches every child
component VNode. The current `updateComponent()` path refreshes props and runs the child component update even when the
new component VNode has the same type, key, props, and children as the previous one.

This is a narrow component batching hotspot: large trees often contain many stable child components around a small parent
state change. Skipping unchanged child component updates reduces render work without changing scheduler queue semantics.

## Goals

- Skip child component updates when props and children are unchanged across parent rerenders.
- Preserve updates when any public prop value changes.
- Preserve updates when component children/slots change.
- Keep component mount/unmount behavior, scheduler semantics, keyed diff behavior, and public APIs unchanged.
- Add benchmark coverage for a parent update with many stable child components.

## Non-Goals

- Do not change scheduler dedupe or flush ordering.
- Do not add priority queues, async rendering, or partial tree scheduling.
- Do not deep-compare props, slots, or arbitrary objects.
- Do not skip direct reactive updates inside child components.
- Do not add absolute benchmark thresholds.

## Design

Add a `shouldUpdateComponent(n1, n2)` guard in `src/renderer/diff.ts`.

The guard returns `true` when:

- children references differ, because slot/default children changes must be reflected,
- prop key counts differ, ignoring the internal `key` prop,
- any non-key prop value differs by identity.

The guard returns `false` when both component VNodes have the same children reference and shallow-equal non-key props.
When the guard returns `false`, `updateComponent()` should carry the previous component instance forward, set `n2.el` to
`n1.el`, update `instance.vnode` to the next VNode for future comparisons, and skip `updateComponentProps()` plus
`instance.update()`.

This keeps DOM output and node identity stable while avoiding unnecessary child render work.

## Testing

Add a component unit test where a reactive parent rerenders while passing unchanged props to a child component. The child
render function should run only once, while the parent DOM still updates.

Keep existing component update tests covering changed slots, changed props, direct child reactive updates, and lifecycle
behavior.

Add a benchmark task to `tests/performance/component-update.bench.ts`:

- render 1,000 child components with stable props,
- update parent-only reactive state,
- assert parent DOM updates and child DOM remains present.

The benchmark should report completion and metrics only. It should not enforce a timing threshold.

## Risks

- Over-aggressive skipping could miss slot or prop updates; this design uses a conservative children reference check and
  shallow prop comparison.
- Some component update hooks may no longer run for no-op parent patches. That matches the intended optimization:
  unchanged child component VNodes should not update.
- Object-valued props are compared by identity only. Mutating object props in place remains outside the optimization's
  guarantees.

## Recommendation

Implement the shallow stable-component skip in `updateComponent()` first. It is local, testable, and directly supports
the current component batching benchmark direction without broad scheduler changes.
