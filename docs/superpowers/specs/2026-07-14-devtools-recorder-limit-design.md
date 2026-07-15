# DevTools Recorder Limit Design

## Context

The internal DevTools recorder can now capture serialized event snapshots and clear capture windows. Example and
experiment captures may run through repeated interactions, so the recorder needs a bounded mode before any public API
discussion.

## Goals

- Add an optional `limit` to `createDevtoolsRecorder()`.
- Keep only the latest N serialized events when a limit is configured.
- Reject invalid limits early.
- Preserve existing unlimited recorder behavior when no limit is passed.
- Keep the feature internal and out of package root exports.

## Non-Goals

- Do not add a public DevTools API.
- Do not add persistence, uploads, sampling, filtering, or UI.
- Do not change runtime event emission.
- Do not expose raw event payloads.

## Design

Add:

```ts
export interface DevtoolsRecorderOptions {
  limit?: number;
}

export function createDevtoolsRecorder(options?: DevtoolsRecorderOptions): DevtoolsRecorder;
```

If `limit` is provided, it must be a positive integer. After each serialized event is pushed, trim the internal event
array from the front so only the latest `limit` events remain.

## Testing

- Add unit coverage proving a limit of 2 keeps only the latest two events.
- Add unit coverage rejecting `0` and non-integer limits.
- Keep existing snapshot, clear, and stop behavior unchanged.

## Risks

- Dropping older events is deliberate in bounded mode. Consumers that need complete traces should omit `limit`.
