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
