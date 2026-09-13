# Real-browser download and leave-warning check

Run the development server, then `npm run qa:astroeye-browser-safety`. `QA_BASE_URL` optionally selects a different development server; the default is `http://127.0.0.1:5173`.

This complements the isolated DOM/payload checks: it exercises Chromium's actual download manager and beforeunload dialog lifecycle. It does not use the user's open preview, browser profile, notes, saved events or live globe. All notebook text and chart inputs are synthetic. Document requests are replaced with a small fixture, and cross-origin requests are aborted. The real notebook/comparison panels and download implementations load from the development server; notebook persistence is an isolated in-memory stub because IndexedDB behavior has separate tests.

## Assertions

- A real user-style input interaction creates an unsaved note draft containing Unicode, line breaks and leading whitespace.
- The native draft download produces `t-rexx-research-note-draft.txt` with the exact expected UTF-8 text and leaves the note unsaved.
- The native comparison download produces `t-rexx-chart-comparison.txt` with the expected report and both exact UTC chart times.
- Downloads themselves cause no leave dialog.
- Canceling an actual beforeunload dialog leaves the page and draft intact.
- Saving notes removes the warning, and the next navigation succeeds without a dialog.
- Explicitly accepting a later beforeunload dialog permits navigation away from a synthetic dirty draft.

Browser download events and filesystem reads verify completed files; no mocked download callback is used here. The test logs the browser version and a uniquely created `output/browser-safety-*` folder containing only two synthetic text artifacts. `output/` is already gitignored. Files remain available for inspection and are never uploaded by this check.

The whole test has a 60-second watchdog, with 10-second operation/download/dialog bounds and bounded forced browser cleanup on timeout. It launches a fresh headless Chromium session and never starts full 3D rendering or Director playback.

## Scope of proof

The check passed twice locally on September 12, 2026; the final run reported Chrome/145.0.7632.77. This closes the earlier standalone-Chromium gaps for actual text-file delivery and native leave dialogs. It does not certify the Codex/ChatGPT embedded browser, other browsers, a system Save As dialog, crashes, mobile lifecycle events or forced app termination. The UI therefore continues to say download requested and to warn that hosts may suppress leave dialogs. The older checkpoint notes correctly describe their narrower payload/synthetic-event coverage.
