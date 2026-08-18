# Release

Solace uses Changesets for version notes and package version updates.

Release readiness and publishing are separate states. The repository can contain a prepared local
version, documentation updates, or changelog entries that have not been pushed to GitHub or
published to npm. Use [project-status.md](./project-status.md) to record that boundary when
publishing is intentionally skipped.

## Local Release Gate

Run the full local gate before preparing a release:

```bash
pnpm release:check
```

This runs release readiness, format check, typecheck, JSX dev typecheck, lint, default tests,
package exports tests, coverage thresholds, package consumer smoke, independent adoption smoke,
stable application smoke
(`pnpm stable:app`), jsdom benchmark smoke, Chromium production browser benchmark, browser e2e tests,
performance regression budgets, and DevTools extension e2e smoke. The package consumer smoke includes packed ESM/CJS import checks,
TypeScript consumer checks, router public API checks, and a Vite production build that transforms a
`.solace` single-file component through the packed `@italone/solace/vite` plugin.

For public API changes, `pnpm release:readiness`, `pnpm package:smoke`, `pnpm test:e2e`, and
`pnpm test:e2e:devtools-extension` are mandatory gates. `pnpm release:check` includes them so
release preparation, package-boundary drift, and browser extension drift are checked together. Treat
`pnpm adoption:smoke` as a mandatory gate. Treat `pnpm stable:app` as a mandatory gate as well.

`pnpm adoption:smoke` installs the packed candidate into a temporary consumer with no source alias,
then typechecks and builds CSR plus SSR/hydration entries. Run `pnpm adoption:smoke:browsers` when
recording candidate evidence for Chromium, Firefox, and WebKit. Use
`pnpm adoption:smoke -- --package <exact-version>` for a registry-backed comparison; install/network
failures are separate from consumer contract failures.

The GitHub Actions CI workflow runs the quality job on both Node 20 and Node 22. It keeps the checks
split into named steps and runs `pnpm release:readiness` before the longer checks so package metadata
and release script drift fail early. CI also runs `pnpm release:contract:check` and emits the
non-blocking-style diagnostic report from `pnpm release:one-zero:check -- --report`; the report is
expected to be incomplete during the beta line.

After both quality matrix jobs pass, the Node 22 browser job runs ordinary application e2e on
Chromium, Firefox, and WebKit. The production browser benchmark and DevTools extension e2e smoke
remain Chromium-only. Together, CI runs `pnpm benchmark`, `pnpm benchmark:browser`, `pnpm test:e2e`,
and `pnpm test:e2e:devtools-extension` without implying cross-browser support for the extension.

## Stable Compatibility Checklist

Before treating a stable upgrade candidate as ready, run `pnpm release:candidate:check`. It first
verifies publishable Git/metadata readiness, runs `pnpm stable:app:upgrade` against the exact
long-term `@italone/solace@0.1.0-beta.2` and previous published `@italone/solace@0.1.0-beta.4`
baselines, and then runs `pnpm release:check`. This network-backed
candidate command remains separate from routine pull-request CI and is not a substitute for the
maintainer's release decision. Keep types, docs, changelog, and tests together for every public
compatibility change. Confirm that protected export paths remain available, and apply the
[compatibility and deprecation policy](./compatibility.md) before announcing a removal or signature
change. A severe security/correctness exception requires prominent risk and migration guidance.

## Post-Publish Registry Verification

After npm reports the published version, validate the exact registry artifact with:

```bash
pnpm registry:smoke -- <version-or-dist-tag>
```

Prefer the exact published version in release evidence. A dist-tag such as `beta` or `latest` is
accepted for a manual current-line audit, and the command reports the resolved package version. This
is an explicit network-backed audit and is not part of routine pull-request CI. It does not replace the local candidate gates:
use `pnpm package:smoke` for the local tarball and
`pnpm stable:app:upgrade` for the pinned real-application compatibility comparison.

The registry smoke installs only `@italone/solace` with lifecycle scripts disabled, verifies all
eight protected public entries, checks one server-rendered paragraph, and confirms a private
`dist/**` deep path remains blocked. Install-stage DNS, authentication, timeout, and package-not-found
errors must be reported separately from package contract failures.

## Async Rendering Compatibility

`renderToStringAsync()`, `generateStaticSiteAsync()`, and `hydrateAsync()` are additive documented public entries.
They are separate entries, while existing synchronous APIs retain their return types and reject
unresolved async values, so this beta.4 slice does not silently widen synchronous call sites to
promises.

Release notes must describe these APIs as buffered async initial rendering, sequential async SSG,
and prepare-then-commit async hydration. They must not imply streaming SSR, router-aware
SSR/hydration, Suspense/selective hydration, or async update scheduling after initial hydration.
Changing or removing any documented async entry requires the compatibility and deprecation policy
that must be finalized before `0.1` stable; a beta release must not remove one without an explicit
migration path.

## Release Readiness

Run the local metadata readiness check before publishing:

```bash
pnpm release:readiness
```

This command checks local package metadata, package entry points, release scripts, and Changesets public access configuration. It does not contact npm and does not publish.

The package is configured for public npm publishing. Verify the stricter publishable mode before
each release:

```bash
pnpm release:readiness -- --publishable
```

Publishable mode also checks the local Git state. It fails when the branch is ahead of or behind
its upstream, when no upstream is configured, or when the working tree is dirty. Use
`pnpm release:readiness -- --publishable --skip-git-check` only for metadata-only audits where a
maintainer has explicitly decided not to publish from the current checkout.

## Performance Claims

Use `pnpm benchmark:history` before writing release notes or README copy that mentions
performance. When a claim references browser behavior, require at least five latest browser
records per scenario. When it also references runtime internals or smoke benchmark history, require
both browser and jsdom minimum counts. Keep the command, sample window, and scenario names together
with the claim. Browser latest-window summaries use `metadata.runAt` when it is present, so merged
history files do not have to rely on JSONL file order. Keep `.benchmark-history/` ignored and copy
only summarized results into release notes; local JSONL history must not be committed or packed.

Generate the auditable 1.0 summary with:

```bash
pnpm benchmark:history:evidence -- --output release/performance-history.json
```

The admission gate requires five distinct `runAt` timestamps for every browser scenario and jsdom
task. Repeated task samples under one timestamp count as one run, and metadata-only jsdom records do
not count toward task history. The checked-in summary records source SHA-256 digests, first/last
timestamps, and distinct date counts while the raw `.benchmark-history/*.jsonl` files remain ignored.

`release/performance-budgets.json` adds the regression gate used by `pnpm performance:regression`.
For beta release checks, it requires every checked-in scenario to have at least five distinct runs
backed by at least two distinct calendar dates, then compares the latest successful browser and jsdom
metrics with explicit millisecond budgets. Missing history, malformed budgets, or an over-budget
metric fails the command with a scenario-specific message. The separate 1.0 admission checklist
still requires five distinct dates for every browser scenario and jsdom task.

## DevTools Extension Notes

Before release notes or demos mention the browser DevTools extension example, run the browser
extension QA checklist in `docs/devtools.md`. Release notes must review and narrow extension permissions.
Narrow the permissions before producing a production browser-store package or a demo with fixed
inspected origins. The note should describe the panel as an example-grade timeline inspector that
consumes public `DevtoolsEvent` summaries. Do not describe it as a
production browser-store distribution, persisted capture workflow, telemetry workflow, component
tree inspector, dependency graph, flame chart, or SSR/SSG/hydration inspector.

## 1.0 Admission Report

The beta evidence file is `release/one-zero-readiness.json`. Inspect every current criterion without
failing the documentation workflow:

```bash
pnpm release:one-zero:check -- --report
```

Run `pnpm release:one-zero:check` without `--report` as the actual admission gate; it exits nonzero
until all criteria pass. The evidence checklist requires two independent Solace-primary npm
applications with Router, Store, async components, error recovery, SSR/hydration, upgrade, and
rollback evidence; successful compatibility baselines; five distinct runs on five dates for every
browser scenario and jsdom task; distributable DevTools evidence with tested origins; stable public
contract admission; and documented migration procedures. Repository fixtures and React/Vite
compatibility installs do not count as independent adoption. `READY` is an evidence state, not a
maintainer decision to publish 1.0.

The loader verifies the machine-readable `release/adoption-evidence.json`,
`release/devtools-distribution-evidence.json`, and `release/public-contract.json` records before
evaluating their claims. It also compares the DevTools record with the checked-in extension manifest.
The accompanying Markdown evidence remains review material, not a substitute for those records.

The structured procedure evidence points to the
[migration and rollback runbook](./migration.md) and the synchronized
[迁移与回滚手册](./migration.zh-CN.md). These documents make the policy reviewable, but they do not
claim a live npm rollback rehearsal or authorize publication, dist-tag changes, pushes, or tags.

## Prepare A Version

For ordinary stable version changes, create and apply a changeset:

```bash
pnpm changeset
```

Apply pending changesets to `package.json` and changelog files:

```bash
pnpm release:version
```

For an explicitly selected beta prerelease number such as `0.1.0-beta.5`, first confirm whether
`.changeset/pre.json` exists. Without active Changesets prerelease state, follow the established
repository beta workflow: set the exact package version and add the matching top-level CHANGELOG
entry directly. Do not run `pnpm release:version` when it would replace the approved prerelease
number with a stable semver increment.

## Publish

Before publishing, explicitly confirm:

- the npm package name `@italone/solace` is available or controlled by the maintainer,
- npm authentication and organization access are configured,
- public access is intended,
- `pnpm release:candidate:check` passes,
- `pnpm release:readiness -- --publishable` confirms the final synchronized Git state,
- the local branch is synchronized with its upstream and the worktree is clean,
- `pnpm release:check` passes,
- `pnpm package:smoke` passes after the final version update,
- the package version and CHANGELOG follow either the active Changesets prerelease state or the
  explicit prerelease workflow documented above.

For beta prereleases, publish with the `beta` npm dist-tag so `latest` continues to point at the
latest stable public release:

```bash
pnpm release:publish:beta
```

After a maintainer decides the current version should become the default npm release, run:

```bash
pnpm release:publish
```

`release:publish:beta` runs the full local release gate and publishes with `--tag beta`.
`release:publish` additionally requires the strict 1.0 evidence checklist and public contract gate
before the full local release gate, then uses Changesets' default npm tag behavior.

If publishing is skipped, do not run `release:publish:beta`, `release:publish`, `changeset publish`,
or `npm publish`. Leave the local version state documented in `docs/project-status.md` until a
maintainer makes a separate release decision.
