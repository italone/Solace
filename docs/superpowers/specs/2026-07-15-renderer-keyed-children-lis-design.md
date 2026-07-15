# Renderer Keyed Children LIS Design

## Goal

Reduce unnecessary DOM moves in keyed children diff by using a longest increasing subsequence (LIS) pass on the
middle keyed segment.

## Context

Solace already handles keyed insert, delete, move, and patch correctly. The current keyed diff path preserves DOM
correctness, but it finishes by inserting every child in the middle segment, even nodes that are already in the right
relative order. That keeps behavior simple but does extra work on stable keyed reorders.

## Goals

- Preserve existing keyed and unkeyed diff semantics.
- Reduce unnecessary `insertBefore` calls for keyed reorders.
- Keep duplicate-key and mixed keyed/unkeyed fallback behavior unchanged.
- Keep public APIs and rendered output unchanged.

## Non-Goals

- Do not change VNode shape, component behavior, or public exports.
- Do not add a new renderer abstraction or a new diff algorithm for unkeyed children.
- Do not optimize fully arbitrary reorder patterns beyond the keyed LIS pass.

## Design

Keep the current prefix and suffix sync passes in `patchKeyedChildren`. After those passes narrow the active middle
window:

1. Build a map from old keyed children to their VNodes.
2. Walk the new keyed window once, patching matched nodes and mounting new nodes.
3. Record each matched old index in a `newIndexToOldIndexMap`.
4. Unmount old nodes that were not matched.
5. Compute the LIS of the matched old-index map, ignoring new nodes.
6. Walk the new window from right to left:
   - mount new nodes at the correct anchor,
   - move existing nodes only when they are not part of the LIS,
   - leave LIS nodes in place.

This keeps the final DOM order correct while avoiding moves for the stable subsequence.

## Alternatives Considered

- Move every keyed node in reverse order. This is the current behavior and is simple, but it always does extra DOM work.
- Rebuild keyed children from scratch. This would be easy to reason about, but it destroys DOM reuse and regresses
  performance.
- Use LIS on the keyed middle segment. Recommended. It preserves DOM reuse and reduces move count without changing
  fallback behavior.

## Testing

- Add a renderer diff test that reorders keyed children and spies on `Node.prototype.insertBefore`.
- Assert the optimized path performs fewer move operations than the current all-node move behavior.
- Keep an assertion that the final DOM order and node reuse are unchanged.

## Risks

- LIS implementation mistakes can regress keyed reorder correctness.
- The optimization should stay confined to the keyed unique-key path so duplicate-key and mixed-child fallback behavior
  remain unchanged.

## Recommendation

Use LIS only inside the keyed middle diff path. That keeps the change local, testable, and easy to reason about.
