# AstroEye backup text-size boundary

October 5, 2026, checkpoint 130, based on `f01f6fb`. Partial L2 review;
not whole-release or security/rights acceptance.

## Finding and scope

The file picker already rejects files larger than 10 MiB before reading them.
It also checks the review generation after the asynchronous read, so canceled
reads cannot create a new approval. This review did not find a picker bypass.
The shared record API, however, parsed JSON strings without the same bound.
Direct or future callers could therefore bypass the UI's resource policy.

`worldRecordStore.js` now enforces the shared **10 MiB (10,485,760 byte)**
UTF-8 text limit before JSON parsing, normalization, or database access for both
`previewImportRecords` and `importRecords` (merge and replace). The existing UI
constant is re-exported from the store so the two limits cannot drift.

Strings over the code-unit limit fail immediately; other strings are counted
without allocating an encoded copy. Counting handles ASCII, two/three-byte
characters, surrogate pairs and lone surrogates (replacement-character encoding).
Exactly-at-limit input remains accepted; oversized input is rejected whole,
never truncated. The limit applies to the UTF-8 representation of the decoded
text, so replacement characters from malformed file encoding may increase size.

Trusted in-process object imports remain unchanged, including the reviewed
confirmation path. This is a serialized-input policy, not a quota on saved records
or an overall memory/CPU guarantee. Export, existing databases, legacy chart
models and calculation behavior are untouched. Deep/complex inputs and other
routes are not comprehensively certified by a byte limit.

## Verification

All **31 focused tests pass**, zero failures/skips/cancellations, 10.199s:

```text
node --test --test-concurrency=1 src/core/worldRecordImportLimit.test.mjs src/core/worldRecordStore.test.mjs src/modules/astroeye/recordImportReview.test.mjs
npm run build
```

Nine new cases cover the shared constant, rejection before parsing/storage,
exact-limit acceptance, one-byte overflow in merge/replace, five Unicode cases,
and clearing a prior approval after an oversized review with a valid retry.
Existing storage/review tests cover atomicity, record preservation, overwrite
acknowledgement, stale snapshots, cancellation and single-use confirmation.
All tests use isolated synthetic databases; no user records were read or changed.

Production build passes: 261 modules, 29.72s, with existing node:fs browser
externalization and large-chunk warnings. No full/allocation/browser suite rerun,
live provider call, new hosted CI, push, deployment or tag. Earlier hosted CI and
L1 acceptance remain tied to `eb1a716`, not these local changes.

## Remaining

Six gates accepted, nine open. L2 still needs remaining route/secret/recording
review and provider/data/asset rights decisions. Actual-host note-marker checks
remain pending separately. Next bounded code review: the remaining server route
and secret-handling boundaries, reusing existing passing privacy/import evidence.
