# DevTools Component Tree Inspector — Design

Date: 2026-08-20
Status: approved design, pre-implementation

## Goal

Add a component tree inspector to the example browser DevTools extension panel so developers can
see the live component hierarchy, lifecycle state, and update activity of the inspected page.

## Why now

The current panel renders a flat event timeline. Component events (`component:mount`,
`component:update`, `component:unmount`) carry only `id` and `name`, so no hierarchy can be
derived. A component tree is the most requested inspector capability named in
`docs/project-status.md` known gaps, and it can be delivered without relaxing the existing
payload safety policy.

## Chosen approach: `parentId` on existing component events

Add `parentId: number | null` to `component:mount`, `component:update`, and
`component:unmount`. The root component reports `parentId: null`. The panel builds and maintains
the tree incrementally from the event stream.

Rejected alternatives:

- A `component:tree` snapshot event: larger payloads, duplicate state, and a consistency window
  between snapshot and incremental events.
- Pull-based tree queries through the page bridge: requires a new hook request/response protocol
  and widens the contract surface.

## Runtime changes

- `src/devtools/events.ts`: extend the three component event variants with
  `parentId: number | null`; update `serializeDevtoolsEvent` accordingly.
- Component lifecycle emit sites pass the parent component instance id (or `null` at the root).
- Emission remains listener-gated; no listener means no meaningful extra work.

The payload policy is unchanged: small serializable summaries only. No props, state, component
instances, DOM nodes, VNodes, stack traces, or user content.

## Panel changes (`examples/devtools-extension` only)

- Add a "Components" tab to the existing DevTools panel, alongside the store tab.
- Maintain tree state from events: `mount` inserts a node under its `parentId`, `unmount` removes
  the node's subtree, `update` briefly highlights the node (reusing existing timeline highlight
  styling).
- Render an indented, collapsible list of component name plus id.
- Reuse the existing bridge, content script, background relay, and panel transport. No manifest
  permission changes and no widening of the local 6174 demo origins.

## Testing

- Update payload stability coverage (serialization lock) and existing component event unit tests.
- New unit cases: nested component parent links, root `parentId: null`, subtree removal after
  unmount.
- One new Chromium-only DevTools extension e2e: the demo page mounts nested components, the
  Components tab shows the tree, an update highlights a node, and unmount removes the subtree.
- Gates: `pnpm quality` plus `pnpm test:e2e:devtools-extension` before commit; a project log
  entry records the change.

## Out of scope

Props/state inspection, dependency graph, flame chart, persisted captures, SSR/SSG/hydration
panels, production extension distribution, and manifest/origin widening.
