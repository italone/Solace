# Async SSR And Hydration Boundary Design

## Status

Approved direction for the beta.4 vertical slice. This document defines the public and internal
boundaries only. Runtime implementation, version changes, publishing, router integration, and
production DevTools distribution require separate execution work.

## Decision

Beta.4 should implement one vertical capability: explicit async SSR, async in-memory SSG, and async
initial hydration. It should add asynchronous entry points while preserving the existing synchronous
entry points and their current return types, validation order, and deferred-boundary errors.

The selected direction is additive:

- Add `renderToStringAsync()` beside `renderToString()`.
- Add `generateStaticSiteAsync()` beside `generateStaticSite()`.
- Add `app.hydrateAsync()` beside `app.hydrate()`.
- Resolve the complete initial async tree before hydration claims or mutates server DOM.
- Return to the existing synchronous renderer, scheduler, and patch path after hydration commits.

Do not change an existing API to return `T | Promise<T>`. A caller should be able to determine from
the function name whether awaiting is required.

## Why This Slice

| Candidate                                     | Public value                                                           | API blast radius                                                                                                 | Test and delivery cost                                          | Deferred-boundary risk                                                                  |
| --------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Additive async SSR/hydration                  | High: unlocks async server data/component trees and matching hydration | Medium: three explicit APIs plus async source types                                                              | Medium: resolver, failure cleanup, package and browser coverage | Controlled when streaming and async updates remain excluded                             |
| Production DevTools distribution              | Medium until the inspector contract grows beyond the example timeline  | High: extension packaging, permissions, transport compatibility, store workflow, signing, and release operations | High: browser-specific automation and manual store validation   | High because distribution promises would outpace the current inspector surface          |
| Convert existing APIs to conditional promises | Medium                                                                 | Very high: every existing consumer must branch or await                                                          | High: all sync contracts and examples change                    | Unacceptable before `0.1` because it weakens rather than stabilizes the public contract |

Async SSR/hydration is the better beta.4 slice because it extends the existing minimum loop without
creating a second release product. Production DevTools distribution remains deferred until its
permissions, packaging, compatibility, and inspector contracts have a separate design.

## Current Baseline

- `renderToString()` synchronously serializes VNodes and components and collects styles.
- `generateStaticSite()` synchronously renders explicit routes in memory.
- `createApp(source).hydrate()` synchronously claims matching DOM, supports explicit mismatch
  recovery, and cleans up failed root hydration effects.
- Synchronous APIs reject direct thenables, async component setup results, and async child values.
- SSR, SSG, hydration, and SSG route option objects reject unknown own fields.
- Streaming, router-aware SSR/hydration, and hydration manifest integration have dedicated deferred
  errors whose priority must not change.
- `defineAsyncComponent()` is currently a client-side loading wrapper. Async server resolution must
  integrate with it without server-rendering transient loading UI.

## Goals

- Render an initial tree containing async roots, async component setup results, async child values,
  and `defineAsyncComponent()` loaders.
- Produce the same resolved initial tree for SSR and hydration when given equivalent inputs.
- Preserve app-level and component-level provides established before the first async suspension.
- Keep style collection and style-tag deduplication deterministic.
- Leave server DOM untouched when async preparation or validation fails before hydration commit.
- Keep synchronous consumers source-compatible and behavior-compatible.
- Validate ESM, CJS, declaration, packed-consumer, SSR/hydration integration, and browser behavior.

## Non-Goals

- Streaming SSR or incremental HTML flushing.
- Suspense, fallback boundaries, selective hydration, resumability, or partial hydration.
- Async rerender scheduling after initial hydration.
- Router-aware SSR, SSG, or hydration.
- Data-loader, cache, request-context, or serialization protocols.
- Filesystem SSG output or a deployment adapter.
- Production DevTools packaging or distribution.
- SFC syntax expansion, router auth/permissions, or a first-party UI component library.
- Abort signals, deadlines beyond existing async component timeout options, or cross-request caching.

## Public API

### Async Component And Child Types

Add explicit async types without changing the meaning of the existing synchronous types:

```ts
export type AsyncComponentSetupResult = PromiseLike<ComponentRender | VNode>;

export type AsyncComponentType<Props extends object = ComponentProps> = (
  props: Props,
  context: ComponentSetupContext,
) => AsyncComponentSetupResult;

export type AsyncVNodeChild = PromiseLike<VNodeChild>;
export type AsyncVNodeChildren =
  VNodeChild | AsyncVNodeChild | readonly (VNodeChild | AsyncVNodeChild)[] | null;
```

`h()` may accept an `AsyncComponentType` and `AsyncVNodeChildren` so async trees can be expressed
without casts. That type expansion does not make async trees valid for `render()`, `mount()`,
`renderToString()`, or `hydrate()`: synchronous SSR and hydration entry points retain their existing
async-boundary `TypeError` family, while `render()` and `mount()` gain an explicit synchronous
client-render `TypeError` instead of failing later in VNode processing.

An async component is setup-once in this slice:

- Resolving to a synchronous `ComponentRender` installs that render function for later reactive
  updates.
- Resolving directly to a `VNode` creates a fixed initial subtree. It is not rerun asynchronously
  during later reactive updates.
- Async child values are also one-shot initial values.

Applications that need reactive behavior after hydration should resolve async setup to a synchronous
render function.

### Async SSR

Export from `@italone/solace/server`:

```ts
export type RenderToStringAsyncSource =
  | RenderToStringSource
  | AsyncComponentType
  | PromiseLike<RenderToStringSource | AsyncComponentType>;

export function renderToStringAsync(
  source: RenderToStringAsyncSource,
  options?: RenderToStringOptions,
): Promise<RenderToStringResult>;
```

The options remain exactly `context` and `provides`. Existing manifest, client entry, router, and
streaming fields remain deferred, and unknown own fields continue to throw field-specific
`TypeError` messages before source evaluation.

`renderToStringAsync()` awaits the complete tree and returns one buffered result. It does not expose
chunks, callbacks, streams, or partial styles.

### Async SSG

Export from `@italone/solace/server`:

```ts
export interface AsyncStaticRoute extends Omit<StaticRoute, "source"> {
  source: RenderToStringAsyncSource;
}

export interface GenerateStaticSiteAsyncOptions extends Omit<GenerateStaticSiteOptions, "routes"> {
  routes: readonly AsyncStaticRoute[];
}

export function generateStaticSiteAsync(
  options: GenerateStaticSiteAsyncOptions,
): Promise<GenerateStaticSiteResult>;
```

Routes are prepared and rendered sequentially in input order. Sequential execution keeps route
side effects, style ordering, failure selection, and output ordering deterministic. The function
rejects on the first failing route and returns no partial result.

The existing synchronous `shell` remains synchronous. Async shell composition and filesystem output
are separate concerns and remain excluded.

### Async Hydration

Add to the root-package `App` contract:

```ts
export interface App {
  mount(container: Element): void;
  hydrate(container: Element, options?: HydrationOptions): void;
  hydrateAsync(container: Element, options?: HydrationOptions): Promise<void>;
  provide<T>(key: ProvideKey, value: T): App;
  use(plugin: Plugin, ...options: unknown[]): App;
}
```

`createApp()` accepts a synchronous root, an `AsyncComponentType`, or a VNode containing async
children. `mount()` and `hydrate()` retain synchronous behavior and reject unresolved async values.
`hydrateAsync()` is the only app entry in this slice that may await the initial tree.

No separate top-level `hydrateAsync()` export is required. Keeping hydration on `App` preserves
plugin installation and app-level provides without exposing the internal `Provides` map.

## Internal Architecture

### 1. Async Preparation

Create an internal async-tree preparation layer shared by server rendering and hydration. It should
walk sources, VNodes, fragments, elements, components, slots, and child arrays and produce a private
prepared graph.

Each prepared component record contains:

- The original component VNode.
- Its component instance and parent relationship.
- Its resolved synchronous render function or fixed resolved subtree.
- Its resolved child graph.
- Its app/component provide chain.
- Styles registered during supported synchronous setup/render phases.

Preparation may create component instances and evaluate setup, but it must not create DOM nodes,
attach event listeners, start reactive effects, emit mounted/updated/unmounted lifecycle events, or
write to a hydration container.

### 2. Async Context Boundary

Current component context is synchronous and process-global. Holding it across an `await` would leak
instances between concurrent SSR calls and is not acceptable.

For beta.4, `provide()`, `inject()`, lifecycle registration, `useStyle()`, and other ambient
instance APIs are supported during the synchronous portion before the async component first returns
its thenable, and in the resolved synchronous render function. They are not available from the
continuation after an `await`. Public docs must state this boundary.

The resolver must clear the active component instance and style sink before awaiting. Concurrent
`renderToStringAsync()` calls must not share component instances, provides, or style sinks.

Supporting ambient component context after `await` requires a separate cross-runtime async-context
design and is not part of this slice.

### 3. `defineAsyncComponent()` Integration

Attach private loader metadata to wrappers produced by `defineAsyncComponent()`. The async resolver
uses that metadata to load the real synchronous component before rendering or hydration.

- Loading components are client-transition UI and are not serialized by async SSR.
- Loader timeout, retry count, and retry delay retain their documented behavior.
- Exhausted loader failures reject the async operation with the original error.
- The resolved component is cached by the existing wrapper instance so hydration and later client
  renders can use the synchronous component path.
- The private metadata symbol is not exported and is not a compatibility entry.

### 4. SSR Serialization

`renderToStringAsync()` validates options before awaiting the source, prepares the graph, and then
serializes it using the same escaping, attribute omission, style collection, fragment, and provides
rules as `renderToString()`.

The synchronous and asynchronous serializers should share element/attribute escaping helpers rather
than duplicate HTML policy. Async support must not weaken unsafe tag or attribute validation.

### 5. Hydration Prepare And Commit

`hydrateAsync()` has two explicit phases:

1. **Prepare:** resolve and validate the complete initial graph without reading from or writing to
   the hydration container beyond validating that the container argument is an `Element`.
2. **Commit:** hydrate the prepared graph against existing DOM, attach listeners, install component
   effects, and set the container's current VNode state.

If preparation rejects, the server DOM, event listeners, current VNode marker, and reactive effects
remain unchanged. If commit encounters a `SolaceHydrationError`, existing `{ recover: true }`
semantics apply. Without recovery, all effects installed during the failed commit are stopped before
the error is rethrown.

Hydration commit must use the prepared component results. It must not invoke async setup or loaders
a second time.

### 6. Post-Hydration Updates

After commit, updates run through the existing synchronous scheduler and `patch()` implementation.
The async resolver is not entered during an update.

- Components resolved to synchronous render functions update normally.
- Components resolved to fixed VNodes and async child values retain their prepared values.
- A later synchronous render that produces a new thenable throws the explicit async client-render
  boundary error introduced with this slice; it does not start a hidden asynchronous patch.

## Validation And Error Semantics

Validation order remains contractually observable:

1. Validate the container for hydration or the top-level options object for SSR/SSG.
2. Preserve dedicated deferred errors for manifest, client entry, router, and streaming fields.
3. Reject unknown own fields with the existing field-specific `TypeError` messages.
4. Validate source and route shape.
5. Begin async preparation.

Resolution rules:

- Await generic thenables with `Promise.resolve()` semantics.
- Reject an async component that resolves to anything other than a VNode or synchronous render
  function with a field- or boundary-specific `TypeError`.
- Reject async child values that resolve to unsupported values.
- Propagate loader, setup, child, and source rejections without replacing their original error.
- Do not return partial HTML, styles, pages, or hydration state after a rejection.
- Do not retry arbitrary async setup or child values. Only `defineAsyncComponent()` uses its existing
  retry contract.

## Testing Strategy

### Focused Unit Tests

- Async SSR resolves a promised root, nested async component, async setup-to-render result, fragment,
  and async child value.
- Async SSR preserves escaping, attribute validation, provides, and deterministic style order.
- Two concurrent async SSR calls do not leak provides, instances, or styles.
- Invalid resolved values and rejected thenables preserve the defined errors.
- Existing synchronous SSR and hydration continue to reject async trees.
- Async SSG preserves route order and stops on the first failing route without returning pages.
- `defineAsyncComponent()` timeout and retry behavior is reused without rendering loading UI.
- Async hydration preparation failure leaves DOM and effects untouched.
- Async hydration commit mismatch follows existing throw/recover cleanup behavior.
- Resolved synchronous render functions continue reactive updates after hydration.
- Fixed resolved VNodes and async child values are not asynchronously rerun during updates.

### Integration Tests

- Render an app with nested async data to HTML, hydrate the equivalent client app, click an attached
  event handler, and verify the existing DOM node is reused and updates synchronously.
- Verify app-level provides and a component provide established before suspension are visible to
  resolved descendants.
- Verify styles collected by async SSR are deduped during async hydration.
- Verify failed async preparation leaves the complete server HTML byte-for-byte unchanged.

### Public Package Tests

- Type tests cover async sources, `app.hydrateAsync()`, sync API rejection, and deferred fields.
- Package exports expose both async server functions in ESM, CJS, and declarations.
- Packed ESM and CJS consumers render and hydrate an async tree.
- Private resolver and async-component metadata subpaths remain inaccessible.
- English and Chinese API, package usage, README, and project-status docs describe the same boundary.

### Browser Tests

Add one ordinary application E2E scenario that serves pre-rendered async HTML, runs
`hydrateAsync()`, verifies node identity, and confirms interaction after hydration. It runs under
Chromium, Firefox, and WebKit through the ordinary Playwright configuration.

DevTools extension E2E remains Chromium-only and does not gain async SSR/hydration inspector work.

## Compatibility Rules

- Existing synchronous function names, option names, results, and error priority do not change.
- Existing sync callers do not need to add `await`.
- New async APIs are documented public entries under the existing package root and `server` subpath;
  no new package subpath is added.
- Async source type additions are additive, but using those values with sync runtime entry points is
  an explicit runtime error.
- Internal prepared graphs, loader metadata, and resolver helpers are private and may change.
- Removal or signature changes to the new APIs after beta.4 require the documented deprecation
  process defined before `0.1` stable.

## Documentation Changes Required With Implementation

- `docs/api.md` and `docs/api.zh-CN.md`: signatures, setup-once behavior, context-after-await limit,
  and error semantics.
- `docs/package-usage.md`: ESM/CJS async SSR and async hydration examples.
- `readme.md` and `readme.zh-CN.md`: capability summary and explicit non-goals.
- `docs/project-status.md` and `docs/project-status.zh-CN.md`: implementation status and fresh gate
  evidence.
- `docs/release.md`: additive API compatibility and package-consumer requirements.

## Acceptance Criteria

- The three async APIs are additive and always return promises.
- Sync APIs retain their current return types and reject unresolved async values.
- Async SSR supports promised roots, async setup results, nested async components, async children,
  and `defineAsyncComponent()` loaders within the documented setup-once boundary.
- Async SSG renders sequentially in route input order and returns no partial result on failure.
- Async hydration performs no DOM mutation or effect installation before full preparation succeeds.
- Hydration commit reuses server DOM and returns to the existing synchronous update path.
- Concurrent async SSR calls do not leak context or styles.
- Streaming, router integration, async updates, and production DevTools distribution remain deferred.
- Package exports, packed ESM/CJS consumers, three-browser E2E, documentation contracts, coverage
  thresholds, and `pnpm release:check` pass before implementation is described as complete.
