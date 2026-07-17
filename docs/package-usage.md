# Package Usage

## Install

The repository currently keeps `"private": true` in `package.json`, so registry install is only valid after the package is made publishable and released:

```bash
pnpm add solace
```

Before that release decision, run `pnpm release:readiness` to check local release metadata and validate package consumption with the packed-consumer smoke test described below.

## Import Runtime APIs

```ts
import { createApp, h, reactive } from "solace";

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
    "jsxImportSource": "solace"
  }
}
```

Then write components with JSX:

```tsx
import { createApp, reactive } from "solace";

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

- `solace`: core runtime APIs.
- `solace/jsx-runtime`: TypeScript automatic JSX runtime.
- `solace/jsx-dev-runtime`: development JSX runtime used by Vite.
- `solace/devtools`: low-level DevTools listener and recorder APIs.

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
