# AstroEye provider response-size hardening

October 5, 2026, checkpoint 129, based on `b3e4cd0`. Partial L2 code review and fix;
not a completed security/rights audit or a new release acceptance.

## Finding and correction

The sports proxy already restricts methods, query fields, provider origin/routes,
request frequency, cache count/lifetime and request duration. However, it called
`upstream.json()` before normalization. Limiting normalization to 100 events did
not limit how much response data was buffered and parsed first. A malformed or
oversized upstream reply could therefore consume excessive resources.

`server/sportsScheduleProxy.js` now reads a maximum of **2 MiB (2,097,152 bytes)**
from the response body before JSON parsing, for both schedule and venue requests.
An excessive Content-Length is rejected before reading. The actual stream byte
count is always checked, including when the header is absent or understated.
The cap applies to bytes delivered by fetch's body stream, not JavaScript string
length. A fixed-size buffer avoids a growing list of tiny chunks. UTF-8 decoding
occurs after assembly, so a character split between chunks is preserved.

Oversized/failed reads cancel and release the reader without awaiting cancellation
acknowledgement. They use the existing generic 503/manual-entry fallback, do not
expose upstream URLs/keys/errors, and are not cached. In-flight deduplication is
preserved; the failed key can be retried. The cap is a conservative application
resource policy, not a provider limit or a whole-process memory guarantee. A valid
reply above it is also rejected and must use manual entry/retry; there is no
silent partial parsing or truncated successful schedule.

No dependencies, API keys, saved records, calculation models, UI wording, rate
limits, provider routes, timeouts or source terms were changed. No live provider
request or microphone operation was performed by these tests.

## Verified boundaries

The final focused run passes **59 tests**, zero failures/skips/cancellations,
reported duration 38.479s. It covers schedule normalization/provenance/review,
panel cancellation, reviewed imports, note recovery/privacy and share allowlists.
Six added tests specifically cover:

- Declared oversized response rejected before body reads; generic, key-free error.
- Missing/understated length with streamed overflow; cancellation, no cache entry,
  successful retry and subsequent caching.
- Valid JSON exactly at the cap, with a UTF-8 character split between chunks.
- Venue response overflow measured in bytes rather than character count.
- Malformed JSON/stream failures with private error text suppressed and retry allowed.
- Concurrent oversized reads coalesced into one request; stalled cancellation
  acknowledgement does not block the fallback response.

```text
node --test --test-concurrency=2 src/modules/astroeye/sportsSchedule.test.mjs src/modules/astroeye/sportsSchedulePanel.test.mjs src/modules/astroeye/recordImportReview.test.mjs src/modules/astroeye/researchAnnotationRecovery.test.mjs src/modules/astroeye/shareView.test.mjs
npm run build
```

Build passes (261 modules, 33.65s), retaining the existing node:fs browser
externalization and large-chunk warnings. Diff whitespace checks pass. These are
synthetic Response/stream tests, not a live-provider or embedded-browser test.
Full repository, allocation and browser suites were not rerun for this bounded
server change. The previous CI pass is for eb1a716, not this new code.

## Review status and remaining work

Inspected safeguards include GET-only routing, fixed upstream host/endpoints,
numeric venue IDs/date validation, rejection of unknown/duplicate parameters,
server-only key use and generic upstream failure text. Existing focused regressions
also verify single-use import review, overwrite acknowledgement, conflict checks,
and exclusion of private annotations from matching exports, comparison reports,
links and tours. This is not an exhaustive review of every route or voice path.

L2 still requires the remaining route/secret/recording review and a current
deployment-specific provider/data/asset rights disposition. No current provider
terms were re-evaluated or rights accepted in this code-only checkpoint. L1 remains
accepted for its reviewed eb1a716 candidate; this local server change needs updated
candidate verification before promotion. Other open gates are unchanged.

Six gates accepted, nine open. This checkpoint is local only: no additional push,
deployment or release tag. The user's actual-preview note-marker check is still
pending and must not be inferred from these server/privacy tests.
