# Ecosystem Direction

This document records the beta-line decisions for UI components, plugin ecosystem scope, and
third-party integration strategy. It is a productization boundary, not a new public API surface.

## Decisions

- No first-party UI component library in the beta line. Solace should keep the framework core,
  router, SSR/hydration, DevTools event contracts, examples, and release gates stable before owning a
  component suite.
- No stable plugin ecosystem in the beta line. `app.use()` remains the app-level installation
  primitive, but Solace should not present a plugin registry, plugin marketplace, or compatibility
  promise for third-party plugins yet.
- Use application-owned adapter components for UI adoption. Large apps can wrap third-party UI
  libraries behind local components and design tokens, then keep feature code dependent on those app
  adapters instead of a vendor package.
- Do not expose third-party UI library types, DOM assumptions, class names, theme tokens, or
  component lifecycles as Solace public contracts.
- Treat DevTools extension panels as diagnostics built on public event contracts. They are not an
  ecosystem plugin API until event payloads and extension boundaries are designed separately.

## Recommended App Pattern

Use a local UI boundary:

```text
features -> app/components -> third-party UI package
```

Feature modules import app-owned components such as `AppButton`, `AppDialog`, or `DataTable`.
Those wrappers own accessibility defaults, styling tokens, vendor prop mapping, and migration work.
This keeps a future UI library decision from leaking through the feature layer.

For plugins, keep integrations small and app-owned:

```ts
import type { App } from "@italone/solace";

export function installFeaturePlugin(app: App): void {
  app.provide("feature-config", { enabled: true });
}
```

Avoid plugin APIs that require private renderer, router, scheduler, or DevTools internals.

## Revisit Triggers

Reconsider a first-party UI package only when all of these are true:

- Two or more real apps share the same accessible component patterns.
- The design token, theming, focus, keyboard, and SSR behavior can be documented as public contract.
- Bundle size and tree-shaking checks exist for component entry points.
- Component tests and browser interaction tests can be included in release gates.

Reconsider a stable plugin ecosystem only when all of these are true:

- The extension points are public package exports, not private module imports.
- Router, SSR/hydration, DevTools, and build-tool hooks have explicit compatibility policies.
- Security boundaries for permissions, redirects, storage, postMessage, and network behavior are
  documented and testable.
- Package smoke tests can validate at least one external-style plugin consumer.

## Near-Term Scope

Keep ecosystem work focused on documentation, examples, and adapters:

- Expand `docs/large-app.md` from real adoption experience.
- Keep third-party UI integration guidance at the app-wrapper level.
- Keep DevTools panels tied to public event contracts.
- Keep release notes honest about the absence of first-party UI components and stable plugins.
