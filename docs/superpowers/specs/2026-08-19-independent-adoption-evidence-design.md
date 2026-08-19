# Independent Adoption Evidence Design

## Goal

Provide a reproducible, repository-independent evidence bundle for two real
Solace-primary npm applications without treating repository fixtures or
React-primary compatibility checks as production adoption.

## Scope and non-goals

The tool records evidence; it does not discover applications, deploy to
production, publish npm packages, change dist-tags, or edit an adopter's source
repository. It must never turn a local fixture, a compatibility-only React
application, or a failed rollback into a passing 1.0 criterion.

## Evidence lifecycle

Each adopter produces three records for one application:

1. `baseline`: the exact currently deployed Solace version and the verified
   production workflow result.
2. `candidate`: the exact npm version under evaluation, with the same workflow
   result and an explicit upgrade from the baseline version.
3. `rollback`: the exact baseline version restored after the candidate run,
   with the same workflow result and a recorded rollback command/result.

The records share an application identity, repository URL, commit SHA,
production origin, and evidence schema version. The candidate and rollback
records must reference the baseline record by digest. A rollback is valid only
when the package manager resolves the exact baseline version again and all
required workflows pass after restoration.

## Record shape

The collector writes one JSON file per phase under a caller-selected output
directory. Sensitive process environment values and full command output are
excluded. Each record contains:

- `schemaVersion`, `phase`, `application`, `repository`, `commit`, and
  `productionOrigin`;
- exact `package.name`, `package.version`, package manager, and lockfile SHA-256;
- `commands[]` with argv, exit code, duration, and bounded stdout/stderr digest;
- `workflows` for router, store, async components, error recovery, and
  SSR/hydration;
- `baselineEvidenceSha256` for candidate and rollback records;
- `verified` plus a human reviewer reference.

The collector refuses non-HTTPS origins, version ranges, dirty working trees,
missing lockfiles, missing production workflow declarations, and commands that
return non-zero. It writes atomically and uses repository-relative paths only
for evidence references.

## Validation boundary

Pure validation belongs in a small config module and is unit tested with valid
and invalid records. The existing 1.0 evaluator consumes only records that
match its exact version, workflow, path, identity, and rollback requirements.
The collector itself may generate a complete local bundle for a fixture, but
the evaluator still requires an independently owned application marker and
production evidence review before counting it.

## Security and operational constraints

- Never read, print, persist, or upload tokens, cookies, or arbitrary
  environment variables.
- Run commands with an explicit allowlist and the adopter repository as cwd.
- Do not mutate production systems or package tags.
- Keep logs bounded; store SHA-256 digests rather than full output.
- Preserve failed records for diagnosis, but mark them `verified: false`.

## Verification

Unit tests cover argument parsing, exact-version/origin checks, phase identity,
lockfile and command result binding, digest binding, atomic output, and failed
rollback handling. An integration smoke uses a disposable local adopter and
proves that baseline, candidate, and rollback records are generated without
changing the checked-in Solace release evidence. The 1.0 gate remains
`INCOMPLETE` until two separately owned production applications supply reviewed
bundles.
