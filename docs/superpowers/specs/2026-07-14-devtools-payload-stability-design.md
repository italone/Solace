# DevTools Payload Stability Design

## Context

Solace now emits internal DevTools summaries across scheduler, component, store, reactivity, and renderer runtime paths.
Before adding any public integration surface or UI, the event payload boundary needs a stability check that proves current
events remain JSON-safe and do not leak live runtime objects.

## Goals

- Add an internal `serializeDevtoolsEvent(event)` helper in `src/devtools/events.ts`.
- Return an explicit plain-object copy for each current `DevtoolsEvent` union member.
- Add an integrated runtime smoke test that captures events from component, store, reactivity, scheduler, and renderer
  paths.
- Assert captured payloads contain only allowed fields and round-trip through JSON.
- Keep the helper internal and out of package root exports.

## Non-Goals

- Do not add a public DevTools API.
- Do not add a browser extension, custom panel, or inspector UI.
- Do not persist or upload event payloads.
- Do not expose DOM nodes, VNodes, props, children, reactive targets, action arguments, return values, or errors.

## Design

Add `serializeDevtoolsEvent(event)` to the internal event bus module. Use a `switch` over `event.type` and return only
the documented fields for that event shape. Avoid object spread so accidental future fields are not silently included.

The integration test renders a component that reads store state, runs a store action, waits for the scheduled update, and
then replaces the component with a static element. The captured event stream should include renderer, component,
reactivity, store, and scheduler events. Each serialized event is checked against an allowed key list and verified with
`JSON.stringify`/`JSON.parse`.

## Testing

- Add `tests/integration/devtools-payload-stability.test.ts`.
- Verify the test fails before `serializeDevtoolsEvent()` exists.
- Verify the test passes after explicit serialization is implemented.
- Run full test, typecheck, lint, build, package export, e2e, and format gates.

## Risks

- Event ordering can change if renderer lifecycle semantics change. The test intentionally locks the current minimal
  integrated flow and should be updated only with deliberate runtime changes.
- The helper is internal, so future public DevTools work still needs a separate API design.
