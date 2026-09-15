# AstroEye research record and recovery acceptance

September 15, 2026 — checkpoint 78. Runtime candidate: **`8bb14d9`**.
This checkpoint changes test harnesses and documentation only; application code,
data schemas, calculations and user records are unchanged.

## Decision

**R1 and R3 are accepted for this candidate. R2 remains open.** This is a review
against the existing release criteria, not a scope waiver or a release approval.
Together with A3/V1/V2, five of fifteen gates are accepted; ten remain open:
A1, A2, V3, R2, U1, U2, U3, L1, L2 and L3. Relevant future runtime changes require
revalidation. Earlier checkpoint statements that R1/R3 are open are historical.

## Criterion-to-evidence review

| Criterion | Reviewed implementation and passing evidence |
| --- | --- |
| R1: versioned record, stable ID, frozen event/time/location, bounded text | `researchAnnotations.js` enforces exact fields, canonical UTC, numeric coordinates, 2,000-character notes and 100 entries. Its six unit tests cover capture immutability, IDs, bounds, malformed/future records and no-write reads. |
| R1: explicit edit/delete and stale-write behavior | Only note text changes on edit. Whole-collection comparison occurs inside the native store's read-write transaction. Unit tests and the new browser check verify one initial winner and refusal of stale edits/deletes from an independent connection. |
| R1: deleted/restored source, notebook and session-callout separation | Source deletion leaves exact note bytes; source restoration resolves the same-ID reference without recapture. Notebook has a separate workspace key; callouts use their separate board/owner, not this service. Source/notebook preservation and callout ownership/cancellation tests pass. A same-ID source lookup means reference presence, not proof the event's content is unchanged. |
| R3: full backup and reviewed import | Native-browser and unit checks verify exact serialized round-trip, read-only review, single-use confirmation, explicit overwrite acknowledgement, stale-review refusal and whole-collection replacement. Notes absent from an acknowledged incoming collection are removed; this is not per-note merge. |
| R3: unsupported records and exclusions | Full backup transport preserves opaque future or malformed workspace payloads; the annotation service refuses to interpret or overwrite them. Unit checks verify matching exports have no workspaces and comparison reports, decoded share links and Director recipes are unchanged by adding private notes. Source review confirms their explicit field selection. |
| R3: deletion/undo and failed writes | Service tests and current editor browser QA verify exact original-ID restoration, same-ID/stale/cap refusal, failed restore retry, retained recovery entry and unchanged failed-save draft. Undo is one saved note per session, not unsaved edits or crash recovery. |

Reviewed seams: `researchAnnotations.js`, `researchAnnotationsPanel.js`,
`researchAnnotationLayer.js`, `worldRecordStore.js`, `recordImportReview.js`,
`researchNotebook.js`, `eventCallouts.js`, `matchingEventExport.js`,
`comparisonReport.js`, `shareView.js` and `directorRecipe.js`.

## Current verification

Environment: Windows, Node **24.20.0**, installed project dependencies, isolated
headless Chromium launched by Puppeteer; local Vite preview at `127.0.0.1:5173`.
No credential inspection, live provider calls or user-profile access occurred.

1. Focused regression command below: **57 passed**, zero failures/skips/TODOs,
   17.266 seconds. It includes the marker grouping regression but no fresh GPU run.
2. `node scripts/qa-astroeye-annotation-storage.mjs`: exit **0**, all native storage
   assertions pass. Two independent database connections in one disposable page
   contend for the same synthetic collection; another database receives backups.
   Close/reopen preserves bytes. Zero external requests; graceful owned-browser
   cleanup **6.487 seconds**, no forced termination.
3. `node scripts/qa-astroeye-annotations.mjs`: exit **0**, editor save/reopen/edit/
   delete, frozen capture, inert text, failed-write draft retention, stale writes,
   missing source, undo/conflicts and destruction during a pending save pass.
   Graceful cleanup **1.114 seconds**, no forced termination or live providers.
   The whole-run watchdog is now 60 seconds, matching the storage check.
4. Both script syntax checks and `git diff --check` pass.

```powershell
node --test src/modules/astroeye/researchAnnotations.test.mjs src/modules/astroeye/researchAnnotationRecovery.test.mjs src/modules/astroeye/researchAnnotationLayer.test.mjs src/modules/astroeye/researchNotebook.test.mjs src/modules/astroeye/eventCallouts.test.mjs src/modules/astroeye/recordImportReview.test.mjs src/modules/astroeye/matchingEventExport.test.mjs src/modules/astroeye/comparisonReport.test.mjs src/modules/astroeye/shareView.test.mjs src/modules/astroeye/directorRecipe.test.mjs
```

The 461-test platform suite and production build passed at checkpoint 77 for the
same runtime candidate; they were **not rerun** for this test/documentation-only
review. There is no claim of a fresh complete inherited unit-suite run or clean
install. Those remain part of L1.

## Boundaries and next steps

Native checks use real IndexedDB, but not the user's embedded browser, concurrent
browser tabs, disk exhaustion, process-crash recovery or filesystem backup files.
Quota/write failures in the editor are injected, not caused by filling the disk.
The backup string is transported through the real review/import code in memory;
host-specific downloads and file-picking remain U2 work. Unknown payload retention
is preservation, not support for future editing. No annotation data is encrypted;
full backups are private files and must be reviewed before sharing.

R2 stays open for actual terrain/embedded map behavior and accessibility evidence.
The [manual marker procedure](astroeye-research-annotation-contract.md#remaining-manual-preview-check)
is still unperformed; the known browser-control initialization failure has not
been resolved or bypassed. The focused component checks are not the complete U1
workflow, full Director playback or a new host acceptance. Continue with combined
workflow/usability evidence while retaining those explicit limitations. V3's live
provider approval and all calculation/rights/deployment gates remain separate.

No push, tag, deployment or release publication is part of this checkpoint.
