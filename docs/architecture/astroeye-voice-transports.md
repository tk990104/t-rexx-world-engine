# AstroEye voice transports — checkpoint 62

September 14, 2026. Local implementation, not live-provider or release certification.

## What is connected

Both the existing Realtime runner and browser-speech/free-model runner now dispatch
the seven AstroEye names through the installed workspace command registry. The
Realtime token configuration appends the static AstroEye schemas to the unchanged
28 legacy tools. The free-model prompt uses those same static schemas. There is no
second copy of the command argument definitions and no catalog built from records.

Missing storage/registration returns `unavailable`. Unknown `astroeye_` names do not
fall through to legacy handlers. The canonical commands retain exact-title matching,
strict arguments, bounded previews, deadlines, Director/manual-input guards, camera
authority and non-persisting selection. No save/delete/import/export tools were added.

On the free/browser-speech path these exact phrases require no AI-model request:

- Open AstroEye / close AstroEye.
- Fly to AstroEye venue.
- Enable AstroEye sky / disable AstroEye sky.
- Reset AstroEye time.

Other phrasings and exact-title selection use the configured model. These phrases
are not a claim that speech recognition itself is offline. Manual controls remain
available without a microphone or provider configuration.

## Cancellation and confirmations

Realtime passes its existing per-tool AbortSignal into canonical execution.
Free voice now aborts its active turn on replacement input, Stop and conversation
reset; fetch receives cancellation as well as its existing 20-second timeout.
The agent checks ownership after model/command waits and between steps, so late
responses cannot execute or speak after cancellation. Old speech-recognition
callbacks cannot revive stopped/replaced sessions. Already committed effects are
not rolled back, and legacy handlers still have their own cancellation limits.

AstroEye steps do not speak the model's proposed success message before execution.
Final-step batches use a fixed success/refusal message. Multi-round observations
retain fixed failure codes and the permitted calculation summary. Realtime's
follow-up explicitly treats a refusal, timeout or cancellation as not successful.
Model compliance still needs live acceptance testing; prompt instructions are not
a substitute for the command validators.

## Information boundaries

The microphone button tooltip describes these boundaries before use:

- Realtime sends audio and conversation/tool traffic to OpenAI and may incur charges.
- Browser speech recognition may use its browser vendor's remote speech service.
  Free-model interpretation sends transcript/history to the configured OpenRouter
  route/provider, along with its existing camera/layer context.
- AstroEye adds static schemas, fixed status codes, and (on explicit summary)
  calculation time/version/conventions and a caution. It does not attach saved
  collections, candidate titles, notebooks, IDs or venue coordinates to results.
- A title spoken by the user is already part of the transcript. Existing voice
  diagnostic logging can record transcripts, tool arguments and results. Existing
  map tools can share map context; this change does not claim global voice privacy.
- Event/provider/note text is data, not instructions. The prompt prohibits guessing
  private titles or using another tool to bypass an AstroEye refusal.

No new credentials, live API requests, microphone access, user-record reads,
publication or changes to calculation algorithms were used for this checkpoint.

## Verification and remaining work

Initial focused offline run: 204 tests passed, including seven new tests for static schema
parity, unavailable/forbidden commands, strict canonical dispatch, minimal results,
free-agent cancellation/reset/refusal, simulated Realtime output/Stop, and free-voice
direct-command cancellation with a synthetic viewer. The first run exposed an
incomplete test-viewer fixture; it was corrected and the suite passed on rerun.

Two additional tests cover old recognition callbacks and malformed arguments.
Malformed JSON, missing/null/primitive/array arguments are not coerced into an
empty valid AstroEye command by either transport. A delayed Realtime command also
cannot restore the Listening label or send its result into a replacement channel.

Final verification: all 781 combined voice/platform/radio-schema tests passed
(61.95 seconds), with no failures, skips or TODOs. Production build passed with
248 modules in 41.56 seconds. Existing node:fs externalization and large-chunk
warnings remain. The first sandboxed build failed config-directory access; a
permission-enabled build succeeded. A silent scan found no configured OpenAI key
in generated frontend files; `.env` remains ignored and untracked. No browser-host
or live microphone check was performed in this checkpoint.

Final wider regression/build results are recorded in CURRENT-STATE.md.
V1 acceptance review and V2/V3 acceptance remain open: embedded-host UI checks,
additional provider/microphone failure coverage, and an explicitly authorized,
cost-disclosed live session are still required. A1/A2 calculation release blockers
remain mandatory; this transport wiring does not change A3's numerical candidate.

## Checkpoint 63 — simulated browser failures

September 14, 2026. The isolated `qa-astroeye-commands.mjs` harness now exercises
both voice paths alongside the real rendered workspace/controller and synthetic
IndexedDB records. It does not load the application bootstrap or use the user's
preview profile. Speech recognition, synthesis, token/chat responses and microphone
access are mocked; external/API network requests are blocked by interception.

Verified in Chrome 145.0.7632.77:

- Exact free-voice commands still open AstroEye without an AI-model request.
- Missing free-model configuration reports its limitation; a simulated HTTP 429
  leaves the selection unchanged and returns the state observer to idle.
- The free-model request does not include the synthetic saved venue or record ID.
- Realtime's missing-token case shows VOICE UNAVAILABLE before microphone access.
  A simulated NotAllowedError displays its detail and leaves no active stream.
- The microphone button carries the data-sharing disclosure.
- Manual time reset still works after the voice failures; durable synthetic records
  remain byte-identical. Existing seven-command, camera, sky and cancellation checks
  continue to pass.

Fixed a permanent-error retry loop in browser speech recognition: `not-allowed`,
`service-not-allowed` and `audio-capture` now stop listening, invalidate the recognition
session, abort the pending turn and clear conversation state. Their late `onend`
callbacks cannot restart recognition. An explicit user retry starts a fresh session.
One new unit test checks all three errors, error reporting and explicit retry.

Verification: 782 combined voice/platform/radio-schema tests passed (77.83 seconds),
with no failures, skips or TODOs. The sandboxed browser automation connection reset;
one permission-enabled retry passed under the existing 60-second watchdog.
Production build passed (248 modules, 37.10 seconds, existing node:fs/chunk warnings).

This is isolated Chromium interaction evidence, not certification of the embedded
ChatGPT browser or a live provider. The free-voice state callback is observed directly;
the full application's fallback MIC binding is not exercised by this harness.
No actual microphone, live AI request, saved user records, credential changes or
publication were involved. V1/V2 acceptance review, embedded-host validation and
V3's explicitly authorized live smoke check remain open. No release gate is closed.

## Checkpoint 64 — main-shell microphone fallback

September 14, 2026. `main.js` now uses `installVoiceFallback` rather than a separate
inline binding. The isolated browser harness exercises that same binding with the
real microphone controls and synthetic speech/services.

The old startup token-minting probe is removed. `/api/openrouter/status` now also
returns `realtimeConfigured`, a boolean derived from server configuration. It never
returns the key and does not call OpenAI. The client reads only two booleans, with
a five-second deadline and teardown cancellation. The local endpoint was checked
with a bounded request: HTTP 200 and both expected boolean fields were present.
This is configuration presence, not credential validity, billing or provider health.
An invalid configured key is reported when the user explicitly starts Realtime;
it no longer causes a speculative provider call during startup. Unknown/malformed
configuration leaves the existing transport intact. Active Realtime sessions are
not displaced. Deployments must update the status endpoint along with the client.

When browser voice takes ownership, the binding replaces only the MIC button,
preserves its disclosure, changes its accessible label/help, disables the inactive
Realtime tier control, hides its cost value and detaches Realtime's Space listeners.
It does not install a global Space-swallowing listener. Error details and status
are rendered as text; denied speech is visibly an error rather than an idle state.
Page teardown cancels pending configuration reads and removes the owned click handler.

Five new unit tests cover non-minting configuration reads, malformed/offline/hung
responses, cancellation, configured/active Realtime and unsupported-speech guards,
and main/server wiring. Expanded Chromium assertions cover actual button start/stop,
denial/retry, shortcut detachment, privacy/help/cost controls, chart-command feedback,
disposal and byte-identical synthetic records. No new token request occurs during
fallback binding or browser-voice button/Space interactions.

Verification: all 787 combined voice/platform/radio-schema tests pass (80.79 seconds).
Production build passes (249 modules, 35.50 seconds, existing node:fs/chunk warnings).
An initial browser run passed assertions but hung during shutdown and hit the
60-second watchdog. Cleanup is now bounded to three seconds before stopping only
the harness's owned fresh-profile Chromium process, and success is printed after
cleanup. The rerun exited successfully in Chrome 145.0.7632.77 without forced cleanup.

This verifies the extracted production binding, not a full application-bootstrap,
embedded-host or live-provider run. All test speech, microphone and token/chat
responses were simulated. No credentials or saved user records were changed, and
nothing was published. V1/V2 acceptance review and remaining V3 host/live validation
stay open; no calculation or release gate was waived.
