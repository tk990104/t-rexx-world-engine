# Use an event as a template

Open an event chart and choose **Use as template**. This replaces the unsaved event-form entries with the selected event's title, sport, competition, participants, original local start, venue time zone, coordinates, duration and current house system. It focuses the event name and requires reviewing the copied details before saving. Editing a field clears the review checkbox again. **Clear form** discards the draft using the existing form reset flow.

This is a new manual draft, not an edit or duplicate write. No event ID, chart ID, provider identity or provider retrieval metadata is copied. Only the existing **Save and view on globe** action writes a new event with a newly generated ID and chart. The original record remains unchanged. Coordinates are treated as user-confirmed only after the form's review step.

Copying the template itself does not read storage, calculate a chart, change the selection, move the camera or change world time. It uses the event's original start, not an active time-explorer offset. For repeated daylight-saving hours, the exact original UTC occurrence (including seconds) is selected in the form. If the user changes the date, time or time zone, existing time-resolution validation applies.

The action also works from an unsaved shared view: it prepares a manual draft and does not silently save the shared record. Pending provider selections are canceled and provider form state is cleared so a later time-zone edit cannot unexpectedly restore the old schedule time. No network service, dependency, schema migration or API key is added.

## Implementation and bounded verification

`eventTemplate.js` normalizes the source event and constructs a frozen form-only draft. The workspace applies it using the existing form, repeated-hour resolver and review checkbox. All persistence continues through the existing manual save controller.

23 targeted template and workspace-controller tests passed. They cover copied inputs, both repeated-hour occurrences, seconds, null/zero duration, invalid inputs, supported house systems, source immutability, new identity and removal of provider attribution. The production build passed with existing externalization/bundle-size warnings.

The existing isolated import browser check now also exercises the actual template button, mobile action-row width, focus, review reset on edits and explicit saving with real IndexedDB in an isolated browser profile. It confirms that a repeated-hour event copied from a 15-minute preview keeps its original kickoff, that copying leaves selection/storage unchanged, and that saving creates one new manual event while preserving the source. The check retains its 60-second watchdog and never initializes the full 3D globe or accesses the user's records. Shared-view templating uses the same UI path but was not separately browser-certified in this checkpoint.
