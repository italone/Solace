# Reactivity DevTools Trigger Summary Design

## Context

Solace now emits internal DevTools summaries for scheduler flushes, component lifecycle events, and store actions. The
remaining high-value runtime signal is reactivity trigger behavior. A trigger summary can show that a reactive mutation
caused direct effect reruns or scheduled effects without exposing user data.

## Goals

- Emit a `reactivity:trigger` event through the internal DevTools event bus after a reactive dependency triggers effects.
- Include only summary fields: `targetType`, `keyType`, `effectCount`, `scheduledEffects`, and `runEffects`.
- Avoid exposing raw targets, property keys, values, dependency sets, or effect instances.
- Avoid event work when no DevTools listener is registered.
- Preserve existing effect, computed, watch, and scheduler behavior.

## Non-Goals

- Do not expose raw reactive objects or dependency graphs.
- Do not emit dependency tracking events in this step.
- Do not add public DevTools APIs or package exports.
- Do not label individual effects or capture stack traces.

## Design

Extend `DevtoolsEvent` in `src/devtools/events.ts`:

```ts
{
  type: "reactivity:trigger";
  targetType: string;
  keyType: string;
  effectCount: number;
  scheduledEffects: number;
  runEffects: number;
}
```

Update `trigger()` in `src/reactivity/effect.ts` to count active effects by execution path. Direct effects increment
`runEffects`; effects with a scheduler increment `scheduledEffects`. After executing or scheduling active effects, emit a
summary only if a DevTools listener exists.

## Testing

- Add unit coverage for a direct effect rerun and assert the summary counts one run effect.
- Add unit coverage for a scheduled effect through `watch()` and assert the summary counts one scheduled effect.
- Assert the summary does not include `target`, `key`, `value`, or `effects`.

## Risks

- The current summary intentionally reports only target/key types, so it cannot identify the exact property that changed.
  This keeps the privacy boundary narrow until a future explicit inspector design exists.
- Effects that become inactive before a trigger are excluded from counts, matching runtime behavior.
