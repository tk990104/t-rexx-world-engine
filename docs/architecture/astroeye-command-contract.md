# AstroEye command foundation — checkpoint 60

Historical checkpoint record. [Checkpoint 61](astroeye-workspace-commands.md)
adds runtime shell registration; statements below about the then-unmounted
foundation are retained as history, not current integration status.

The user approved starting planned voice controls while A1/A2 remain mandatory
release blockers. This changes execution order, not release scope or criteria.
Starting commit: `19b5b1d`. A3's calculation candidate is unchanged.

## Implemented contract

`createAstroEyeCommands(services)` creates seven immutable canonical definitions
for the existing command registry. Tests register them and generate both catalog
shapes; the application shell and actual voice transports are **not wired yet**.
The manifest command list remains empty until runtime registration is integrated.

| Command | Arguments | Effect/result |
| --- | --- | --- |
| `astroeye_open` | none | Open the workspace through its adapter |
| `astroeye_close` | none | Close only the AstroEye workspace |
| `astroeye_select_event` | exact `title` | Select locally without navigation or chart writes |
| `astroeye_fly_to_venue` | none | Request separately guarded venue navigation |
| `astroeye_preview_time` | integer `offsetMinutes`, -360 to 360 | Absolute unsaved offset from event start; zero restores original |
| `astroeye_event_sky` | boolean `enabled` | Explicit on/off, with camera focus disabled |
| `astroeye_summarize` | none | Displayed UTC calculation time, model and conventions only |

Save, delete, import and export have no definitions. Schemas reject additional
properties and runtime validation rejects coercion, missing fields, accessors,
control characters and invalid offsets. Title matching is trimmed, case-folded,
NFC-normalized exact comparison, not fuzzy search. Duplicate matches yield
`ambiguous` without returning a list; users must disambiguate through the UI.
Validated arguments are captured before any await.

Only fixed response codes leave the boundary on errors; arbitrary adapter,
provider and event text is never echoed. A successful selection returns neither
record IDs nor event details. Summary includes no title, venue, coordinates,
notebook, raw chart or planetary positions. It uses the displayed preview time
and preserves the supported calculation model, with a fixed caution against
accuracy/prediction claims. It does not upgrade or recalculate a stored chart.

The title supplied to a future remote tool and the summary's exact timestamp may
themselves be private. V2 must document those explicit disclosures before live
use; static tool catalogs contain no saved collection or notebook. The existing
`safeForLocalVoice` flag is a catalog eligibility flag, not a guarantee that a
future speech/model transport operates offline.

## Ownership, cancellation and adapter obligations

Commands share a busy lock. `canInteract` must explicitly allow an action; shell
adapters must include Director/UI/camera-ownership checks, not merely check for
a selected event. A five-second maximum deadline releases a stalled command;
AbortSignal and disposal also invalidate pending work. Delayed reads cannot
select after cancellation, disposal, timeout or ownership loss. Late rejections
are consumed without leaking raw error text.

Each async effect receives `isCurrent`. Adapters must check it immediately before
committing effects after waits, synchronize rendered UI with the controller, and
return true only for success (selection may return its internal snapshot, which
is not forwarded). This is not rollback of an effect already committed. The
timeout does not forcibly terminate a browser API or storage read. Disposal
invalidates definitions, but removal from the registry is a shell-lifecycle task.

Selection forces `navigate: false` and `persistChart: false`. Event-sky changes
force `focus: false`. Camera movement must use the shell's ownership-aware
navigation seam; this foundation deliberately does not directly call Cesium.

## Verification and finish line

`node --test src/modules/astroeye/commands.test.mjs` passes eight focused tests.
They cover catalogs/schema immutability, validation, literal untrusted titles,
ambiguity, bounded adapters, changed ownership, caller mutation, abort/disposal,
timeouts and error redaction. A fake-IndexedDB integration uses the real chart
controller: a missing Whole Sign chart remains unsaved, preview moves time,
summary exposes only approved fields, and serialized records remain byte-identical.

Full regression: all 434 platform tests passed in 28.18 seconds on Windows with
Node 24.20.0, with no failures, skips or TODOs. The focused eight-test run passed
independently in 0.60 seconds. No API request was made by these checks.

This module is not imported by the application entry point yet. No microphone,
live AI request, credential change, preview interaction or publication occurred.
No build/browser check is claimed for this unmounted command foundation.

V1 remains open for shell adapters/registration and complete interaction checks;
V2/V3 remain open for transport parity, disclosure and authorized live checks.
Next is shell integration with UI refresh and camera guards, then both existing
voice paths. A1/A2 remain release blockers; no release gate is closed here.
