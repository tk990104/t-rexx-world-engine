# Composed everyday workflow — checkpoint 123

October 4, 2026. Application runtime unchanged from `7368c55`; work started at
documentation checkpoint `a78d412`. This is new composed browser evidence, not a
new feature or whole-release acceptance.

## Verified together

The existing manual/share browser harness now has a bounded `--everyday` mode.
It uses the real workspace, controller, note editors and native IndexedDB in
disposable browser contexts with synthetic data only.

1. Submit a manual event at New York's repeated local time. Nothing is saved
   until the second occurrence is selected explicitly; the stored UTC time is
   November 1, 2026 at 06:30.
2. Pin that chart, advance to 06:45, start an event note, advance to 07:00 and
   save. The comparison remains pinned at 06:30 and the note capture at 06:45.
   Note text is literal, saving does not navigate, and the current chart is 07:00.
3. Save a separate notebook. The comparison report and matching-event export
   exclude both private texts; Export all includes them and exactly matches
   serialized storage.
4. Delete the event through its confirmation dialog, leaving research intact.
   Undo restores the exact original event/chart/research backup without navigation.
5. Select and delete again, review the backup, cancel, then review and explicitly
   confirm import. Review/cancel do not write; confirmation restores the exact
   backup. Reopening the note retains its captured UTC time and text.
6. Import that same full backup into a second, initially empty browser context.
   Nothing is written before confirmation. The restored bytes equal the sender's
   backup, including research workspaces. Reload the recipient document, remount,
   and reopen both note editors: saved text and captured time survive. The sender
   remains unchanged and the recipient does not navigate automatically.

The ordinary manual/share mode was also rerun after the harness changes: a fresh
recipient displays the same chart/wheel without saving, private research is
excluded, only explicit Save a copy writes, and malformed links preserve records.

## Evidence and limits

- Final everyday run: exit 0; functional checks completed by 5.663s; graceful
  owned-browser cleanup 0.944s. Fresh-profile restoration and reload both pass.
- Ordinary share regression: exit 0; functional checks completed by 5.405s;
  graceful cleanup 1.269s. Both final runs use normal browser asset transport,
  **not** the optional Node asset relay. No external requests or user data access.
- Two initial everyday runs failed because the camera test double counted a
  null-event marker clear as navigation. Inspection of `worldPresenter.js`
  confirmed production returns before navigation when the event is null. The
  harness now counts marker clears separately and asserts both deletion clears.
  A narrower run then passed before fresh-profile restoration was added. No
  runtime camera behavior or tolerance was changed to make the check pass.
- Syntax checks passed; no app build, full unit suite or allocation test was
  repeated for this QA-only change. The temporary port-5175 server was stopped.

Reproduce with an isolated Vite server and `QA_BASE_URL` pointing to it:

```text
node scripts/qa-astroeye-manual-share.mjs --everyday
node scripts/qa-astroeye-manual-share.mjs
```

Each run retains the whole-process 60-second watchdog and bounded cleanup of
only its owned pages/browser. This test uses one synthetic event and captures
download payloads through the workspace callback; it does not test native file
save dialogs. The camera is a test double. This is neither full application
bootstrap nor actual embedded-host/globe/terrain acceptance, and supplies no new
live-provider, Director playback, performance-budget or screen-reader evidence.

## Decision / next

The manual/comparison/notes/backup-recovery slice now has a repeatable composed
check, and share restoration has current normal-transport evidence. **U1 and R2
remain open** for their remaining criteria; five release checks are accepted and
ten open overall. Next: review/run the existing provider-to-reviewed-form and
Director handoff checks, then isolate the remaining actual-host/map steps. Do not
repeat this unchanged workflow unless a relevant implementation change requires it.
