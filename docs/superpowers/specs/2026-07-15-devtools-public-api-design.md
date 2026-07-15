# DevTools Public API Design

## Goal

Expose a narrow public DevTools integration surface without making internal runtime helpers part of the stable package root API.

## Public API

Add one public package subpath: `solace/devtools`.

The subpath exports:

- `onDevtoolsEvent(listener): () => void`
- `createDevtoolsRecorder(options?): DevtoolsRecorder`
- `type DevtoolsEvent`
- `type DevtoolsEventListener`
- `type DevtoolsRecorderOptions`
- `type DevtoolsRecorder`

The package root remains focused on runtime APIs and does not export DevTools helpers. Existing JSX runtime subpaths remain unchanged.

## Private Internals

These helpers stay private and are not exported from `solace` or `solace/devtools`:

- `emitDevtoolsEvent`
- `hasDevtoolsListeners`
- `clearDevtoolsListeners`
- `serializeDevtoolsEvent`

Runtime modules may continue importing them from `src/devtools/events.ts`, and tests may continue importing internals directly from source when they need to reset isolated state.

## Event Boundary

Public events are serializable summary objects only. They do not expose DOM nodes, VNode trees, component instances, raw props, reactive targets, reactive keys, store state, store action arguments, action results, tokens, URLs, form values, or user content.

The existing event union is the initial public payload contract:

- component mount/update/unmount: `id` and `name`
- scheduler flush: `queuedJobs` and `durationMs`
- reactivity trigger: target/key type summaries and effect counts
- renderer element operation: operation and tag name
- store action: action name, status, and duration

Future event fields must remain JSON-safe and privacy-minimized. Any new event kind needs tests that prove raw runtime objects are not exposed.

## Recorder Lifecycle

`createDevtoolsRecorder()` installs a public listener and stores serialized event copies in memory. `snapshot()` returns a copy of the collected events, `clear()` empties the current capture window, and `stop()` unsubscribes the recorder.

`createDevtoolsRecorder({ limit })` keeps only the latest N events. Invalid limits throw before any listener is installed. The recorder does not persist data, send data over the network, write to storage, or install third-party scripts.

## Production Boundary

DevTools are opt-in. Runtime instrumentation remains dormant until a listener is registered through the public API or internal test hooks. Runtime code must keep payload construction behind listener checks where constructing the payload would require meaningful work.

The public subpath is importable in production builds, but importing it alone does not enable capture. Capture begins only when a listener or recorder is installed. Benchmarks should continue to run without DevTools listeners.

## Package Boundary

`package.json` exports gains `./devtools` with ESM, CJS, and type entries built from a new `src/devtools/index.ts` public barrel.

The public barrel re-exports only the approved public API from `src/devtools/events.ts`. Rollup must build `dist/devtools.js`, `dist/devtools.cjs`, and `dist/devtools.d.ts`.

Package tests must verify:

- `import("solace/devtools")` exposes the approved public API.
- `require("solace/devtools")` exposes the approved public API.
- `import("solace")` still does not expose DevTools APIs.
- `solace/devtools` does not expose internal emit, listener-state, clear, or serializer helpers.

## Documentation

Update `docs/devtools.md` from "no public API yet" to a documented public subpath. Keep the warning that there is no browser extension or UI in this phase.

Update package usage docs and README API notes only if they currently enumerate public package subpaths. Avoid presenting DevTools as a general debugging UI; describe it as a low-level integration surface for examples, tests, and future inspector tooling.

## Validation

Use TDD for the package boundary:

1. Add failing package export tests for `solace/devtools`.
2. Implement the public barrel, export map, and build entries.
3. Verify targeted package tests pass.
4. Run typecheck, JSX dev typecheck, lint, build, default tests, package tests, and format check.

Because this changes package exports, `pnpm test:package` and `pnpm build` are required validation gates.
