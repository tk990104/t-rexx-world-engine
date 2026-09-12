# Undo the last event deletion

Deleting a saved event still requires confirmation. After a successful deletion, **Saved events → Undo last deletion** identifies the deleted event and the number of stored charts available to recover. Undo restores those records without selecting a chart, moving the camera, changing world time or changing applied filters. Keyboard focus moves to the restored event if it is on the current list page, otherwise to Export all.

Only the latest successful deletion is retained in memory. Closing/reopening the panel preserves it; reloading the page or constructing a new controller loses it. Another successful deletion replaces the previous recovery copy. A missing-event deletion does not clear it. The recovery copy is not included in exports, URLs or Director projects. Keep a full export for longer-term recovery. Research workspaces are neither deleted nor restored by this action.

## Atomic storage and conflict protection

`worldRecordStore.deleteEvent(id, { capture: true })` reads the canonical event and all its stored charts, then removes them in one IndexedDB transaction. Existing callers without capture retain the boolean return contract.

`restoreDeletedEvent` validates the event/chart bundle and checks all event/chart IDs in a single readwrite transaction before adding any records. If any ID is already in use, Undo refuses the whole operation; it cannot overwrite a newer event or chart, even one attached to a different event. A conflict leaves the recovery copy available and explains why no records changed. There is no force-overwrite path.

The workspace controller exposes only a summary of its private recovery copy. Delete/undo operations are serialized with a busy guard. A successful Undo clears the copy and emits the existing event-saved refresh notification, allowing an enabled saved-event layer to refresh through its existing path. Charts are restored from storage, not recalculated; transient time-explorer charts were never part of the deleted bundle.

No database migration, new provider, network request, dependency or API key is added. This is one-step session recovery, not a recycle bin or durable deletion history.

## Bounded verification

42 targeted store, workspace-controller and saved-layer tests passed. Coverage includes exact event/all-chart restoration, zero-chart records, unchanged research workspaces, invalid bundles, atomic event/chart ID conflict refusal, no changes to another selection/time/presentation, latest-deletion-only behavior, empty history in a fresh controller and concurrent-operation refusal.

The production build passed with existing browser-externalization and bundle-size warnings. The isolated DOM-only browser check passed under its 60-second watchdog with real IndexedDB and synthetic records. It verifies canceling native confirmation, deleting, recovering across panel close/reopen, keyboard focus, mobile width, no automatic chart selection and refusing a conflicting newer ID. It also retains the import/template/draft-time checks. No user's saved event was deleted or altered, and the full 3D globe was not loaded.
