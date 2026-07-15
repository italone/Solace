# App Use Plugin Design

## Context

`createApp()` currently returns an app object with only `mount(container)`. README still lists plugin
system and DevTools as future candidates. This change adds the smallest plugin installation API so
libraries can integrate with an app instance before mount.

## Scope

Add `app.use(plugin, ...options)`:

```ts
createApp(App).use(plugin, { enabled: true }).mount(container);
```

Supported plugin forms:

```ts
type FunctionPlugin = (app: App, ...options: unknown[]) => void;
type ObjectPlugin = { install(app: App, ...options: unknown[]): void };
```

`use()` returns the same app instance for chaining.

## Runtime Design

- Each app instance keeps a private `installedPlugins` set.
- Function plugins are invoked directly.
- Object plugins call `plugin.install(app, ...options)`.
- Reusing the same plugin on the same app is ignored.
- The same plugin can be installed once per app instance.
- `mount()` behavior stays unchanged.

## Testing

Use app unit tests to prove:

- Function plugins receive the app instance and options.
- Object plugins receive the app instance and options.
- `use()` returns the app for chaining before `mount()`.
- Installing the same plugin twice on one app invokes it once.
- Separate apps install the same plugin independently.

Package smoke should compile a packed consumer that calls `createApp(App).use(plugin).mount(...)`.

## Non-Goals

- Global component registration.
- Global properties or app config.
- App-level provide/inject.
- Plugin uninstall.
- DevTools hooks.
- Warnings for invalid plugin objects.
