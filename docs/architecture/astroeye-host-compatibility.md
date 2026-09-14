# Embedded-browser compatibility — checkpoint 69

Status: **diagnostic page verified in isolated Chromium; actual embedded host not verified**.

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

An actual embedded-browser report and manual/voice interaction checks are still
needed. Do not infer V3 acceptance from this Chrome test or from detected APIs.
Before live voice tests, separately agree microphone use, provider, transmitted
context, session length and possible charges. A3/V1/V2 remain accepted; twelve
release gates remain open. No credentials, user records or publication changed.
