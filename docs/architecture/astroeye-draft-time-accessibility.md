# AstroEye draft-time error accessibility

September 16, 2026, checkpoint 103, from `c13d864`.

## Behavior

The local date, local time, venue time zone and repeated-hour selector now point
to one atomic, polite draft-time explanation through aria-describedby. Invalid,
nonexistent and out-of-range combinations mark the three contributing time fields
aria-invalid. An unresolved repeated hour marks only its occurrence selector.
These are combination errors, not a claim that each individual field is malformed.
Pending edits, incomplete drafts and successful resolution clear stale markers.
Rendering uses textContent and never changes field values or moves focus.

After a rejected submit, invalid/nonexistent/out-of-range resolution focuses the
explanation, with a visible outline. It has tabindex -1, so it does not add a stop
to ordinary Tab navigation. The existing workspace focus-visibility handler keeps
it clear of sticky headers. Native required-field validation remains in place,
including its focus on an unresolved repeated-hour selector. Editing or changing
a field alone never invokes the new focus behavior.

Out-of-range drafts are now refused before calling saveDraft, using the existing
resolved UTC range assessment rather than a local-date-only limit. The controller
retains its independent validation. Occurrence choices are rebuilt before the
range refusal, so an existing ambiguous choice is not silently hidden or guessed.
This does not change the supported 1900–2100 inclusive UTC range, calculations,
provider review, saved record schemas, chart selection or sharing policy.

## Verification

- 27 focused tests pass (1.076 seconds): real time-resolution cases, feedback
  attributes, stale-error clearing, literal content, unchanged values, markup and
  submit wiring, existing range rejection/storage preservation and focus layout.
- All 510 platform tests pass (33.119 seconds), zero failures/cancellations/skips.
- Production build passes (259 modules, 17.72 seconds), with existing node:fs
  externalization and chunk-size warnings. Full repository and allocation suites
  were not rerun for this bounded workspace change.
- In a separate actual embedded preview tab, a synthetic unsaved form with
  America/New_York 2026-03-08 02:30 rejects and focuses the explanation. The three
  time fields expose the associated description and invalid state.
- 2100-12-31 23:30 resolves beyond the UTC upper boundary and rejects at the same
  focusable explanation; the outline is solid.
- 2026-11-01 01:30 refuses submission until an occurrence is chosen. Native
  validation focuses the selector. Selecting the second occurrence yields
  06:30 UTC, retains selector focus and clears all invalid markers. This corrected
  draft was not submitted. The saved-list count remains 2 of 2; no successful save
  was requested. The test tab was closed and the original globe tab was untouched.

The browser exercise uses the normal app startup and its existing enabled feeds;
it is not a network-isolated test or a byte-for-byte user-storage audit. Unit
integration tests separately assert storage preservation on rejected writes.
No saved event was created, deleted or exported. No preference or voice permission
was changed. Screen-reader speech remains unverified; accessibility-tree and focus
observations alone do not certify it. Five release gates accepted, ten open;
U2 remains open. Nothing published.
