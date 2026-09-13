# Independent solar boundaries and planetary-hour checks

## Source and scope

Eight selected-field responses from the [U.S. Naval Observatory one-day
service](https://aa.usno.navy.mil/data/api) were retrieved on 2026-09-13. API signature
4.0.1, request URL, coordinates, local date, weekday, fixed offset, DST flag and solar
entries are retained. Moon/phase/label fields are omitted explicitly. These are
synthetic calculation samples, not user events.

- New York: 2024-03-10 and 2024-03-11, offset -4, America/New_York.
- Sydney: 2024-06-21 and 2024-06-22, offset +10, Australia/Sydney.
- Latitude +65, longitude 0: 2024-06-21 and 2024-06-22, offset 0, UTC.
- Latitude -80, longitude 0: 2024-06-21, offset 0, UTC, continuous solar absence.
- Latitude -80, longitude 0: 2024-12-21, offset 0, UTC, continuous daylight.

The northern +80-degree request failed with a transport EOF twice. It was not accepted
as a fixture. A failed PowerShell loop iteration retained the previous response in
memory; its Sydney coordinates/date exposed the mismatch. The stale result was
discarded. A negative test explicitly rejects mismatched response coordinates.
Future collectors must stop on errors and never reuse a previous response.

Checkpoint 45 retrieved the two +65-degree samples successfully. The +80 June 21
and -80 December 21 polar-day requests failed through PowerShell and one bounded
curl retry per request (TLS handshake failures/timeouts); neither was accepted.
Reference collection never bypassed certificate verification. The new +65 samples
are long-day/short-night evidence, not polar-day or seasonal-transition coverage.

Checkpoint 46's single bounded retry per missing reference succeeded for southern
polar day on December 21. Its coordinates, date, weekday, offset and API version
match the request, and all solar entries are retained. The northern request still
failed with a TLS handshake error; it remains excluded. Earlier failure notes above
are historical retrieval attempts, not the current status of the southern sample.

## Conventions and tolerance

USNO's [rise/set definitions](https://aa.usno.navy.mil/faq/RST_defs) use a level
sea-level horizon and a solar-center depression of 50 arcminutes, incorporating
standard refraction and an average solar radius. Astronomy Engine's installed
SearchRiseSet documentation uses 34 arcminutes of refraction and apparent body radius.
Neither models the actual weather or local skyline.

The **120-second discrepancy screen** was selected before running the comparison,
allowing minute-rounded reference output and different solar-radius/time conventions.
It is not an observational accuracy promise. USNO times are UT1 plus the requested
fixed offset; comparison uses UTC at this minute precision for modern dates.
The parser verifies that the IANA-zone date/time agrees at each accepted boundary.
NY's explicit -4 offset applies to the selected post-transition solar events; it
must not be reused as the offset for the entire DST-transition night.

Sydney's 07:00 local sunrise converts to 21:00 UTC on the preceding date. The fixture
preserves that date change instead of attaching every event to the local date in UTC.
Missing solar boundaries and continuous-absence notices are never coerced to midnight.

## Results

| Reference local date | Rise difference, seconds | Set difference, seconds |
| --- | ---: | ---: |
| New York 2024-03-10 | 6.218 | 3.723 |
| New York 2024-03-11 | 16.776 | 1.952 |
| Sydney 2024-06-21 | 5.611 | 6.262 |
| Sydney 2024-06-22 | 17.886 | 7.913 |
| 65N 2024-06-21 | 3.553 | 15.500 |
| 65N 2024-06-22 | 20.608 | 28.878 |

The southern polar-night sample returns planetary-hour unavailable, consistent with
the reference's continuous-absence result. This single-day reference does not certify
the implementation's entire two-day search window.

The southern polar-day sample also returns planetary-hour unavailable at midnight,
noon and the last millisecond of the reference date. No ruler, hour number or hour
endpoints are fabricated. Transit entries are not sunrise/set boundaries. The parser
requires one explicit continuous-above-horizon notice; it rejects duplicate notices,
conflicting above/below notices, rise/set entries alongside a polar notice, and a
missing or non-null notice time. Twilight-only data remains insufficient. These
checks cover one externally referenced date, not every instant of a polar season
or the entire surrounding two-day search range.

For each consecutive-day pair, tests divide the independent rounded rise/set/next-rise interval
into 12 day and 12 night segments. At all **72 segment midpoints**, AstroEye returns
the expected hour number, period, conventional ruler sequence and day ruler; each
returned interval endpoint stays within the fixed 120-second screen.
The ruler sequences are internal traditional-rule assertions, not USNO-provided data.
Twelve probes, four minutes before/after sunset and next sunrise, check 12-to-13 and
24-to-1 rollover and correct pre-dawn day ownership. These avoid source rounding
uncertainty; they do not test the exact millisecond of a transition.

The 65N samples have a rounded 22-hour 2-minute day and a 118-minute night, with
nighttime planetary hours shorter than ten minutes. The continuous-twilight notice
does not mean continuous daylight: sunrise/set still exist. A dedicated check
retains Friday's sunrise ruler after Saturday civil midnight and rejects a missing
sunrise even when the continuous-twilight notice remains. The 120-second screen
and four-minute rollover probes were not widened for these samples.

## Offline verification and maintenance

`node scripts/astroeye-sun-references.mjs`

`node --test src/modules/astroeye/calculation/sunReferences.test.mjs`

The parser rejects incompatible API versions, mismatched date/weekday/coordinates,
offsets/DST, missing/duplicate/malformed boundaries, conflicting zones and query
metadata. A deliberately shifted reference time fails the numerical comparison.
Tests guard the fixed tolerance, probe spacing and sample count.

No automatic reference refresh, new provider integration, dependency, credential or
application code change is included. Tests read local fixtures only and do not access
the user's saved records or browser.

## Remaining release work

Follow-up: the separate [70N transition pack](astroeye-sun-transition-references.md)
adds four independently retrieved days, including northern continuous daylight,
the final sunrise and first returning sunset. Its 24 additional midpoint checks
and explicit missing-boundary comparisons do not alter this eight-sample pack.

**A2 remains open.** [Model 3](astroeye-planetary-hour-model-3.md) now has exact computed-edge
contracts and additional timezone/DST checks. Southern and northern polar-day
samples are now accepted, with targeted seasonal-onset/first-sunset coverage.
Still needed: independently checked restoration after the returning sunrise and
broader seasonal/geographic coverage. These samples do not certify an entire
polar season or the full search window.
The returned status string `exact` is an existing application label, not a claim that
observed sunrise or all planetary-hour boundary times are scientifically exact.
The unresolved precise polar angle/MC/cusp reference requirement in A1 is unchanged.

## Checkpoint verification — 2026-09-13

All **273 platform tests** passed in 48.42 seconds, including eight new solar-reference
tests. The standalone offline comparison also passed. No production build or browser
test was repeated for these test/documentation-only changes.

## Checkpoint 45 verification — 2026-09-13

All **292 platform tests** passed in 19.75 seconds, including eleven solar-reference
tests. The standalone seven-sample offline comparison passed, with a maximum
sampled discrepancy of 28.878 seconds. The three new tests cover the 65N full-cycle
midpoints, rollover probes and continuous-twilight/short-night distinction. No
production build or browser check was repeated for this test/documentation-only
checkpoint. The application algorithm and user records are unchanged.

## Checkpoint 46 verification — 2026-09-13

All **295 platform tests** passed in 19.70 seconds, including fourteen solar-reference
tests. The standalone eight-sample offline comparison passed. Three new tests cover
southern continuous daylight, invalid/contradictory polar notices and polar-source
metadata mismatches. Existing solar time tolerances were unchanged. No production
build or browser check was repeated for these test/documentation-only changes.
