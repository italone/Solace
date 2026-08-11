# Examples

Solace includes Vite examples that exercise the JSX/TSX-first runtime from small state updates to
larger keyed lists, router workflows, and an optional experimental `.solace` helper.

## Basic Counter

Run:

```bash
pnpm dev
```

Location: `examples/basic-counter`

Coverage:

- JSX automatic runtime.
- `reactive` state.
- DOM event patching through `onClick`.
- Reactive re-render after a button click.

The Playwright test `tests/e2e/basic-counter.spec.ts` verifies that the counter starts at `count: 0` and increments to `count: 1`.

## Todo App

Run:

```bash
pnpm dev:todo
```

Location: `examples/todo-app`

Coverage:

- Form submit handling.
- Controlled input updates with `onInput`.
- Keyed list rendering.
- Checkbox state toggles.
- Item deletion.

The Playwright test `tests/e2e/todo-app.spec.ts` verifies add, toggle, and delete flows.

## Large List

Run:

```bash
pnpm dev:large
```

Location: `examples/large-list`

Coverage:

- 10,000 keyed rows.
- Class and text patching.
- A targeted state update from row 1 to row 5000.

The Playwright test `tests/e2e/large-list.spec.ts` verifies the list renders 10,000 rows and updates the selected row marker.

## Router Basic

Run:

```bash
pnpm dev:router
```

Location: `examples/router-basic`

Coverage:

- Beta `RouterView` and `RouterLink` rendering.
- Dynamic route params.
- Query string parsing.
- Nested route rendering.
- Redirects, route guards, lazy route components, and surfaced lazy-load failures.
- Hash history navigation without server rewrite support.

The Playwright test `tests/e2e/router-basic.spec.ts` verifies home, user, redirect, guarded
dashboard, nested settings, lazy report, and not-found navigation.

## Operations Console

Run:

```bash
pnpm dev:operations
```

Location: `examples/operations-console`

Coverage:

- Real-app SPA routes for an overview, searchable incident queue, incident detail, releases,
  redirects, and a not-found view.
- Lazy release activity with automatic retry and an exhausted dependency error state.
- SSR/SSG entries for synchronous and async rendering scenarios.
- A standalone hydration fixture that verifies matching-node reuse, recoverable mismatch handling,
  scoped-style deduplication, and reactive updates.

The cross-browser Playwright workflow exercises desktop and mobile operations, while the SSR/SSG
integration coverage keeps the server entries aligned with the browser fixture. Together they
provide packed validation that the published package can support a production-shaped application
across routing, shared state, async components, server rendering, hydration, and responsive browser
workflows.

## SFC Counter

Run:

```bash
pnpm dev:sfc
```

Location: `examples/sfc-counter`

Coverage:

- Optional experimental `.solace` single-file component parsing.
- `@italone/solace/vite` plugin integration.
- Template expressions, script identifiers, and scoped style injection.

The SFC example is an auxiliary compiler/Vite plugin smoke path. The primary example path remains
JSX/TSX function components.

## Large App Guide

For routing structure, state ownership, SSR boundaries, performance, and release discipline in
larger apps, see [docs/large-app.md](./large-app.md).

## DevTools Panel

The `examples/devtools-extension` panel is example-grade. Before using it in a release note or
demo, follow the browser extension QA checklist in [docs/devtools.md](./devtools.md). The checklist
keeps the workflow on public `DevtoolsEvent` summaries, bounded captures, and stale-port handling
instead of private runtime state.

## E2E Validation

Run all browser examples through Playwright:

```bash
pnpm test:e2e
```

The Playwright config starts each example on a fixed localhost port:

| Example            | Port   |
| ------------------ | ------ |
| Basic counter      | `6174` |
| Todo app           | `6175` |
| Large list         | `6176` |
| Router basic       | `6178` |
| Async Hydration    | `6179` |
| Operations Console | `6180` |

`pnpm release:check` also runs these e2e tests plus the DevTools extension e2e smoke after quality
checks, coverage, package smoke, jsdom benchmark smoke, and the Chromium production browser
benchmark.
