# Component Emit DevTools Design

## Goal

Add a DevTools summary event for component emits so public DevTools listeners can observe component event flow without exposing emitted arguments, props, handler functions, VNodes, or component instances.

## Event Shape

Extend `DevtoolsEvent` with:

```ts
{
  type: "component:emit";
  id: number;
  name: string;
  event: string;
  handlerCount: number;
}
```

- `id`: the component instance DevTools id.
- `name`: the component display name from `getComponentDevtoolsName(instance)`.
- `event`: the emitted event name exactly as passed to `emit()`.
- `handlerCount`: the number of callable handlers that will be invoked for this emit.

## Runtime Boundary

Emit the summary from the internal `emit(instance, event, ...args)` function in `src/component/component.ts`.

The event must be guarded by `hasDevtoolsListeners()` before doing summary work. If no listener exists, emit behavior should remain the same and no extra handler counting work should be performed.

The summary must be emitted after resolving the handler and before invoking handlers. This reports the emit attempt even if a handler later throws, while still avoiding emitted argument capture.

## Handler Count Rules

Use the same resolved handler value that normal emit dispatch uses:

- no matching handler: `handlerCount = 0`
- single function handler: `handlerCount = 1`
- array handler: count only array entries where `typeof item === "function"`
- non-function non-array handler: `handlerCount = 0`

The runtime should not call handlers while counting. Counting must not change invocation order or error behavior.

## Privacy Boundary

Do not include:

- emitted args
- raw props
- listener functions
- component instance references
- VNodes
- DOM nodes
- reactive targets or values
- user-entered content

The emitted event name is allowed because it is developer-authored metadata used to route component events. If future code supports dynamic user-derived event names, callers are responsible for avoiding sensitive values in event names.

## Serialization

`serializeDevtoolsEvent()` must copy only `type`, `id`, `name`, `event`, and `handlerCount` for `component:emit`.

Payload stability tests must include the new event kind and assert that no extra fields are present.

## Documentation

Update `docs/devtools.md`:

- include `component:emit` in the event union
- state that component emit summaries include event name and handler count only
- update the roadmap with a completed component emit summary step

Add a project log entry and index row for the implementation.

## Validation

Use TDD:

1. Add failing component tests for single handler, handler arrays, and missing handlers.
2. Add failing payload stability expectations for `component:emit`.
3. Implement the minimal event type, serializer branch, and guarded emit summary.
4. Run targeted component and payload tests, then full validation.

Required validation commands:

- `pnpm test -- tests/unit/component/lifecycle.test.ts tests/integration/devtools-payload-stability.test.ts`
- `pnpm test`
- `pnpm typecheck`
- `pnpm typecheck:jsxdev`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`
