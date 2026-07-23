# Package Usage

## Install

The repository is currently kept private through `package.json` with `"private": true`. Registry
install is valid only after a maintainer explicitly approves public publishing, removes or changes
that private flag, and completes the release readiness checks:

```bash
pnpm add @italone/solace
```

Before that release decision, run `pnpm release:readiness` to check local release metadata and
validate package consumption with the packed-consumer smoke test described below. After the private
flag is intentionally changed for release, run `pnpm release:readiness -- --publishable`.

## Import Runtime APIs

```ts
import { createApp, h, reactive } from "@italone/solace";

const state = reactive({ count: 0 });

const App = () =>
  h(
    "button",
    {
      onClick: () => {
        state.count += 1;
      },
    },
    `count: ${state.count}`,
  );

createApp(App).mount(document.querySelector("#app") as Element);
```

## Use JSX

Configure TypeScript with the Solace JSX runtime:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@italone/solace"
  }
}
```

Then write components with JSX:

```tsx
import { createApp, reactive } from "@italone/solace";

const state = reactive({ count: 0 });

const App = () => (
  <button
    onClick={() => {
      state.count += 1;
    }}
  >
    count: {state.count}
  </button>
);

createApp(App).mount(document.querySelector("#app") as Element);
```

## Public Entry Points

- `@italone/solace`: core runtime APIs.
- `@italone/solace/jsx-runtime`: TypeScript automatic JSX runtime.
- `@italone/solace/jsx-dev-runtime`: development JSX runtime used by Vite.
- `@italone/solace/devtools`: low-level DevTools listener and recorder APIs.

Do not import from `src/**`, `dist/**`, or internal runtime modules directly. Those paths are implementation details and are not part of the package compatibility contract.

## Verify A Packed Consumer

Before release, run the package consumer smoke test:

```bash
pnpm package:smoke
```

The smoke test builds Solace, packs the current package, installs the tarball into a temporary consumer project, typechecks a JSX entry file, and verifies ESM and CJS imports for all public entry points.

For the full local release gate, run:

```bash
pnpm release:check
```

That command runs quality checks including format check, coverage thresholds, package consumer smoke, jsdom benchmark smoke, Chromium production browser benchmark, and browser e2e tests.

See `docs/release.md` for versioning and publish steps.

See `docs/examples.md` for runnable Vite examples and their e2e coverage.
