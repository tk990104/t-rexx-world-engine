# AstroEye release CI foundation

October 5, 2026, checkpoint 126, based on `5cb2614`. App runtime remains `7368c55`.

The previously missing `.github/workflows/astroeye-ci.yml` now defines candidate
checks for pull requests, pushes to main, and manual dispatch. This turn only
created local files: no push, workflow dispatch, GitHub execution, deployment,
release tag, branch-protection setting or publication occurred.

## Contract

- Separate Ubuntu 24.04 and Windows 2025 jobs, run sequentially to limit concurrency.
- Exact Node `24.21.0`, matching the locally observed runtime and the existing
  runner's Node-24 allocation calibration. This is a CI pin, not a change to the
  supported package engine range.
- Candidate SHA, Node and npm versions printed before `npm ci --no-audit --no-fund`.
  Lockfile installation, CI-contract tests, complete `npm test` (including both
  serialized allocation files), then `npm run build`. Failures are not ignored.
- `GEV_REQUIRE_ALLOCATION_GATE=1` prevents silent calibration skips. Puppeteer's
  browser download is disabled for this unit/build job; browser acceptance is a
  separate requirement, not silently skipped evidence.
- Read-only repository permissions, checkout credentials not persisted, no
  deployment steps or application secrets, no dependency cache. Action revisions
  are pinned to full commit SHAs resolved from the official v6 tags on this date.
- Twenty-minute job cap, five-minute install, one-minute contract check,
  eight-minute full test and five-minute build caps. New runs cancel older runs
  for the same workflow/ref. These are failure bounds, not performance guarantees.

The configuration was checked against official
[GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax),
[checkout inputs](https://github.com/actions/checkout/blob/d23441a48e516b6c34aea4fa41551a30e30af803/action.yml),
and [Node setup inputs](https://github.com/actions/setup-node/blob/249970729cb0ef3589644e2896645e5dc5ba9c38/action.yml).
Initial read-only Git lookups failed local OpenSSL certificate validation; retry
with the Windows certificate backend succeeded. TLS verification was not disabled
and no global Git configuration changed.

## Local verification and limits

`node --test scripts/qa-astroeye-ci.test.mjs src/unitTestRunner.test.mjs` passed all
seven tests (zero failures/skips/cancellations; final reported duration 0.310s).
The new tests parse the YAML with the existing locked js-yaml development tree and
check triggers, least privileges, action pins, runtime/matrix, command order,
allocation enforcement and bounded execution. CI runs this test explicitly because
the ordinary unit runner discovers only files under `src`. Diff whitespace checks
pass. No dependencies, lockfile, production modules or user records were changed.

This is not a GitHub runner execution or a fresh dependency installation. The
existing installed dependency tree supplied the local parser/tests. Full unit and
build results were not regenerated for a workflow-only change; no green remote CI
status is claimed. Hosted OS images and registries can change despite pinned Node,
actions and the lockfile; record actual runner/tool versions when CI executes.

L1 remains open until a candidate's clean-install, full-suite, build and relevant
browser evidence are recorded. Next: obtain authorization to push/run CI when the
candidate is ready, inspect both OS results, and resolve any real failures without
weakening tests. No package-security or dependency-license approval is implied by
`--no-audit`; the separate L2 review remains mandatory.

## Other outstanding host evidence

Embedded-browser initialization still fails before tab access with the kernel
assets/path error recorded in checkpoint 125. The user answered **I haven't checked
yet** to the note-marker delete/Undo manual check. Preserve that as unverified, not
a pass or a failure. The [short host check](astroeye-map-workspace-validation.md)
remains available. Do not rerun unchanged fixture tests in place of host evidence.

Release tally is unchanged: five accepted, ten open. No new feature scope.
