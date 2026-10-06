# Browser voice error-history privacy

October 5, 2026, checkpoint 133, based on `69dff70`. Partial L2 review, not
live-voice, accessibility or public-deployment acceptance.

## Finding and correction

The browser error handler previously combined raw browser/provider error messages
with unrestricted extra fields (including IDs, ICE addresses/URLs and arbitrary
text), persisted the last 30 records under `gev-realtime-errors`, and reloaded them
at controller creation. Those raw records also reached console output and
diagnostic reports. Limiting the number of records did not limit their contents.

Error records now contain only a generated timestamp, a fixed source label, a
known error category with fixed guidance, and allowlisted connection/ICE/data-channel
states. Unknown categories use generic recovery guidance. Raw messages, stacks,
URLs, addresses, event/response IDs, transcripts and arbitrary extras are not copied
or serialized. Recognized microphone permission/device and provider configuration,
quota/rate/context errors still produce useful instructions; new provider codes
fall back to generic guidance instead of exposing provider text.

The controller keeps at most **30 immutable records in memory**. The same safe
record is used for its error display, console call and optional diagnostic event.
Diagnostic reports receive independent flat copies, so a report consumer cannot
mutate the stored record. Server diagnostic logging remains default-off under
checkpoint 132 and still records only event/status metadata when explicitly enabled.

## Retention and preserved data

The error history lasts for the controller/page lifetime, not just one microphone
session. Stop/reconnect does not erase recent troubleshooting metadata; a new
controller or page reload starts empty. There is no new persistent error-history
key and no browser-storage dependency for error reporting.

The old `gev-realtime-errors` entry is neither read, overwritten, migrated nor
deleted. It may still contain private content accessible to the browser owner or
same-origin code. Reviewing/removing legacy data needs a separate user decision.
Voice tier/cost preferences and AstroEye records are unaffected; this change is
not a ban on all application localStorage use. No existing browser data was opened
or deleted during implementation or testing.

This is not a blanket privacy guarantee for every console message, browser error,
provider transmission or other subsystem. Access/origin controls, remaining voice
response bounds and provider/data/asset rights remain separate L2 work. Live
microphone/provider testing still requires separate approval.

## Verification

```text
node --test --test-concurrency=1 src/voice/voiceErrorRecord.test.mjs src/voice/voiceDiagnostics.test.mjs src/voice/gevRealtime.test.mjs src/voice/astroeyeAcceptance.test.mjs
npm run build
```

Five new tests cover allowlist/privacy boundaries, unknown/hostile values,
actionable known categories, ignoring raw message/extra getters, and the real
controller's 30-entry history across report/console/display/diagnostic surfaces.
The controller test uses synthetic localStorage and verifies no legacy-history
read/write/delete, report isolation, and empty history on a new controller.
All 159 focused tests pass, zero failures/skips/cancellations, 67.502s. This run
includes the existing voice lifecycle, command-envelope and diagnostic-file
regressions; it is not the full repository suite. The finish-line tracker records
the production-build result. Browser/allocation suites were not rerun.

No live API calls, microphone operation, key changes, real user-record reads,
push, hosted CI, deployment or tag. L1/hosted CI acceptance remains scoped to
`eb1a716`; later local changes require updated candidate verification.

Six release gates accepted, nine open. Next bounded security review: voice
upstream resource limits and access/origin policy. Actual-host checks and rights
decisions remain open, not replaced by these offline tests.
