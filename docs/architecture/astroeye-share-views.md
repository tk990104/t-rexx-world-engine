# AstroEye view links

Select an event in AstroEye, optionally move the time explorer, then choose **Create view link** below the chart. Review the privacy notice and use **Copy link**. If clipboard access is unavailable, the app selects the link for manual copying.

The link is a snapshot at creation. Changing the chart time or event clears the displayed link; camera-only changes do not rewrite an already-created snapshot. Create a new link to capture a later camera pose.

Open the link in a new tab, or reload after pasting it into an already-open app tab. Like the existing world-share system, restoration happens at startup, not on fragment-only navigation inside a running app.

## What comes back

- Canonical event inputs: participants, sport, competition, venue coordinates, original local date/time, IANA zone, resolved UTC instant, duration and source provenance.
- Whole Sign or Equal houses, calculation contract version, Astronomy Engine version, and whole-minute time-explorer offset.
- Camera pose, style, map choice and selected layers through the existing world-share codec. Camera precision remains the existing codec's four decimal degrees, whole-meter altitude and whole-degree orientation.
- A recalculated chart and matching event/replay `WorldClock`, opened in AstroEye after the shell's initial restoration settles. The venue marker is added without a second fly-to.

Live layers still show current provider data, not the historical event time. Their availability can differ by recipient, provider, credentials and network. Link restoration is not evidence that the schedule is official or that astrology predicts an outcome.

## Records and privacy

Incoming events remain **unsaved shared previews**. They are not merged into IndexedDB automatically, and Delete event is unavailable for them. **Save a copy** assigns a fresh ID and stores the original event plus its kickoff chart. A nonzero time preview remains unsaved. Even if an incoming event ID matches a local event, the link cannot overwrite that local event. A generated-ID collision fails rather than replacing a record.

The `ae` hash parameter is base64url-encoded UTF-8 JSON, **not encryption**. Anyone with the complete link can read its event details and precise location. Fragments are normally omitted from HTTP requests, but remain visible to the recipient, browser history, copied messages and scripts running on the page. Do not put secrets in event fields. Query strings and URL credentials are stripped when creating an AstroEye link.

Creating a link does not upload anything, change browser history, or write the clipboard. Copying is a separate explicit action. Ordinary world-share links and automatic camera/address updates do not include `ae`; event data is never silently added to them. Capture the generated link if it is needed later: ordinary address updates remove the incoming snapshot parameter, and a plain page reload is not a saved AstroEye workspace restore.

Localhost links only work where the app is running at that same address. A public app deployment is required for other people to open a link remotely. This milestone does not deploy a site or buy any services.

## Validation and architecture

- `shareView.js`: versioned, allowlisted payload codec. No chart bodies, HTML, executable commands or arbitrary module state are accepted. The calculation engine and contract must match; unsupported versions fail explicitly.
- Encoded payload cap: 8,192 characters. Individual canonical strings: 512 characters. Combined URL cap: 16,000 characters. Larger records should use JSON export; messaging clients may impose lower URL limits.
- Parsing rejects damaged encoding, invalid Unicode/JSON, duplicate payloads, invalid/incomplete camera coordinates, unsupported house systems, out-of-range/non-integer offsets and invalid event inputs. DST folds retain their explicit UTC choice. Imported strings are rendered as text.
- `ShareLinkManager.createLink()` exposes a side-effect-free public snapshot method; existing Copy link behavior delegates to it.
- `workspaceController.restoreSharedView()` validates and calculates the complete chart before changing module time/selection; no storage write is involved. `saveSharedCopy()` is the separate persistence boundary. Shared selections have `shared: true` and `selectedChartId: null` until saved.
- Startup captures the payload before automatic address updates. The main composition root waits for shell restoration, opens the module panel, then restores AstroEye without moving the camera. A newer user interaction with AstroEye takes priority over a delayed shared-view restore. Invalid AstroEye data displays a rejection notice while ordinary world sharing remains available.

## Verification

`npm run test:platform` covers codec determinism and Unicode, source allowlisting, damaged/oversized payloads, version mismatch, coordinate and offset validation, no-write restore, ID collision safety, explicit save-copy, unchanged prior state on rejected input, and presentation failure.

`node --test src/sharelink.celestial.test.mjs` covers the existing world-share behavior.

`node scripts/qa-astroeye-share.mjs` uses separate isolated sender/recipient profiles. It checks matching chart geometry, repeated-hour preview, WorldClock, camera, map and a selected Airports layer; no automatic records; save-copy; malformed-link rejection without losing existing records; clipboard denial/success via isolated mocks; and desktop/mobile layout. No user records or system clipboard are touched.

Remaining M3 work includes event-time celestial overlays and a module-aware Director recipe. This is not a full MVP-release sign-off.

Milestone check: 101 platform tests, 32 world-share tests and 50 layer-state tests pass, plus the production build and isolated sharing/time-explorer browser checks. An additional run of the untouched `reasonableDefaults.test.mjs` still fails its source-text anchor check on this Windows checkout (CRLF-sensitive); the entire inherited suite is not claimed green.
