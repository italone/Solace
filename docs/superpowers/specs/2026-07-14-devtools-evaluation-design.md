# DevTools Evaluation Design

## Context

Solace now has a working runtime, examples, package build, release gates, and benchmark coverage. README still lists
DevTools as a future candidate. There is no current debug hook, event stream, inspector protocol, or browser
extension integration.

## Goals

- Add a focused DevTools evaluation document.
- Identify useful DevTools capabilities without committing to an API too early.
- Define safe runtime hook boundaries and risks.
- Update README to link the evaluation.
- Record the decision in the project log.

## Non-Goals

- Do not implement DevTools hooks.
- Do not expose new public APIs.
- Do not add browser extensions, panels, overlays, or Vite plugins.
- Do not change runtime behavior.

## Recommended Direction

Start with documentation and candidate hook boundaries:

- Component tree inspection should eventually observe component mount/update/unmount.
- Reactivity inspection should eventually observe effect creation, dependency tracking, and triggers.
- Scheduler inspection should eventually observe queued jobs and flush timing.
- Renderer inspection should eventually observe mount/patch/unmount events.
- Store inspection should eventually observe action calls and state snapshots.

The first implementation, if pursued later, should be a development-only internal event bus with opt-in registration.
It should avoid exposing live mutable internal instances as public API.

## Risks

- DevTools can accidentally stabilize internal implementation details.
- Hook payloads can leak application data if snapshots are too broad.
- Instrumentation can distort performance benchmarks.
- A browser extension or UI panel is premature before the runtime event model is settled.

## Validation

This step is documentation-only. Validate with Prettier plus lightweight static commands:

- `pnpm format:check`
- `pnpm lint`
- `pnpm build`
