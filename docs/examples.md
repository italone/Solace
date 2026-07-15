# Examples

Solace includes three Vite examples that exercise the runtime from small state updates to larger keyed lists.

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

`pnpm release:check` also runs these e2e tests after quality checks, including format check, coverage, package smoke, and benchmark smoke checks.
