# AstroEye reproducible candidate acceptance

October 5, 2026, checkpoint 128. **L1 accepted for candidate
`eb1a716c4bc448a27c4e5d09897814a71b0482e9`.** Six release gates accepted; nine open.

## Hosted result

The user explicitly authorized pushing the 77 accumulated commits through eb1a716
to `tk990104/t-rexx-world-engine` main and running CI, without deploying. The
fast-forward push succeeded; the remote main SHA was verified. No force push,
deployment, release tag, settings change or extra workflow dispatch occurred.

[GitHub Actions run 37403616152](https://github.com/tk990104/t-rexx-world-engine/actions/runs/37403616152)
completed successfully on its first attempt for that exact SHA. It ran from
10:20:07 to 10:25:05 p.m. America/New_York on October 5 (October 6 in UTC).

| Hosted job | Final result | Evidence |
| --- | --- | --- |
| Node 24 / ubuntu-24.04 | Success | [Linux job](https://github.com/tk990104/t-rexx-world-engine/actions/runs/37403616152/job/112076134473) |
| Node 24 / windows-2025 | Success | [Windows job](https://github.com/tk990104/t-rexx-world-engine/actions/runs/37403616152/job/112076134411) |

Both jobs completed the configured clean locked install, CI/runner contract checks,
complete unit/allocation command and production build. The workflow pins Node
24.21.0, requires the calibrated allocation gate, and does not tolerate step
failures. The final workflow and job statuses were read from GitHub's public API.
The separate Linux log-download endpoint returned HTTP 403, requiring repository
admin rights; no authentication workaround or permission change was attempted.
Therefore hosted per-test totals, skips and log-only warnings were not independently
retrieved. Do not present local counts as remotely observed counts.

## Evidence tied to this candidate

1. [Clean Windows snapshot](astroeye-clean-candidate.md), source 89468fc:
   clean installation, unchanged lock hash, all 3,413 ordinary/allocation tests
   passing with zero failures/skips/cancellations in the successful stages, seven
   CI/runner checks and production build. The initial harness timeout and bounded
   resume, npm warnings and build warnings remain recorded; this was not an
   uninterrupted first-attempt local pass.
2. [Everyday workflow and recovery](astroeye-everyday-workflow.md), plus share
   restoration, passed in checkpoint 123 on normal browser asset transport.
3. [Provider review](astroeye-provider-workspace-validation.md) and
   [Director handoff](astroeye-director-workspace-validation.md) passed in
   checkpoint 124 with synthetic provider data and simulated camera/style seams.
4. [Composed note editor and actual renderer](astroeye-map-workspace-validation.md)
   and its three-marker regression passed in checkpoint 125, using isolated storage
   and a reference mesh. Both final runs had graceful owned-browser cleanup.

Current Git comparisons establish the relevant code identity instead of assuming
old passes still apply:

- `git diff --exit-code 7368c55 eb1a716 -- src index.html style.css public package.json package-lock.json vite.config.js`
  exits 0: runtime, browser assets, dependency manifest/lock and Vite config unchanged.
- The changed paths between 89468fc and eb1a716 are only four documentation files
  and the standalone clean-candidate helper; the full test set and CI configuration
  used for the local evidence are unchanged.
- Comparing 5cb2614 to eb1a716 for the manual/share, everyday, provider, Director,
  marker-render, marker-scene, map-workspace and owned-cleanup QA scripts exits 0.

No application code or test expectations were changed to obtain this acceptance.
No passing suites or browser fixtures were rerun solely to update documentation.

## Acceptance boundary and remaining work

L1 requires a reproducible candidate: clean install on the declared runtime,
production build, complete unit results, CI and relevant browser evidence tied to
that candidate. The evidence above meets that engineering criterion. Earlier
progress notes carried the actual-host work into the L1 pending summary; that
work belongs to the separately open user-workflow/accessibility gates, rather than
requiring all other release gates to close before reproducibility can be accepted.
This clarifies the gate mapping; it does not waive any actual-host criterion.

In particular, this acceptance does **not** certify terrain, actual embedded-host
note markers, real-camera Director interaction, audible screen-reader behavior,
live voice/provider operation, astronomical accuracy, rights/security or deployment.
Browser fixture limits remain explicit. The user has not yet reported completing
the manual marker delete/Undo check. U1/R2/U2/U3 and the other release checks remain
open as before.

Accepted: A3, V1, V2, R1, R3, L1. Open: A1, A2, V3, R2, U1, U2, U3, L2, L3.
Next is the short actual-preview workflow check, followed by the remaining focused
accuracy/rights and user-authorization decisions. This documentation checkpoint is
local only; authorization for the exact earlier push does not imply another push.
