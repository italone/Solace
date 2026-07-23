# Security Policy

Solace is an early alpha frontend runtime. Please report security issues privately instead of
opening a public issue.

## Supported Versions

Only the current `main` branch and the latest published alpha, once publishing is enabled, are in
scope for security review.

## Reporting A Vulnerability

Send a private report to the maintainer with:

- affected version or commit,
- reproduction steps,
- expected impact,
- whether the issue affects runtime code, package output, examples, or documentation.

Do not include exploit details in a public issue before the maintainer has had time to review and
prepare a fix.

## Security Boundaries

- Do not expose raw props, state, DOM nodes, VNodes, action arguments, or user content through
  DevTools payloads.
- Do not add telemetry, network upload, storage persistence, or third-party scripts without an
  explicit design and review.
- Do not publish package artifacts until `pnpm release:readiness -- --publishable` and
  `pnpm release:check` pass after a maintainer-approved publishability change.
