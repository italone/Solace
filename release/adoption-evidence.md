# External Adoption Evidence

Date: 2026-08-17

Target package: `@italone/solace@0.1.0-beta.5`

Both applications below are outside the Solace repository and were validated in disposable
copies. The original application source, manifests, and lockfiles were not modified.

## h5-design

- Application: `h5-note-app` at `/Users/alone/Desktop/TEST/h5-design`
- Temporary copy: `/private/tmp/solace-h5-adoption.vbbPww`
- Install: `npm install --no-audit --no-fund @italone/solace@0.1.0-beta.5`
- Resolution: `npm ls @italone/solace --depth=0` reported `@italone/solace@0.1.0-beta.5`.
- Package runtime import: `node --input-type=module -e "import { h } from '@italone/solace'; ..."` printed `h export ok function`.
- Typecheck and production build: `npm run build` (`tsc -b && vite build`) passed; Vite emitted `dist/index.html` and application chunks.
- Solace integration bundle: a temporary Vite entry importing `h` and `render` built with `npm exec vite -- build --config adoption-vite.config.ts --outDir adoption-dist`; the output contained `Solace beta.5`.
- Runtime: `npm run preview -- --host 127.0.0.1 --port 6187` served the built app; HTTP fetch of `/` passed.
- Result: verified.

## css-world

- Application: `css-world` at `/Users/alone/Desktop/TEST/css-world`
- Temporary copy: `/private/tmp/solace-css-adoption.eQBUVd`
- Install: `pnpm add --save-exact @italone/solace@0.1.0-beta.5`
- Resolution: `pnpm list @italone/solace --depth=0` reported `@italone/solace@0.1.0-beta.5`.
- Package runtime import: `node --input-type=module -e "import { h } from '@italone/solace'; ..."` printed `h export ok function`.
- Typecheck: `pnpm typecheck` passed.
- Production build: `pnpm build` (`tsc -b && vite build`) passed and emitted `dist/index.html` plus the application bundle. Vite reported only its existing large-chunk warning.
- Solace integration bundle: a temporary Vite entry importing `h` and `render` built with `pnpm exec vite build --config adoption-vite.config.ts --outDir adoption-dist`; the output contained `Solace beta.5`.
- Runtime: `pnpm preview --host 127.0.0.1 --port 6188` served the built app; HTTP fetch of `/` passed.
- Result: verified.

## Adoption Status (2026-08-27)

Both applications above remain compatibility-only React/Vite installations. They do not use
Solace as their primary renderer and do not exercise the required production workflows. Running
upgrade or rollback rehearsals against them would not change that classification; recording them
as adoption would fabricate evidence. Independent Solace-primary adoption therefore remains 0/2,
and this document does not claim otherwise.

## Independent Adoption Verification Runbook (prepared 2026-08-27)

This runbook documents exactly what a legitimate independent adoption bundle requires. It was
prepared without producing any adoption evidence: no phase records below have been filled in.

### Prerequisites (all must be true before recording anything)

1. The application genuinely renders through Solace as its primary renderer and exercises all
   five required production workflows: `router`, `store`, `asyncComponents`, `errorRecovery`,
   `ssrHydration`.
2. The application repository is reachable at an HTTPS URL (no credentials in the URL).
3. The application is deployed at an exact HTTPS origin (scheme + host + optional port, path `/`,
   no query or fragment). Localhost preview servers do not qualify.
4. The repository working tree is clean at the recorded commit for every phase.
5. A reviewer has inspected the phase output and will approve by name.
6. Baseline and candidate use two different exact published npm versions of `@italone/solace`
   (for example `0.1.0-beta.5` → `0.1.0-beta.6`); rollback returns to the baseline version.

### Phase record template

One JSON record per phase (`baseline`, `candidate`, `rollback`), validated by
`scripts/adoption-evidence-config.mjs`:

```json
{
  "schemaVersion": 1,
  "phase": "baseline",
  "application": {
    "name": "<unique app name>",
    "independent": true,
    "primaryRenderer": "solace",
    "repository": "https://<host>/<path>",
    "productionOrigin": "https://<host>[:<port>]"
  },
  "repository": { "commit": "<40-char git SHA>", "dirty": false },
  "package": {
    "name": "@italone/solace",
    "version": "0.1.0-beta.5",
    "manager": "npm@<version>",
    "lockfile": "package-lock.json",
    "lockfileSha256": "<sha256 of the lockfile bytes>"
  },
  "workflows": {
    "router": true,
    "store": true,
    "asyncComponents": true,
    "errorRecovery": true,
    "ssrHydration": true
  },
  "commands": [
    {
      "argv": ["npm", "ci"],
      "exitCode": 0,
      "durationMs": 12345,
      "stdoutSha256": "<sha256>",
      "stderrSha256": "<sha256>"
    }
  ],
  "verified": true,
  "reviewer": { "name": "<reviewer>", "approved": true }
}
```

For `candidate` and `rollback`, add `"baselineEvidenceSha256"` at the top level. Its value is
`sha256(JSON.stringify(baselineRecord))` — the digest of the serialized JSON value, not of the
file bytes (no trailing newline). The application identity fields (`name`, `independent`,
`primaryRenderer`, `repository`, `productionOrigin`) must match the baseline exactly across all
three phases.

### Assembly and wiring

1. Record real command output digests: every command must exit 0; capture
   `sha256(stdout)` / `sha256(stderr)` and the wall-clock duration per command.
2. Assemble the bundle (paths must be relative JSON paths inside the repository root):

   ```
   pnpm adoption:evidence -- --record <baseline.json> --record <candidate.json> \
     --record <rollback.json> --output <bundle.json>
   ```

   The CLI re-validates every phase record, checks the version chain (candidate differs from
   baseline; rollback equals baseline), verifies the baseline digest chain, and writes the bundle
   with its `bundleSha256`.

3. Update the application entry in `release/one-zero-readiness.json` to `independent: true`,
   `packageSource: "npm"`, the exact candidate `packageVersion`, `upgrade.verified: true`,
   `rollback.rehearsed: true` with `targetVersion` equal to the baseline version, and point
   `evidenceBundle` at the generated bundle path.
4. Re-run `pnpm release:one-zero:check` and confirm the independent adoption count reflects the
   real applications only.

### Hard blockers observed today

- No application in this record set renders Solace as its primary renderer.
- No HTTPS repository or production origin is available for either external application.
- No reviewer approval workflow has been exercised for adoption phases.

These blockers are external to the Solace repository; this runbook only prepares the path.

## Environment Notes

The first non-escalated npm request was blocked by the sandbox with `ENOTFOUND registry.npmjs.org`.
The same exact installs succeeded with approved network access; this is retained as an environment
fact, not a consumer failure. No credentials, tokens, or private registry settings were used.
