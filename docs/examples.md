# Examples

Solace includes Vite examples that exercise the runtime from small state updates to larger keyed
lists and narrow `.solace` single-file components.

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

## SFC Counter

Run:

```bash
pnpm dev:sfc
```

Location: `examples/sfc-counter`

Coverage:

- Narrow `.solace` single-file component parsing.
- `@italone/solace/vite` plugin integration.
- Template expressions, script identifiers, and scoped style injection.

The SFC example is covered by compiler, Vite plugin, package export, and packed-consumer smoke tests.

## E2E Validation

Run all browser examples through Playwright:

```bash
pnpm test:e2e
```

The Playwright config starts each example on a fixed localhost port:

| Example       | Port   |
| ------------- | ------ |
| Basic counter | `5174` |
| Todo app      | `5175` |
| Large list    | `5176` |
| Router basic  | `5178` |

`pnpm release:check` also runs these e2e tests after quality checks, coverage, package smoke, jsdom benchmark smoke, and the Chromium production browser benchmark.
