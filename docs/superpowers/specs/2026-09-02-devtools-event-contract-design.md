# DevTools Event Contract Extension Design

Date: 2026-09-02
Status: approved (conversation)

## Purpose

The DevTools contract has 8 event types across 5 families but no router visibility, no stale-job
signal, no contract version, and no way to connect a reactivity trigger to the component update
it caused. This extension adds all four while keeping payloads small serializable summaries and
reading no private runtime state.

## Changes

### 1. Router navigation events (new `router` family)

New event type:

```ts
interface DevtoolsRouterNavigationEvent {
  type: "router:navigation";
  to: string; // fullPath summary only
  from: string;
  status: "start" | "success" | "redirect" | "error" | "cancelled";
}
```

- Emitted from `src/router/router.ts` in `navigate`/`startInitialSettlement` outcome branches,
  guarded by `hasDevtoolsListeners()` (zero cost with no listener).
- `to`/`from` are `fullPath` strings only — no params/query objects, no matched records.
- Redirects emit one `status: "redirect"` event with `to` = the final landing route (no
  per-hop events). Guard cancellation emits `status: "cancelled"`; navigation errors emit
  `status: "error"`. `status: "start"` fires at navigation begin; `status: "success"` on
  settled landing.

### 2. Scheduler stale-job signal

`scheduler:flush` payload gains `skippedStaleJobs: number` — count of stale jobs skipped during
that flush. Pure counter; no job identities.

### 3. Contract version

- `serializeDevtoolsEvent` output is unchanged. The version lives at the handshake layer: the
  panel's `devtools:panel:connect` message carries `contractVersion: 1`, and the bridge
  acknowledges it.
- `docs/devtools.md` documents the version and the evolution rule: additive payload fields stay
  within a version; removing/renaming/retyping fields requires a version bump.
- The payload-stability integration test locks the current field set per event type.

### 4. Correlation id (narrow causality chain)

- `reactivity:trigger` gains `correlationId: number` — a monotonically increasing counter
  allocated only when a devtools listener exists.
- The scheduler records causes in a module-level `WeakMap<job, number>` when queueing jobs from
  a trigger that carried an id; the entry is consumed/cleared on flush.
- `component:update` gains optional `correlationId?: number`, present only when the component's
  update job was queued from a cause-carrying trigger. Absent field means no known cause — the
  contract never fabricates causality.
- `scheduler:flush` gains `distinctCauses: number` (count of distinct correlation ids observed
  in the flush). No per-job detail.

### 5. Panel and tests

- Panel families gain `router`; the timeline detail pane shows `correlationId` when present
  ("related trigger #n").
- Unit tests: emission sites, serialization of new types/fields, guard short-circuit (no id
  allocation, no WeakMap writes without listeners).
- Integration: payload-stability test extended to lock the new fields; bridge tests for the
  versioned handshake.
- E2e: router navigations appear in the timeline; family filter includes router.

## Contract impact

Minor bump: new event type on the `@italone/solace/devtools` surface, additive payload fields
on `scheduler:flush` and `component:update` (documented as version-1 additive). Docs
(`docs/devtools.md`, `docs/api.md` DevTools sections), roadmap, and changeset updated together.

## Out of scope

Effect create/stop events, dependency-graph signals, getter recomputation events, renderer
prop-patch granularity, per-job scheduler detail, streaming event transport, and any payload
fields containing user content or runtime object references.
