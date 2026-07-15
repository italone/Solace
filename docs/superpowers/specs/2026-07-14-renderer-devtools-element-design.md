# Renderer DevTools Element Summary Design

## Context

Solace now emits internal DevTools summaries for scheduler flushes, component lifecycle events, store actions, and
reactivity triggers. Renderer element summaries complete the initial runtime timeline without exposing DOM nodes, full
VNode trees, props, or children.

## Goals

- Emit a `renderer:element` event through the internal DevTools event bus after element mount, update, and unmount.
- Include only summary fields: `operation` and `tag`.
- Avoid exposing DOM nodes, VNodes, props, children, text content, or event handlers.
- Avoid event work when no DevTools listener is registered.
- Preserve existing renderer diff behavior and DOM ordering.

## Non-Goals

- Do not emit full VNode trees or DOM node references.
- Do not emit prop names, prop values, text children, or event handler references.
- Do not add public DevTools APIs or package exports.
- Do not add a renderer inspector UI in this step.

## Design

Extend `DevtoolsEvent` in `src/devtools/events.ts`:

```ts
{
  type: "renderer:element";
  operation: "mount" | "update" | "unmount";
  tag: string;
}
```

Update `src/renderer/diff.ts`:

- Emit `operation: "mount"` after an element is inserted.
- Emit `operation: "update"` after an existing element is patched.
- Emit `operation: "unmount"` after an element is removed.

All emission remains guarded by `hasDevtoolsListeners()`.

## Testing

- Add renderer diff coverage that mounts an element, updates it, replaces it with a different element, and asserts
  mount/update/unmount summary events.
- Assert the events do not include DOM nodes, VNodes, props, or children.

## Risks

- Replacing one element with another emits an unmount followed by a mount, matching the current renderer control flow.
- Nested element trees can emit multiple summaries; tests should focus on the minimal single-element path.
