# AstroEye voice acceptance — checkpoint 65

Reviewed September 14, 2026 against runtime candidate `19b642f`. This checkpoint
adds tests and documentation only; production calculations and voice code are unchanged.

## Decision

- **V1 accepted:** the registered seven-command contract satisfies its bounded
  arguments, selection/refusal, camera/Director ownership and non-persistence criteria.
- **V2 accepted:** both existing transport paths use the canonical definitions and
  dispatcher, with parity/error evidence and the data review below.
- **V3 remains open:** simulated failures and isolated UI checks are not a substitute
  for full-bootstrap/embedded-host coverage or an explicitly authorized live smoke test.

These decisions accept implementation criteria, not provider availability, speech
recognition quality, universal model compliance, calculation accuracy or release readiness.
No gate was removed or weakened. A3 remains accepted for its numerical candidate;
A1/A2 and the remaining voice/research/usability/release gates stay open: 12 of 15.
Changes to the command schema, adapters, ownership, transport dispatch or payload
construction require the affected V1/V2 checks to be rerun and this decision reviewed.

## Command-by-command transmission review

All catalogs contain static descriptions/schemas, never a list of saved records.
All failures return only `ok:false` and a fixed `code`, without candidate titles,
record IDs, notebook text, provider error bodies or coordinates.

| Command | Model-supplied arguments | Successful AstroEye result | Scope constraint |
| --- | --- | --- | --- |
| `astroeye_open` | Empty object | `ok`, `code` | Opens only AstroEye; guarded async mount |
| `astroeye_close` | Empty object | `ok`, `code` | Does not dismiss another module's panel |
| `astroeye_select_event` | User-supplied exact title | `ok`, `code` | Normalized exact match; ambiguous/missing refused; no chart save or camera move |
| `astroeye_fly_to_venue` | Empty object | `ok`, `code` | Selected venue only; explicit camera authority; no returned coordinates |
| `astroeye_preview_time` | Integer offset from -360 to 360 | `ok`, `code` | Absolute from event start, not cumulative; saved records unchanged |
| `astroeye_event_sky` | Explicit boolean | `ok`, `code` | No automatic focus or camera move |
| `astroeye_summarize` | Empty object | `ok`, `code`, calculation time/version, zodiac, house system, reference frame, caution | Describes the displayed supported calculation only; no predictions, title or location |

Important transport context beyond those command results:

- Realtime carries microphone audio/conversation and function-call traffic to OpenAI.
  A spoken event title is already user-supplied transcript data. Existing diagnostics
  can record transcripts, tool arguments/results and errors locally/server-side.
- Free-model parsing sends transcript/history, the static catalog, and the existing
  enabled-layer/current-camera description through the OpenRouter route. That camera
  context can reveal the currently viewed area, including after a venue flight.
- Generic legacy map tools can return map/entity/annotation context; eligible
  `get_entity_context` results can trigger a viewport image. AstroEye command results
  do not themselves trigger that screenshot path. This is not a global voice privacy
  guarantee or a claim that map context is always public.
- No production voice path inspected here directly attaches AstroEye's record
  collection or notebook to its prompt. Selection reads the local event list but
  returns only a status. Notebook contents are not an input to these seven commands.
- Policy text treats event/provider/note fields as inert data, forbids guessing
  saved titles and forbids using other tools to bypass an AstroEye refusal.
  Prompt instructions are not an infallible defense or a guarantee about live models.
- Browser speech recognition may itself be remote. Exact local phrases avoid an
  AI parsing request, not necessarily a speech-service request. Manual UI needs neither.

## Evidence

The new `src/voice/astroeyeAcceptance.test.mjs` executes **22 scenarios through each
of three paths**: direct canonical runner, simulated Realtime function events and
the free-model agent loop (66 dispatches). Each path uses a real workspace controller
and its own fake-IndexedDB store containing three synthetic events and a saved
notebook. Full stored bytes are compared before/after.

It verifies all seven commands, repeated absolute preview, supported summary time
and caution, no selection, missing/ambiguous titles, malformed/bounded arguments,
Director/camera refusal, unsupported calculations and four forbidden write names.
Returned results agree exactly across paths. Captured Realtime outputs and free-model
requests/observations contain none of the private venue, record-ID or notebook sentinels.
Free-model camera/layer context is reviewed separately above; this parity harness
does not mount the full free-voice UI or run an actual provider.

Supporting current-candidate evidence:

- `commands.test.mjs`: strict validation, literal treatment of instruction-like
  titles, deadline/abort/dispose/busy behavior and real-controller record preservation.
- `workspaceCommands.test.mjs`: manifest/registration parity, rendered adapters,
  manual-input cancellation, camera refusal, panel races and owner-only cleanup.
- `astroeyeVoice.test.mjs`, `voiceFallback.test.mjs` and inherited voice tests:
  parser refusal, transport cancellation, minimal outputs, missing configuration,
  permanent speech-error retry control and non-minting startup configuration.
- `scripts/qa-astroeye-commands.mjs`: real workspace/MIC controls in an isolated
  Chromium profile, using simulated services. It covers all seven commands, chart/sky
  synchronization, privacy, manual controls after failures and the production fallback
  binding's start/stop/retry/shortcut/disposal behavior.

Final run: **788 tests pass** (60.80 seconds), no failures, skips or TODOs. The isolated
browser check exits successfully in Chrome 145.0.7632.77 with no forced-cleanup flag.
The production build was not rerun for this test/documentation-only checkpoint;
checkpoint 64's successful build remains the build evidence for unchanged runtime
candidate `19b642f` (249 modules, 35.50 seconds, existing warnings).

## Remaining V3 work

The [real-app bootstrap harness](astroeye-bootstrap-validation.md) introduced at
checkpoint 66 now passes offline assertions at checkpoint 67 after correcting test
mocks and navigation. Both startup configurations and seven commands preserve
synthetic record bytes without provider calls. Browser close required owned-process
timeout cleanup; embedded-host, graceful teardown and live checks remain open.

Complete remaining host/teardown checks without exposing real saved records.
Before any live test, explicitly agree on provider, microphone use, outgoing
audio/transcript/tool/map context, session length and possible metered charges. Use
synthetic records and a small command sequence; record outcomes without storing
credentials or microphone recordings in acceptance artifacts. Do not mark V3 accepted
until the actual live/host evidence is recorded. A generic continuation is not live-test
authorization. No live voice/provider calls, credential changes or publication occurred
in this review.
