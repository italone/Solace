# DevTools Local Distribution Evidence

Date: 2026-08-17

This record covers the repository's example-grade browser extension output. It does not promote the
extension to a stable ecosystem API or production browser-store artifact.

## Verification

- Command: `pnpm test:e2e:devtools-extension`
- Result: the production extension build completed and Chromium reported `2 passed`.
- Runtime coverage: the panel captured public serialized DevTools events and verified family
  filtering, pause/resume, and clear behavior.
- Script format: generated `bridge.js` and `content-script.js` are classic scripts; extension HTML
  pages and the declared background service worker use their emitted module entry points.
- Artifact privacy: No `.map` files were emitted in the extension distribution.
- Permissions: generated manifest access remains restricted to `http://127.0.0.1:6174/*` and
  `http://localhost:6174/*`, with no storage, tabs, scripting, webRequest, externally connectable,
  OAuth, or custom CSP powers.
- Packaging capability: the repository now provides an origin-scoped ZIP packaging command that
  requires explicit exact HTTPS origins, verifies the generated manifest, and reports SHA-256. It
  also emits a deterministic sidecar binding the ZIP digest, manifest digest, and normalized origins.
  This capability was exercised with a non-production example origin only; no artifact digest or QA
  result is promoted into production release evidence.

## Deferred Boundary

Browser-store publication remains deferred. Store signing, review, production origin policy,
automatic updates, and production component inspection need separate design and release evidence.
No real production origin has been verified, so `distributableManifestVerified` remains false and
`testedOrigins` remains empty in the machine-readable record.

## Production Verification Runbook (2026-08-27 rehearsal)

The full pipeline below was rehearsed end-to-end on 2026-08-27 with the non-production origin
`https://rehearsal.devtools-prep.invalid` (`.invalid` hostnames are rejected by
`scripts/one-zero-readiness-config.mjs`, so rehearsal artifacts cannot satisfy the readiness
check). QA command `pnpm test:e2e:devtools-extension` reported `5 passed`, and origin-scoped
packaging produced a ZIP plus sidecar evidence with SHA-256 digests. When a real HTTPS origin
is available:

1. `pnpm package:devtools-extension -- --origin https://<production-origin> --output <repo-relative>.zip`
   — verify the printed SHA-256 and the sidecar `.evidence.json` (artifactPath, sha256,
   manifestSha256, origins).
2. Load the ZIP in Chromium with a production build of the Solace app served at that origin;
   confirm the panel captures relayed events from it.
3. `pnpm test:e2e:devtools-extension` — must pass against the production artifact build.
4. Update `release/devtools-distribution-evidence.json`: set `verified: true`,
   `distributableManifestVerified: true`, `hostPermissions` to the scoped production origins,
   `testedOrigins: ["https://<production-origin>"]`, `artifactEvidence` from the sidecar, and
   `qa: { command, passed: true, artifactSha256: <zip sha256> }`.
5. `pnpm release:one-zero:check -- --report` — `devtools.production-permissions` should PASS.
