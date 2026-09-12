# Draft start-time summary

The event form now shows a read-only **Draft start** summary beside the date/time controls. For a resolved start it includes venue-local date and time, IANA time zone, exact UTC offset, and UTC date/time with seconds. UTC date rollover and non-whole-hour offsets are visible rather than hidden behind a zone abbreviation.

The summary uses the same `resolveZonedLocalTime` implementation as event validation. A repeated hour remains unresolved until the user chooses a valid occurrence; then the summary labels the first or second occurrence and its offset. A skipped local time, invalid calendar date or unknown zone cannot display a resolved UTC start. Missing inputs produce an incomplete message.

While a time field is being edited, the previous summary is immediately replaced with a pending-edit message. Committing the field change refreshes the result. Choosing a repeated-hour occurrence, loading a template or selecting a schedule time also updates it. **Clear form** now refreshes time resolution after restoring the form defaults, avoiding an old summary or occurrence choice.

`draftTimeSummary.js` is a pure description helper; the workspace renders its output with `textContent` in a polite live status region. This is a draft preview only, not a saved chart and not a new source of event data. It performs no ephemeris calculation, database write, camera/clock action or network request. No new dependency or API key is needed.

## Bounded verification

39 targeted draft-time, template, controller and event-schema tests passed. They include winter/summer New York offsets, UTC midnight rollover, Kathmandu's quarter-hour offset, Adelaide's half-hour offset, UTC, repeated-hour choices with seconds, invalid zones/dates, missing values and spring-forward gaps.

The production build passed with existing externalization/bundle-size warnings. The existing DOM-only import/template browser check passed under its 60-second watchdog, including template occurrence, switching to the other occurrence, pending edits, DST gap, invalid zone, incomplete input and Clear form without database writes. It uses isolated IndexedDB and synthetic records, not the user's saved data or a full rendered globe. Schedule-provider conversion continues through the existing path; it was not separately live-provider tested in this checkpoint.
