# DevTools

Solace exposes a narrow public DevTools integration surface through `@italone/solace/devtools`. This document records the public
lifecycle, private runtime boundary, and safe constraints for future instrumentation.

## Goals

- Help developers inspect component, reactivity, scheduler, renderer, and store behavior.
- Keep instrumentation opt-in.
- Avoid stabilizing internal runtime objects as public API.
- Avoid adding measurable overhead to production builds or benchmarks.

## Non-Goals

- No network transport, storage persistence, automatic telemetry, hidden runtime inspection, or
  production distribution workflow in the current phase.
- No SSR/SSG/hydration visualization until those runtime boundaries and event payloads are designed
  separately.

## Public API

DevTools integrations should import from the `@italone/solace/devtools` subpath:

```ts
import { createDevtoolsRecorder, onDevtoolsEvent } from "@italone/solace/devtools";
import type { DevtoolsEvent } from "@italone/solace/devtools";
```

The public subpath exports listener and recorder APIs only. It does not export emit helpers, listener-state helpers,
global cleanup helpers, serializers, DOM nodes, VNode trees, component instances, props, reactive targets, store state,
action arguments, or action results.

## Public API Lifecycle

`@italone/solace/devtools` is the only supported public DevTools entry point. New runtime exports require package boundary tests,
packed consumer smoke coverage, documentation, and a project log entry before they are treated as supported API.

Event payload additions must remain small serializable summaries and must update payload stability coverage. They should
not include raw props, state, DOM nodes, VNodes, reactive targets, action arguments, action results, stack traces, or
user content.

Renames or removals require an intentional breaking-change plan. Internal helpers remain private even when public APIs
reuse them internally, and incidental runtime cleanup must not change the public subpath shape.

## Candidate Capabilities

| Area       | Useful Signals                                         | Notes                                                                        |
| ---------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Components | mount, update, unmount, props, emits, lifecycle hooks  | Component lifecycle and emit summaries are emitted by the internal event bus |
| Reactivity | effect creation, dependency tracking, triggers, stops  | Trigger summaries are emitted without raw targets, keys, or values           |
| Scheduler  | queued jobs, flush duration, skipped stale jobs        | `scheduler:flush` summary is emitted by the internal event bus               |
| Renderer   | element mount, prop patch, child diff, unmount         | Element summaries are emitted without DOM nodes or VNode trees               |
| Store      | action calls, narrow state paths, getter recomputation | Action summaries are emitted without args, results, or state                 |

## Hook Boundary

Solace has an internal event bus in `src/devtools/events.ts`. Runtime modules emit through that internal bus, while
public integrations subscribe through `@italone/solace/devtools`. The package root intentionally does not export DevTools APIs.

```ts
type DevtoolsEvent =
  | { type: "component:mount"; id: number; name: string; parentId: number | null }
  | { type: "component:update"; id: number; name: string; parentId: number | null }
  | { type: "component:unmount"; id: number; name: string; parentId: number | null }
  | { type: "component:emit"; id: number; name: string; event: string; handlerCount: number }
  | { type: "scheduler:flush"; queuedJobs: number; dedupedJobs: number; durationMs: number }
  | {
      type: "reactivity:trigger";
      targetType: string;
      keyType: string;
      effectCount: number;
      scheduledEffects: number;
      runEffects: number;
    }
  | {
      type: "renderer:element";
      operation: "mount" | "update" | "unmount";
      tag: string;
    }
  | {
      type: "store:action";
      name: string;
      status: "success" | "error";
      durationMs: number;
    };
```

`component:emit` summaries include the component id, component name, emitted event name, and callable handler count only.
They do not include emitted arguments, raw props, handler functions, component instances, VNodes, DOM nodes, or user
content.

`scheduler:flush` summaries include executed job count, deduped queue attempt count, and flush duration only. They do
not include scheduler job functions, function names, stack traces, component instances, reactive effects, VNodes, DOM
nodes, or user data.

Future runtime modules should emit small serializable events only when a listener is registered. If no listener is registered, the runtime should do no meaningful extra work.

`serializeDevtoolsEvent(event)` is available only from the internal event bus module. It returns an explicit plain-object
copy for the current event union and is used by integration tests to lock the payload boundary. It is not exported from
the package root.

`createDevtoolsRecorder()` is public through `@italone/solace/devtools`. It installs a listener, stores serialized events in
memory, exposes `snapshot()` for a copy of collected events, exposes `clear()` to reset the current capture window, and
exposes `stop()` to remove the listener. Pass `{ limit }` to keep only the latest N events in memory. It does not
persist data, send data over the network, write to storage, or install third-party scripts.

Production package builds do not publish JavaScript sourcemaps. This keeps internal DevTools wiring visible in source
control but out of package artifacts, so consumers do not accidentally couple to private helper names or module layout.

## Browser Extension Panel

The repository now includes a first browser DevTools extension example under
`examples/devtools-extension`. It opens a Solace panel, captures DevTools events for the inspected
tab through the public `@italone/solace/devtools` listener, and renders a local timeline view.
The runtime installs a non-exported page-local DevTools hook for browser extensions so the injected
bridge can subscribe to the inspected page event bus as a classic script without importing private
modules or bundling a second event bus.

The initial panel scope is intentionally narrow:

- Timeline rows for component, scheduler, reactivity, renderer, and store event families.
- Family filters, pause/resume, clear, selected-event details, and a bounded capture limit.
- A detail pane that displays the serialized `DevtoolsEvent` payload exactly as received.
- Extension wiring through a DevTools page, content script, page bridge, background relay, and panel
  transport.
- Tab-scoped activation: content scripts open a runtime port, but the page bridge is injected only
  after a Solace panel connects for that browser tab.
- A Components tab that incrementally builds the inspected page's component tree from
  `component:mount`/`update`/`unmount` events, highlighting updated nodes, pruning unmounted
  subtrees, and supporting node collapse. The tree is derived from event summaries only
  (`id`, `name`, `parentId`); it does not read component instances, props, state, or DOM.

The extension does not change runtime payloads. It does not inspect component instances, DOM nodes,
VNodes, props, store state, reactive targets, user content, stack traces, action arguments, or action
results. It does not persist captured events, send them over the network, install analytics, or model
SSR/SSG/hydration state.

The example manifest is restricted to the fixed local demo origins
`http://127.0.0.1:6174/*` and `http://localhost:6174/*` for the content script,
`host_permissions`, and bridge web-accessible resource. This keeps the checked-in example from
requesting arbitrary inspected-page access. A production distribution must define its inspected
origins explicitly and must not widen this list by default.

Keep the example manifest local-only. Do not add `permissions`, `optional_permissions`,
`externally_connectable`, `oauth2`, or custom `content_security_policy` entries without a separate
production extension policy review. In particular, the example should not request `storage`, `tabs`,
`scripting`, or `webRequest`; the current panel keeps captures in memory and relays only through the
inspected-tab extension ports.

Run the example locally with:

```bash
pnpm dev:devtools-extension
```

The panel offers a `Timeline` view for all recorded event families, a `Store` view listing
recorded `store:action` summaries as `{ time, type, status, durationMs }` entries, and a
`Components` view building the component tree from `parentId`-extended component event summaries.
The
`store-timeline.html` demo page in the example builds a Solace app with a store and dispatches an
`increment` action so the panel can record it.

Validate the extension build and browser smoke with:

```bash
pnpm build:devtools-extension
pnpm test:e2e:devtools-extension
```

`pnpm package:devtools-extension:smoke` runs the real distributable build with the reserved
`https://devtools-smoke.invalid` origin and writes an ignored ZIP plus evidence sidecar. It verifies
packaging and manifest permission consistency only. The `.invalid` origin never counts as a tested production origin
and the smoke output must not be copied into checked-in release evidence.

Create an origin-scoped distributable ZIP only with explicit production origins:

```bash
pnpm package:devtools-extension -- --origin https://app.example.com
```

Repeat `--origin` for each reviewed site. The command accepts only an exact HTTPS origin without a
path, wildcard, credentials, query, or fragment. It applies the same allowlist to `content_scripts`,
`host_permissions`, and `web_accessible_resources`, rejects extra privileged manifest keys, verifies
the generated manifest, and writes `.devtools-artifacts/solace-devtools.zip` plus a deterministic
`.devtools-artifacts/solace-devtools.evidence.json` sidecar. The sidecar binds the repository-relative
ZIP path, ZIP SHA-256, generated manifest SHA-256, and normalized origins. The artifact directory is
ignored. Producing these files proves deterministic packaging and permission scope.

The sidecar does not prove that a real production origin was exercised. It also does not prove that
a browser store accepted the package. Load that exact artifact against every declared origin before
updating release evidence.

## Inspected Origin Checklist

Before distributing the extension beyond local demos:

1. Review `manifest.json` `host_permissions`.
2. Build the ZIP with explicit `--origin` values and retain its SHA-256 digest.
3. Confirm no runtime payload changes are required.
4. Load the exact ZIP on every declared production origin and record the result.
5. Run `pnpm test:e2e:devtools-extension` as the local regression suite.
6. Publish only after explicit maintainer review.

For 1.0 evidence, copy the reviewed sidecar fields into the structured distribution record and bind
the QA result to the same ZIP SHA-256. A passing test from a different build, a digest without its
manifest digest, a wildcard origin, or packaging against a non-production example origin does not
satisfy the production distribution criterion.

## Browser Extension QA Checklist

Before treating the extension example as ready for a release note or demo, verify the bounded
workflow rather than private runtime state:

- `pnpm build:devtools-extension` produces classic extension scripts without module imports.
- `pnpm test:e2e:devtools-extension` captures relayed public `DevtoolsEvent` summaries in the panel.
- Review `matches`, `host_permissions`, and `web_accessible_resources.matches` against the exact
  inspected origins before producing a production browser-store package or demo build.
- Confirm the manifest still has no storage, tabs, scripting, webRequest, externally connectable,
  OAuth, or custom CSP powers unless a separate production extension policy has approved them.
- Pause, resume, clear, family filters, selected-event details, and capture limits work without
  persisting events.
- Disconnecting or reconnecting the panel does not require the inspected app to reload.
- Failed page `postMessage`, stale runtime ports, or panel disconnects do not crash the inspected
  Solace app.
- Captured payloads remain serialized summaries and do not include raw props, state, DOM nodes,
  VNodes, reactive targets, action arguments, action results, stack traces, or user content.

## Local Distribution Evidence

`release/devtools-distribution-evidence.md` records a fresh local production build and Chromium
extension smoke for the example. It covers the generated manifest permissions, classic bridge and
content scripts, sourcemap exclusion, and the two passing browser workflows. This evidence is local
distribution validation only and does not claim browser-store publication, store review, signing,
automatic updates, or a production-wide inspected-origin policy.

## Privacy And Safety

- Do not emit full props, state, DOM nodes, or reactive targets by default.
- Redact or summarize values before exposing them to tooling.
- Keep hooks disabled unless a dev-only listener is installed.
- Do not send data over the network.

## Performance Constraints

- Production builds should not pay for DevTools instrumentation.
- Benchmark commands should run with DevTools disabled.
- Hook payload construction should be lazy or guarded by a listener check.
- Component tree and dependency graph snapshots should be explicit actions, not automatic on every update.

## Phased Roadmap

1. **Event model design**: completed for initial component and scheduler summary events.
2. **Development-only event bus**: internal event bus exists in `src/devtools/events.ts`.
3. **Scheduler flush and dedupe summary**: `scheduler:flush` reports executed jobs, deduped queue attempts, and duration.
4. **Component lifecycle summaries**: component mount/update/unmount summaries emit id, name, and
   `parentId: number | null` only.
5. **Component emit summaries**: `component:emit` is emitted with event name and callable handler count only.
6. **Store action summaries**: `store:action` is emitted after action success or error without raw values.
7. **Reactivity trigger summaries**: `reactivity:trigger` is emitted without raw targets, keys, or values.
8. **Renderer element summaries**: `renderer:element` is emitted for element mount/update/unmount without DOM nodes or VNode trees.
9. **Payload stability smoke**: integrated runtime events serialize to JSON-safe payloads with allowed fields only.
10. **Internal recorder boundary**: `createDevtoolsRecorder()` captures serialized event snapshots for examples and experiments.
11. **Example-oriented recorder smoke**: a todo-style interaction validates recorder capture after clearing initial mount noise.
12. **Bounded recorder captures**: `createDevtoolsRecorder({ limit })` keeps recorder memory bounded for examples and experiments.
13. **Large-list recorder smoke**: a 10,000-row keyed update validates public recorder snapshots remain serialized summaries without DOM, VNode, raw state, or row data.
14. **Public package boundary guard**: package exports tests verify DevTools internals are not available from the package root.
15. **Public DevTools subpath**: `@italone/solace/devtools` exposes listener and recorder APIs without internal emit helpers.
16. **Production artifact boundary**: package builds do not publish JavaScript sourcemaps that expose internal wiring.
17. **Browser extension timeline panel**: `examples/devtools-extension` builds a local DevTools
    panel that consumes only the public DevTools subpath and renders the existing serialized event
    summaries.

## Recommendation

Use the browser extension panel as an example-grade inspector for the current public DevTools event
contract. Keep future UI expansion tied to explicit runtime event designs: component trees,
dependency graphs, flame charts, persisted captures, telemetry, and SSR/SSG/hydration panels should
not be added by inferring private runtime state.
