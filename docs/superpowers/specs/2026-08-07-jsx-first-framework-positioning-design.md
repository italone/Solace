# JSX-First Framework Positioning Design

## Goal

Reposition Solace as a JSX/TSX-first frontend framework built around function components and
explicit runtime APIs. Keep `.solace` single-file components as an optional, narrow, experimental
auxiliary feature rather than the main framework identity.

This is primarily a positioning and documentation pass, with one narrow JSX type-surface hardening:
`key` is a framework-level JSX attribute for keyed children, and TSX component children map to
Solace default slots without requiring a `children` prop. JSX `onXxx` component event handlers map
to Solace `emit()` conventions at the type boundary, accepting functions or arrays of functions.
TSX fragment shorthand is covered as part of the public JSX authoring path. It should not expand SFC
syntax, remove existing SFC entry points, or change runtime behavior.

## Context

Solace currently contains both a React-like function component and JSX runtime path, and a narrow
`.solace` compiler path. The SFC path is intentionally constrained:

- One `<template>` block.
- Optional `<script>` block.
- Optional `<style>` block.
- No block attributes.
- No custom top-level blocks.
- No Vite plugin options.
- No `.solace?*` query transforms.
- Vite transform source maps return `map: null`.

That narrow surface is already tested and documented as a public beta boundary. Expanding it now
would make Solace look more Vue-like and shift attention away from the framework's stronger
identity: a compact TypeScript runtime with function components, JSX/TSX, explicit reactivity,
scheduled rendering, router, SSR/SSG helpers, and DevTools APIs.

## Product Direction

Solace should lead with:

- Function components as the primary component authoring model.
- JSX/TSX as the primary UI authoring syntax.
- Explicit runtime APIs for reactivity, rendering, scheduling, styles, router, server rendering,
  static generation, and DevTools.
- React-influenced authoring ergonomics without becoming a React compatibility layer or cloning the
  React API surface wholesale.
- Small, readable implementation boundaries instead of broad framework ecosystem imitation.

The project should not present SFC stabilization as the next major framework direction. SFC remains
useful for demonstrating the compiler and Vite plugin pipeline, but it is not the center of Solace's
public identity.

## Public Messaging Changes

Update the documentation and roadmap so they consistently say:

- Solace is JSX/TSX-first.
- `.solace` is optional and experimental.
- The SFC compiler is intentionally narrow and will not be expanded without a separate design.
- The near-term roadmap prioritizes TSX-first runtime ergonomics, examples, and public API clarity.
- SFC/Vite work is limited to keeping the existing experimental contract reliable.
- React-style means TSX function components and event-driven UI composition, while Solace still owns
  its JSX types, component events, slots, and runtime primitive names.

Avoid phrasing that suggests Solace is trying to become a Vue-style SFC framework.

## Implementation Scope

Change documentation and the narrow JSX type surface only:

- `readme.md`
- `readme.zh-CN.md`
- `src/jsx-runtime.ts`
- `src/jsx-dev-runtime.ts`
- `tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx`
- `vitest.config.ts`
- `docs/api.md`
- `docs/api.zh-CN.md`
- `docs/examples.md`
- `docs/package-usage.md`
- `docs/project-status.md`
- `docs/project-status.zh-CN.md`
- `docs/roadmap.md`

Likely updates:

- Reword project status summaries around JSX/TSX-first usage.
- Lead the top-level API and package usage examples with TSX function components.
- Treat JSX `key` as a Solace-owned framework attribute for function components and keyed children.
- Treat TSX component children as Solace default slot input without requiring a component
  `children` prop.
- Treat JSX `onXxx` attributes as Solace component event handlers that align with `emit()` and
  reject non-function handler values at the TSX boundary.
- Cover TSX fragment shorthand as part of the JSX-first authoring contract.
- Reword SFC example descriptions as experimental auxiliary examples.
- Move SFC stabilization out of the top roadmap priority.
- Add a roadmap item for TSX-first runtime ergonomics and examples.
- Preserve existing public SFC entry point documentation, but make the experimental boundary clear.

Do not change:

- `src/compiler/**`
- `src/vite/**`
- package exports
- SFC tests
- examples

## Testing And Validation

Minimum validation:

- `pnpm format:check`
- `pnpm typecheck`
- `pnpm typecheck:jsxdev`
- Focused JSX runtime tests.
- Targeted text scan confirming `narrow .solace compiler surface` and similar wording no longer
  appears as a primary selling point in README project status sections.
- Targeted text scan confirming `JSX/TSX-first` appears in README, package usage or roadmap, and
  project status docs.

Broader validation such as `pnpm build` or `pnpm test:e2e` is not required because runtime behavior,
package exports, examples, and browser workflows are unchanged.

## Risks

- Overcorrecting the wording could make the existing SFC entry points look unsupported. The docs
  should say SFC is optional and experimental, not removed.
- Leaving old roadmap language in place would keep the Vue-like direction ambiguous.
- Expanding beyond JSX key typing would mix product positioning with broader runtime behavior and
  make the change harder to review.

## Acceptance Criteria

- README and project status describe Solace as JSX/TSX-first.
- SFC is consistently described as optional, narrow, and experimental.
- Roadmap prioritizes TSX-first runtime ergonomics over SFC expansion.
- JSX `key` is documented and typed as a framework-level string/number attribute.
- TSX component children are documented and typed as default slot input.
- JSX `onXxx` component event handlers are documented and typed as function or function-array
  framework attributes.
- TSX fragment shorthand is documented and covered by focused tests.
- Existing SFC public entry docs remain accurate.
- No SFC runtime, package export, example, or browser workflow files are changed for this pass.
