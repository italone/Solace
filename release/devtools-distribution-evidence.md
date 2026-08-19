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
