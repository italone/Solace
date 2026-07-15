# App Provide Design

## Context

Solace supports component-level `provide()` / `inject()` and now has a minimal `app.use()` plugin
API. Plugins can install onto an app, but they cannot yet expose values to the mounted component tree
without wrapping the root component. `app.provide()` adds the smallest app-level dependency injection
surface.

## Scope

Add `app.provide(key, value)`:

```ts
createApp(App).provide("theme", "dark").mount(container);
```

Plugins can also provide app-level values:

```ts
const plugin: Plugin = (app) => {
  app.provide("theme", "dark");
};
```

`provide()` returns the same app instance for chaining.

## Runtime Design

- Each app instance owns an app-level `provides` map.
- `createApp().mount()` passes that map into the root render path.
- Root and descendant component instances hold a reference to the same app-level provides map.
- `inject()` lookup order is:
  1. nearest component provider,
  2. ancestor component providers,
  3. app-level provider,
  4. default value.
- Component-level providers continue to override app-level providers.
- Updating an app-level value before mounting replaces the stored value.

## Testing

Use app and component unit tests to prove:

- A root component can inject a value from `app.provide()`.
- A descendant component can inject a value from `app.provide()`.
- A component-level `provide()` overrides app-level `provide()`.
- A plugin can call `app.provide()` and make the value injectable.
- `app.provide()` returns the app for chaining.

Package smoke should compile and mount a packed consumer using `app.use(plugin).provide(...)`.

## Non-Goals

- Reactive app-level provides.
- App-level global properties.
- Global component registration.
- Plugin uninstall.
- DevTools hooks.
