# AstroEye A3 supported-range candidate verification

## Checkpoint 57 — September 13 local / September 14, 2026 UTC

**Decision: A3 is satisfied for the inspected runtime candidate.** Fourteen other
release gates remain open. This closes the supported-range handling and sampled
reference criterion, not universal precision, prediction validity or the release.

Runtime candidate: `6c96b8640d21febc3c0ded49856fbfe6abf1be7d`. This checkpoint adds
only offline reporting/tests/documentation; runtime sources and dependency files
are unchanged from that candidate. The checkpoint commit carries the QA additions
and this evidence. Revalidate A3 if calculations, time policy, range handling,
reference sources, relevant dependencies or integration paths change before release.

Environment: Windows x64, Node v24.20.0, ICU 78.3, tzdata 2026c, Astronomy Engine
2.1.19; isolated browser Chrome/145.0.7632.77. Verification completed September 14
UTC (September 13 America/New_York). No public reference API was called this turn.

## Criterion-to-evidence review

| A3 requirement | Evidence and result |
| --- | --- |
| Document and consistently handle supported range | Approved half-open UTC interval `[1900-01-01, 2101-01-01)`; strict millisecond bounds, local-to-UTC year changes, all four calculation models, previews, shares and Director recipe paths tested. Out-of-range new calculations refuse without writes; stored archival records survive selection/import/export. |
| Historical-zone samples | Sixteen IANA-derived cases covering historical second offsets, non-hour gaps/folds and Samoa's skipped date pass in Node and fresh Chromium. This is runtime tzdb conformance, not independent proof of historical civil time. |
| Station and zodiac-boundary samples | Forward Sun crossing flanks in 1900/2024/2100, Mercury reversal windows in 1900/2024/2100 and a 2025 retrograde crossing pass with explicit uncertainty exclusions. Sampling is sparse, not root-time certification. |
| Rerun deterministic tests and stored external comparisons | All 418 platform tests pass; all 24 body/pack comparisons pass. Full-chart, model identity, cache/preview/share paths, metadata rejection and unchanged legacy byte fingerprints are included. |
| Describe sampled agreement honestly | Report pins unchanged tolerances, records inconclusive classifications and limits the claim to sampled positions. UI retains historical approximation/future held-leap-second notes. |

Supporting details: [date policy](astroeye-supported-date-range.md),
[historical zones](astroeye-historical-time-zones.md),
[model 4](astroeye-calculation-model-4.md),
[ten-body ranges](astroeye-ten-body-range-references.md),
[first boundaries](astroeye-station-zodiac-references.md) and
[extended boundaries](astroeye-extended-boundary-references.md).

## Reproducible offline report

`node scripts/astroeye-a3-references.mjs` evaluates all four packs without fetching
data or modifying records. It refuses missing, reordered, duplicated or reduced
coverage and recomputes numeric success rather than trusting a passed flag alone.
The [saved JSON report](fixtures/astroeye-a3-reference-report.json) records 303
positions, 606 coordinate comparisons and 101 centered motion comparisons.

The SHA-256 of ordered fixture paths and LF-normalized contents is
`37f50f84aeb00adcb8aed2d95da2b44e27f0bbc241191d0d74b13af8087fa8bd`.
It identifies the source snapshot; it is not an independent accuracy certificate.
Limits remain 60 arcseconds per coordinate and 0.07 degrees/day centered motion.
Boundary packs assess 63 signs: 62 decisive and one inconclusive. Across all
packs, 68 motion directions are decisive and 33 inconclusive, including slow
outer bodies. All numeric error screens pass; inconclusive directions are not
counted as direction certification. Original/range packs do not separately
classify zodiac boundaries: their report's `signChecks` is zero.

## Fresh verification results

- `npm run test:platform`: final run 418 passes, zero failures/skips/TODOs,
  52.35 seconds. Three consolidated-report regression tests were added.
- `node scripts/astroeye-a3-references.mjs`: exit 0; all 24 results pass.
- `npm run build`: exit 0, 245 modules, 31.88 seconds, Vite 6.4.3. Existing
  `node:fs` browser externalization and large-chunk warnings remain; these are
  not waived for release engineering by this gate's closure.
- `node scripts/qa-astroeye-historical-time-zones.mjs`: exit 0, sixteen cases
  and draft summaries pass in fresh Chromium (45-second watchdog).
- `node scripts/qa-astroeye-angle-caution.mjs`: exit 0, actual form refusal,
  archival notices/clearing, model 4 time notes, corrected Moon, comparison/report
  and preview identity, narrow/wide layouts and synthetic-record preservation
  pass (60-second watchdog). Polar/hour warning checks also pass, but do not
  supply the outstanding independent A1/A2 accuracy evidence.
- `git diff --check`: passes. Runtime/dependency diff against the candidate is
  empty; new source-tree files are tests only.

The build ran with local tooling access outside the sandbox. Browser jobs ran
serially after the build, used owned disposable profiles, blocked external
requests and closed their browsers. They did not touch the user's open preview
or records. A read-only Windows listener inventory was denied; no permission
bypass was attempted, and the successful local browser checks established the
required module-serving availability instead.

## Remaining release work

A1 (independent angle/house coverage) and A2 (independent solar-boundary coverage)
remain open. Next is their outstanding evidence, then the already-scoped voice,
durable annotations, complete usability/workflow and release-engineering gates.
This is not the clean-install/CI/full inherited-unit-run evidence required by L1,
nor embedded-host certification, legal/provider approval, deployment or a tag.
No dependency, license, API-key, runtime calculation or saved record changed.
No commit was pushed and no release was published.
