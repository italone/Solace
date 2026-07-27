# Solace Roadmap

## Current Phase: Alpha (completed)

The alpha runtime is feature-complete for its declared scope:

- Reactive core, scheduler, renderer, components, events, store, JSX runtime, DevTools API, examples, and release gates.
- All tests passing, coverage above thresholds, package exports validated.

## Next Phase: Beta

Planned work, in rough priority order:

1. **SFC compiler stabilization** — harden the current `.solace` compiler and `@italone/solace/vite` plugin with public docs, API review, source maps, diagnostics, and compatibility tests.
2. **First-party router stabilization** — promote the current alpha router core only after public exports, package boundary tests, documentation, and app-level integration coverage are complete.
3. **SSR / SSG / hydration** — add server-side rendering, static generation, and client hydration capabilities.
4. **Browser DevTools extension UI** — build a panel on top of the existing `@italone/solace/devtools` API.
5. **Production adoption guidance** — large-app patterns, performance tuning, migration notes.

## Out of Scope (for now)

- First-party UI component library.
- Stable plugin ecosystem.
- Long-term compatibility policy for internal modules.

## How to Propose Changes

Open an issue or discussion on the project repository with the problem, proposed API, and affected public surface.
