# Embedded-browser compatibility — checkpoints 69–71

Status: **the user reported all eight prerequisites detected and the requested
manual save/reopen/comparison check successful. Live voice acceptance remains open**.

## Checkpoint 71 — user-reported manual workflow success

The user replied “it worked” to the requested synthetic-event save, refresh/reopen,
and pinned 12:00/current 12:15 UTC comparison procedure. Record those requested
steps as successful by user report, not independently observed by the agent. The
separate Event start reset in the longer written guide was not explicitly requested
in that final handoff and is not newly confirmed here. No screenshot, record bytes,
database contents, export/recovery result or live-voice result was captured.

This supplies useful manual host compatibility evidence in addition to the eight
prerequisites. It does not certify durable backup/recovery, other hosts or the full
V3 gate. The test event was not inspected, edited or deleted by the agent.

## Checkpoint 70 — user-supplied report and manual handoff

On September 14 the user supplied a `trexx-host-features-v1`, `prerequisites-only`
report with `detected` for all eight IDs: `secure-context`, `graphics`, `storage-api`,
`named-time-zones`, `rtc-api`, `capture-api`, `recognition-api`, `speech-output-api`.
This is user-supplied host evidence, not an agent-observed end-to-end test. The
HTML-encoded spaces in the pasted message do not change its fields or results.
No storage persistence, voice permission, provider connectivity or chart-comparison
result can be inferred from those statuses.

One browser-tool connection check this turn still failed before selecting a tab
with the same kernel-assets / Windows error 3. No repeated recovery loop or native
automation workaround was attempted. The next manual test therefore needs the
user to operate the existing app tab. Main application code is unchanged.

### Save, reopen and compare one synthetic event

Finish or otherwise safely handle any existing unsaved form/notes before refreshing.
Do not change existing events or clear browser storage. Leave MIC/voice controls off.
Normal globe feeds may still operate; this is not an offline mode of the main app.

1. In the globe tab, open **AstroEye**. Create a new event using these inputs.
   If this exact test title already exists, append a fresh suffix rather than
   reusing or editing an existing record.

   | Field | Test value |
   | --- | --- |
   | Event name | QA Host Check 2026-09-14 |
   | Sport / Competition | QA / QA |
   | Away team / Home team | QA Away / QA Home |
   | Local date / Local start time | 2026-09-14 / 12:00 |
   | Venue time zone | UTC |
   | Venue name | QA Test Site |
   | Latitude / Longitude | 40 / -75 |
   | House system | Equal House |
   | Duration | Leave blank |

2. Click **Save and view on globe**. Confirm the test title and a 12:00 UTC chart
   appear. This intentionally creates one synthetic saved event and its chart.
   Do not create another event if a save error appears; report that error instead.
3. Refresh the globe tab, reopen **AstroEye → Saved events**, and select the same
   test title. Confirm it remains present and its chart is at the original 12:00 UTC.
4. Click **Compare charts → Pin this chart**. In **Time explorer**, click **+15 min**
   once, then return to **Compare charts**. The pinned snapshot should still be at
   12:00 UTC and the current chart at 12:15 UTC; the comparison table should appear.
   If it says **Replace pinned chart** before starting, stop and report that state
   rather than overwriting an existing pin.
5. Click **Event start** in Time explorer, then confirm current time returns to
   12:00 UTC. The pin is session-only; loss of the pin on a later refresh is expected.
   Leave the test event saved for now; cleanup/deletion is not part of this handoff.

Reply with three results: saved, reopened after refresh, and pinned/current times
after +15 minutes (plus any error or screenshot limited to the test record). These
steps are prepared, **not performed or passed**. Even a successful reply will not
close the complete V3 live/host gate or certify durable backup/recovery.

Documentation/source-label checks only this checkpoint; no new tests or build were
run. Earlier automated results below remain dated evidence. No live voice, user
record mutation, credential change or publication was performed by the agent.

## Checkpoint 69 — diagnostic implementation and tool blocker

The embedded-browser tool failed before connecting with `failed to write kernel
assets` / Windows error 3. A session reset and one retry produced the same result.
No tab was selected, no existing preview was operated and no actual host report was
obtained. This is an automation-runtime blocker, not evidence that AstroEye fails in
the user's browser. Native-app automation was not used as a workaround.

## Safe local feature check

Open `http://127.0.0.1:5173/qa/astroeye-host.html` in the browser being evaluated,
preferably a separate tab, then press **Run local feature checks**. The page does
not import or initialize the main app. An optional plain-text JSON report can be
selected and copied manually; nothing is uploaded or copied automatically.

The page checks eight prerequisites:

- Secure context, a temporary blank WebGL context, IndexedDB API presence and a
  fixed named-time-zone formatting example.
- WebRTC and microphone API presence; speech-recognition constructor presence;
  speech-output constructor and methods required by the existing integration.

It never opens IndexedDB or Web Storage, constructs a speech or RTC session,
queries permission state, starts media capture, plays audio or calls a provider.
The graphics context is released through the available context-loss extension.
The report includes fixed labels and statuses only: no user agent, page URL,
location, credentials, events, notebook text or raw error messages.

The self-contained public assets use system fonts and a restrictive CSP, including
`connect-src 'none'`. The preview server returned HTTP 200 for the page, retained
the CSP and did not inject the development client into this static asset.

“Detected” is not an end-to-end pass. A storage API can exist while persistence is
blocked; voice APIs can exist while permission or service use fails. The single
timezone example does not validate historical timezone accuracy or the 1900–2100
calculation range. WebGL context creation does not certify rendering performance.
Missing voice prerequisites do not alone prevent manual AstroEye use.

## Verification

- **11 tests pass** (0.883 seconds): five feature-probe tests plus the six owned
  cleanup tests. Probe coverage includes blocked getters, missing APIs, partial
  speech output, graphics fallback/release and exclusion of private sentinels.
- `node scripts/qa-astroeye-host-browser.mjs` exits 0 in Chrome 145.0.7632.77. It
  serves only the three diagnostic assets from a temporary loopback server, uses a
  fresh browser profile and traps sensitive APIs. Nothing runs before the button;
  keyboard activation, eight rows, repeat runs, read-only report and 390px layout
  pass. **Zero sensitive operations and zero external page requests** were recorded.
- Cleanup is graceful (1.015 seconds), with no forced termination. A 60-second
  watchdog bounds the small harness. Its report explicitly says
  `embeddedHostVerified: false`.
- Syntax/diff checks pass. No new full-app build or full regression suite was run.
  Main app/voice/calculation code is unchanged; these are additional static QA assets.

## Remaining acceptance

The user's prerequisite and manual persistence/comparison reports are recorded
above. Live voice interaction checks remain pending. Do not infer V3 acceptance
from those reports, the isolated Chrome tests or detected APIs alone.
Before live voice tests, separately agree microphone use, provider, transmitted
context, session length and possible charges. A3/V1/V2 remain accepted; twelve
release gates remain open. No credentials, user records or publication changed.
