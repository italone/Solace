# SSR/SSG/Hydration Next Phase Design

## Goal

Define the next SSR/SSG/hydration phase after the minimum loop. This phase should harden the
existing public contract without expanding `.solace` syntax or router beta features, and it should
come before any browser DevTools extension UI work.

## Current Baseline

The current local release baseline is the 18 local commits ahead of `origin/main` after the SSR style
collection checkpoint. `git fetch origin main` succeeded on 2026-07-28 and confirmed that the remote
was not ahead. `git push origin main` then failed because the environment could not connect to
`github.com:443`, so these 18 local commits are the working release baseline until push succeeds.

Implemented baseline:

- `renderToString()` renders synchronous VNode/component trees.
- `renderToString().styles` returns serialized `<style data-s-id="...">...</style>` strings.
- `useStyle(scopeId, css)` is the shared runtime style registration path.
- `hydrate()` reuses matching server style tags and dedupes by `data-s-id`.
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

Router stabilization stays focused on the existing beta slice:

- Static routes.
- Dynamic params.
- Wildcard fallback route.
- Query strings.
- Web/hash history.
- `RouterLink`, `RouterView`, `useRoute`, and `useRouter`.

Any public API change must keep these hard gates mandatory:

- `pnpm release:readiness`
- `pnpm package:smoke`
- `pnpm test:e2e`

## Next SSR/SSG/Hydration Work

### 1. Hydration Mismatch Policy

The minimum loop throws on structural mismatch. The next phase should make that failure mode easier
to diagnose without adding best-effort recovery yet.

Required design points:

- Preserve throw-on-mismatch as the default.
- Include node path, expected shape, and actual DOM shape in the error where practical.
- Keep recovery/deopt behavior deferred until the diagnostics are stable.

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
- Do not infer client entries inside `generateStaticSite()`.
- Future manifest integration should be an adapter or shell helper, not a server renderer concern.

### 4. Router Integration Boundary

Router SSR/SSG/hydration integration remains deferred. The next phase should define what must be
true before adding it.

Required design points:

- Do not add public `createMemoryHistory()` yet.
- Do not add nested routes or guards as part of SSR work.
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
