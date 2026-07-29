# SSR/SSG/Hydration Next Phase Design

## Goal

Define the next SSR/SSG/hydration phase after the minimum loop. This phase should harden the
existing public contract without expanding `.solace` syntax or router beta features, and it should
come before any browser DevTools extension UI work.

## Current Baseline

Local `main` is intentionally not pushed and is currently documented as `ahead 9` from
`origin/main` after the hydration mismatch recovery work. Future release, publish, push, or sync
claims must still recheck the remote with `git fetch origin main`, `git status --short --branch`,
and `git rev-list --left-right --count origin/main...HEAD`.

Implemented baseline:

- `renderToString()` renders synchronous VNode/component trees.
- `renderToString().styles` returns serialized `<style data-s-id="...">...</style>` strings.
- `useStyle(scopeId, css)` is the shared runtime style registration path.
- `hydrate()` reuses matching server style tags and dedupes by `data-s-id`.
- `hydrate()` throws structured `SolaceHydrationError` diagnostics by default and supports explicit
  `{ recover: true }` deopt to replace mismatched server DOM with the client tree.
- `generateStaticSite()` provides in-memory SSG on top of `renderToString()`.
- `@italone/solace/vite` and `@italone/solace/sfc` remain the only public SFC/Vite entries.
- Router beta remains limited to the current SPA slice.

## Non-Goals

- No `.solace` syntax expansion.
- No nested routes, route guards, redirects, lazy route contracts, scroll behavior, memory history,
  auth, or permission routing.
- No browser DevTools extension UI in this phase.
- No first-party UI component library.
- No plugin ecosystem work.

## Public Contract Guardrails

SFC/Vite stabilization stays focused on the existing contract:

- One `<template>` block.
- Optional `<script>` block.
- Optional `<style>` block.
- JSX-like template expressions.
- Vite transform diagnostics.
- `map: null`.
- Runtime style registration through `useStyle()`.
- No public Vite plugin options yet; passing options is rejected instead of implying syntax
  expansion.
- SFC block attributes and custom top-level blocks are rejected until separately designed.

Router stabilization stays focused on the existing beta slice:

- Static routes.
- Dynamic params.
- Wildcard fallback route.
- Query strings.
- Web/hash history.
- `RouterLink`, `RouterView`, `useRoute`, and `useRouter`.
- Deferred route fields and router options are rejected instead of silently widening the beta slice.
- Dynamic param syntax remains limited to simple `:name` segments plus `/:pathMatch(.*)*`.

Any public API change must keep these hard gates mandatory:

- `pnpm release:readiness`
- `pnpm package:smoke`
- `pnpm test:e2e`

## Next SSR/SSG/Hydration Work

### 1. Hydration Mismatch Policy

The minimum loop throws on structural mismatch by default. The current next-phase contract adds
structured diagnostics and an explicit deopt recovery option without making recovery implicit.

Required design points:

- Preserve throw-on-mismatch as the default.
- Include node path, expected shape, and actual DOM shape in the error where practical.
- Keep recovery opt-in through `{ recover: true }`.
- Only recover `SolaceHydrationError`; non-hydration errors and style conflicts must continue to
  throw.
- Automatic or router-aware recovery remains deferred until SSR/SSG/router boundaries are separately
  designed.

### 2. SSR/SSG Shell Contract

`generateStaticSite()` already passes collected styles to `shell`. The next phase should document and
test shell composition patterns rather than adding filesystem output.

Required design points:

- Preserve in-memory `generateStaticSite()` output.
- Keep `styles` as serialized style tags.
- Document how shells place `styles.join("")` in `<head>`.
- Keep filesystem output and manifest asset injection deferred.

### 3. Production Manifest Boundary

Production asset manifests are still deferred, but the boundary should be explicit before any API is
added.

Required design points:

- Do not read Vite manifests inside `renderToString()`.
- Reject deferred `manifest`, `clientEntry`, and `router` options in `renderToString()`.
- Do not infer client entries inside `generateStaticSite()`.
- Reject deferred `manifest` and `clientEntry` options in `generateStaticSite()` instead of
  silently accepting them.
- Future manifest integration should be an adapter or shell helper, not a server renderer concern.

### 4. Router Integration Boundary

Router SSR/SSG/hydration integration remains deferred. The next phase should define what must be
true before adding it.

Required design points:

- Do not add public `createMemoryHistory()` yet.
- Do not add nested routes or guards as part of SSR work.
- Reject deferred `router` integration options in `generateStaticSite()` instead of silently
  accepting them.
- Keep app-local explicit route sources as the supported SSG path.
- Require a separate router SSR design before router-aware SSG adapters.

### 5. DevTools Extension Sequencing

Browser DevTools extension UI starts after the SSR/SSG/hydration design has a stable boundary.

Required design points:

- The extension UI must build on `@italone/solace/devtools`.
- It must not change runtime event payloads without a compatibility review.
- It should consume SSR/hydration lifecycle events only after those events are explicitly designed.

## Validation Strategy

For design-only changes:

- `pnpm exec prettier --write <changed docs>`
- `git diff --check`
- `pnpm release:readiness`
- `pnpm package:smoke`
- `pnpm test:e2e`

For future implementation changes:

- Add focused unit/integration tests first.
- Run `pnpm quality`.
- Run the three hard public API gates.
- Run `pnpm release:check` before release claims; if benchmark instability blocks it, record the
  exact failing phase and rerun the failing command independently.

## Acceptance Criteria

- The local release baseline is explicitly documented when GitHub push fails.
- SFC/Vite contract work remains stabilization-only.
- Router beta work remains narrowing/stabilization-only.
- SSR/SSG/hydration next-phase boundaries are documented before DevTools extension UI work.
- Public API hard gates remain visible in project status and roadmap.
