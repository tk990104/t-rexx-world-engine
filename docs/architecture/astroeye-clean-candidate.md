# AstroEye clean Windows candidate verification

October 5, 2026, checkpoint 127. Verified source candidate:
`89468fce32e96e3bdeae55224e707143f71b1630`; application runtime remains `7368c55`.

## Outcome

A committed-source archive was extracted into a new ignored output directory,
with no existing node_modules or .env. A clean locked install, seven CI/runner
contract checks, all 3,413 repository unit/allocation tests, and the production
build passed on Windows x64, Node 24.21.0, npm 11.19.0. No production source,
dependency manifest, lockfile, saved browser records or preview was changed.

| Step | Final result | Observed duration |
| --- | --- | --- |
| npm ci --no-audit --no-fund | Exit 0; 200 packages installed | 17.475s |
| CI YAML/runner contract checks | 7 passed, no failures/skips/cancellations | 0.384s process |
| Complete ordinary set, 238 files | 3,399 passed, no failures/skips/cancellations | 193.553s process |
| Focus allocation file | 1 passed | 3.734s process |
| Overlay allocation file, resumed | 13 passed, no failures/skips/cancellations | 120.716s process |
| Production build | Exit 0; 261 modules | 9.469s process; Vite reports 5.82s |

The seven CI/runner checks overlap three runner tests in the ordinary set; do not
add them to 3,413 as if they were seven additional unique tests. The complete test
file set came from the candidate's own discovery/partition functions. Ordinary
tests used `--test-concurrency=2` to limit local load; the two allocation files used
the unchanged serialized `--expose-gc` invocations. This is equivalent test-set
coverage, not an execution of the GitHub workflow or default-concurrency npm test.

The lockfile SHA-256 was unchanged before/after install and matches the working
checkout: `0229c11940650a1f816fa698cfb3c34d0f620dab9d710c6dbb8c40b33d1311f1`.
Puppeteer downloads were disabled; no browser test, live voice, provider request
or deployment was started. npm cache reuse was allowed: clean installed files do
not imply a cold network cache or an offline install.

## Failed first attempt and recovery

The first verification attempt passed installation, CI checks, ordinary tests and
the focus allocation test, then stopped the owned overlay test process tree at an
overly short 60-second harness limit. Its original test has 180-second per-probe
limits and checkpoint 98 recorded 175.443s for the full overlay file. The harness
was corrected to a bounded five-minute allocation-file limit; no workload, sample
count, memory budget or assertion was changed. This is not a first-attempt pass.

The first resume refused to overwrite the existing log before launching a test.
The helper now gives each retry a separate log and preserves the original report.
Only the interrupted allocation file and not-yet-run build were resumed; passing
install/unit steps were not repeated. The final resume exited 0. The failed stage
remains in the report, rather than being erased by the successful result.

## Evidence and reproduction

`scripts/qa-clean-candidate.mjs` requires an exact committed SHA, exports only that
snapshot, installs only inside it, and records commands, durations, exit codes and
timeouts. It bounds install/build at five minutes, ordinary tests at eight,
allocation files at five, and preliminary operations separately. On Windows a
timeout targets only the owned child PID and its descendants. No reset or cleanup
of the working checkout is performed. The optional named-directory resume is
restricted to a failed overlay step after successful unit/focus allocation checks
on the same candidate and runtime, with an unchanged lockfile.

Run from the repository root:

```text
node scripts/qa-clean-candidate.mjs 89468fce32e96e3bdeae55224e707143f71b1630
```

Local ignored evidence is in `output/clean-candidate-fAE9hO/`: `report.json`,
`report-before-resume.json`, stage logs, original candidate archive, extracted
source and built dist. The disposable snapshot's node_modules was removed after
success; it is reproducible with npm ci. The working checkout's dependencies were
not removed. Syntax and diff checks pass for the diagnostic helper; its successful
Windows run is not cross-platform verification of that helper.

## Retained warnings and remaining L1 work

Installation warns about deprecated sourcemap-codec and install scripts for
esbuild, Puppeteer and sharp not yet covered by npm's allowScripts configuration.
No script approval policy was changed. Build retains node:fs browser-externalization
warnings in the geographic-data modules and the existing large-chunk warning.
This run is not a dependency-security or rights audit; --no-audit does not close L2.

L1's **local clean-install/full-test/build portion is complete for this candidate**.
L1 itself remains open: no hosted Windows/Linux CI execution, actual embedded-host
acceptance, or final consolidated release decision occurred. Existing composed
browser evidence is documented in checkpoints 123–125; do not rerun unchanged
fixtures by default. The user has not yet checked the actual preview note markers.

Five release gates remain accepted and ten open. Next: obtain authorization for
the remote CI run when ready, preserve the pending actual-host check, and address
the remaining accuracy, accessibility/performance, voice and rights decisions.
Nothing was pushed, tagged, published or deployed.
