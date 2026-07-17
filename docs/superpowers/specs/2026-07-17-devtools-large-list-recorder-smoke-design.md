# DevTools Large List Recorder Smoke Design

## Context

Solace now exposes a narrow `solace/devtools` public subpath with listener and recorder APIs. Release readiness,
quality, full release check, and private publishability guard have all been validated locally. Browser benchmark
latest-window data is stable enough that the next useful step is not another renderer micro-optimization, but a stronger
real-example DevTools payload smoke.

The existing recorder example smoke is todo-shaped. It proves recorder capture around a small interaction, but it does
not exercise the large keyed-list update path that has received most of the recent renderer performance work.

## Goals

- Add a large-list-shaped DevTools recorder smoke that exercises a 10,000-row keyed update.
- Validate the public `createDevtoolsRecorder()` API through `solace/devtools`, not internal recorder imports.
- Assert captured events stay small, serializable summaries.
- Assert captured events do not expose DOM nodes, VNodes, component instances, raw props, raw state, action arguments,
  action results, reactive targets, user text values, or list item data.
- Keep runtime behavior, package exports, and public DevTools API shape unchanged.

## Non-Goals

- Do not build a DevTools inspector UI, browser extension, panel, persistence layer, transport, or telemetry.
- Do not add new DevTools event kinds.
- Do not add raw component tree, dependency graph, DOM, VNode, props, state, store args, or list row snapshots.
- Do not modify example app source files unless the test cannot cover the same behavior with an in-test fixture.
- Do not add timing thresholds or performance claims.

## Design

Add an integration test, likely `tests/integration/devtools-large-list-recorder-smoke.test.ts`.

The test should create a compact large-list fixture inside the test file:

- a reactive state with `selected`,
- a component rendering 10,000 keyed rows,
- one control or direct state mutation that moves selection from row 1 to row 5000,
- a recorder created from the public `solace/devtools` subpath.

The test flow:

1. Install `createDevtoolsRecorder({ limit })` before rendering.
2. Render the large-list fixture.
3. Clear initial mount noise with `recorder.clear()`.
4. Trigger one selected-row update.
5. Await `nextTick()`.
6. Read `recorder.snapshot()`.
7. Stop the recorder in a `finally` block.

Assertions should verify:

- at least one scheduler summary was captured for the update window,
- renderer summaries include update activity without DOM or VNode references,
- component summaries, if emitted by the current update flow, contain only `id` and `name`,
- every event survives `JSON.stringify` / `JSON.parse`,
- serialized event keys are within the documented allow-list for each event kind,
- no event payload contains row text such as `Row 5000`, the selected state value as user content, DOM nodes, functions,
  arrays of row data, or object-shaped runtime internals.

The event allow-list should be local to the test unless an existing helper already owns this policy. If the test needs a
shared helper, add it only when it reduces duplication with current payload stability tests.

## Data Flow

State mutation triggers reactive effects, scheduler batching, component render, renderer patching, and internal DevTools
event emission. The public recorder receives serialized summary events through the public listener path. The smoke test
inspects only the recorder snapshot after the update window.

The recorder remains passive: importing `solace/devtools` should not start capture, and capture starts only when
`createDevtoolsRecorder()` installs a listener.

## Error Handling

The test must call `recorder.stop()` in `finally` so listener state does not leak into other tests. If it uses
`createDevtoolsRecorder({ limit })`, choose a limit high enough to retain the update-window summaries while still
exercising bounded capture semantics.

If the current renderer emits fewer event kinds than expected for this update, prefer assertions on documented
guarantees over brittle ordering. The test should fail on unsafe payload shape or missing broad update evidence, not on
incidental event ordering.

## Testing

Use TDD:

1. Add the large-list recorder smoke and verify RED if existing payload coverage is insufficient.
2. Implement only the minimum test support or runtime guard needed to pass.
3. Run the targeted integration test.
4. Run DevTools payload stability tests.
5. Run default tests, typecheck, lint, build, format check, and package tests if any public import path changes.

Expected validation commands:

```bash
pnpm vitest run tests/integration/devtools-large-list-recorder-smoke.test.ts
pnpm vitest run tests/integration/devtools-payload-stability.test.ts
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
git diff --check
```

If implementation changes package exports or `solace/devtools`, also run:

```bash
pnpm test:package
pnpm package:smoke
```

## Risks

- A 10,000-row jsdom integration test can become slow if the fixture does too much. Keep the interaction single-shot and
  avoid repeated renders.
- Event ordering may shift as renderer internals evolve. Assertions should prefer payload contracts and broad event
  presence over strict sequence.
- The test may reveal that an existing event includes too much information. If that happens, fix the payload boundary,
  not the test expectation.

## Acceptance Criteria

- A design-approved implementation adds large-list recorder coverage without widening public DevTools API.
- The smoke proves public recorder capture remains JSON-safe and privacy-minimized for large keyed-list updates.
- Validation commands pass and the project log records the implementation.
