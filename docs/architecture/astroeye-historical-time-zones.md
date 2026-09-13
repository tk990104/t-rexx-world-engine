# Historical time-zone conformance

## Evidence and limits

Sixteen wall-clock cases were derived by hand from IANA tzdb **2026d**, as reported
by its [version endpoint](https://data.iana.org/time-zones/tzdb/version) on September
13, 2026. The fixture retains whitespace-normalized excerpts from the public-domain
[Asia](https://data.iana.org/time-zones/tzdb/asia) and
[Australasia](https://data.iana.org/time-zones/tzdb/australasia) data files, their URLs,
version, retrieval date and derivation notes. It does not fetch source data at test time.

Expected UTC values are calculated from those rule offsets, not copied from Intl
output. Nevertheless, Intl itself uses tzdb-derived data: these are application
conformance checks, not an independent historical authority or ephemeris validation.
IANA's [theory document](https://data.iana.org/time-zones/tzdb/theory.html) discusses
historical limitations. Pre-1970 records can be incomplete or revised, and future
political rules may change. Passing these samples does not validate every zone or
every instant in the 1900–2100 application range.

## Cases

- Kathmandu in 1900 retains the 5:41:16 offset, including UTC seconds and a local
  January 1 instant that falls before the app's lower UTC range boundary.
- Kathmandu's 1920 offset change repeats 11 minutes 16 seconds. Checks cover one
  second before, the first/last repeated seconds and the first unique time after it.
- Kathmandu's 1986 change skips fifteen minutes. Both missing interval endpoints
  and the surrounding valid seconds are checked.
- Kwajalein's 1969 change repeats 23 hours. The two candidates remain in chronological
  order and explicit occurrence selection preserves the correct UTC date.
- Samoa's 2011 change skips December 30. The first/last seconds of the missing date
  are refused, with neighboring valid seconds mapping across the date-line change.

All comparisons require exact UTC seconds and exact candidate lists; there is no
loosened timing tolerance. Nonexistent inputs cannot become canonical events.
Ambiguous inputs require a matching candidate; a mismatched explicit instant fails.
Each accepted event round-trips through canonical JSON, and in-range cases also
round-trip through shared views. Draft summaries preserve second-level offsets and
refuse to guess an occurrence. One-minute previews cross the Samoa date skip and
Kathmandu quarter-hour gap while leaving the source event unchanged.

## Runtime verification

Node runtime at collection: 24.20.0, ICU 78.3, tzdb 2026c. The reference snapshot is
2026d; tests deliberately compare these selected historical rules rather than require
identical release labels. They fail if runtime conversions diverge. Browser ICU/tzdb
versions are not exposed by a standard API, so the isolated Chromium check records
its browser version and runs the same sixteen expected conversions and draft summaries.
It loads only the necessary modules on a blank intercepted document; it does not
open the user's page, read IndexedDB or run the globe.

Commands:

`node --test src/domain/events/historicalTimeZones.test.mjs`

`node scripts/qa-astroeye-historical-time-zones.mjs`

The existing local preview server must be available for the second command. Its
45-second watchdog closes only its owned headless browser. This is runtime coverage,
not certification of the user's embedded browser. No application behavior, saved
records, dependencies or licenses were changed.

## Remaining release work

A3 has targeted historical-zone coverage, but still requires independently sourced
endpoint/older-date planetary positions, motion/station and zodiac-boundary samples,
plus the final candidate verification. A1/A2 gaps remain as documented. No release
gate is closed by this checkpoint.

## Checkpoint 50 verification — September 13, 2026

All 333 platform tests passed in 21.95 seconds, including nineteen new historical
zone tests. The isolated browser runner passed all sixteen conversions and draft
summaries in Chrome/145.0.7632.77. The nineteen-test Node subset also passed on its
own. No production build was repeated for these test/fixture/documentation changes.
