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

## Deferred Boundary

Browser-store publication remains deferred. Store signing, review, production origin policy,
automatic updates, and production component inspection need separate design and release evidence.
