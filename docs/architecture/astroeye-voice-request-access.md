# Local voice request access

October 6, 2026, checkpoint 136, based on `a67ed60`. Partial L2 review;
not authentication, public-hosting approval or live-voice acceptance.

## Finding and policy

The OpenAI token/HUD and diagnostic routes previously did not validate browser
origin context. The token GET can create a provider credential, so blocking only
cross-origin response reads is insufficient. Vite's broad host settings are not
a substitute for route access checks (some configurations allow all hosts).

`server/voiceRequestAccess.js` now wraps all three actual routes in both development
and preview, before key lookup, throttling, body reads, provider calls or logging:

- Require a loopback socket peer (`127.0.0.1`, `::1`, or mapped IPv4 loopback).
- Require a literal localhost, 127.0.0.1 or [::1] Host, and the socket's actual
  listening port. Other hostnames, aliases, malformed authorities and ports fail.
- Require an exact Origin matching the socket scheme/Host/port, or same-origin
  Fetch Metadata when Origin is absent (normal for same-origin GET fetch).
- Reject conflicting Origin even if metadata claims same-origin; reject null,
  cross-site, same-site, navigation, non-fetch destinations and no-cors requests.
- Missing metadata is supported only with exact Origin; no Origin and no
  same-origin metadata fails closed. Referer and forwarding headers never grant access.
- Denials return generic 403/no-store with Connection: close, without consuming
  the body or invoking downstream logic. No permissive CORS header is added.

The policy uses [W3C Fetch Metadata](https://www.w3.org/TR/fetch-metadata/) and
the [Fetch Origin header](https://fetch.spec.whatwg.org/#origin-header).
This is a deliberately strict local endpoint policy, not a general browser
compatibility claim. Header evidence is not an identity or secret.

## Compatibility and remaining scope

Current direct localhost/127.0.0.1/[::1] browser fetches remain supported. Token
GET/POST, HUD POST and diagnostic opt-in semantics are unchanged after the guard.
Direct address-bar token navigation, headerless CLI requests, LAN clients,
custom .local names, public preview URLs and reverse-proxied voice access are
intentionally denied. No bypass flag or inferred trusted-proxy list was added.
Public deployment requires a separately approved authenticated access design;
do not loosen this guard merely to make a remote request work.

Local native programs can forge headers; a compromised same-origin app is also
outside this boundary. Other proxies (including OpenRouter), global header/body/
connection/concurrency limits and provider/data/asset rights remain open. This
does not certify the entire dev server or an unauthenticated public deployment.

## Verification

```text
node --test --test-concurrency=1 src/voice/voiceRequestAccess.test.mjs src/voice/voiceRequestBody.test.mjs src/voice/openAiProxySecurity.test.mjs src/voice/voiceDiagnostics.test.mjs
npm run build
```

All 52 focused tests pass (51.161s), including eight new access tests with table
coverage for malicious/malformed/missing headers, loopback/TLS/port combinations,
early denial and successful local requests through both real plugin hooks.
Existing body/timeouts, response redaction/caps and diagnostic tests remain green.
Tests use synthetic credentials and in-process request doubles, not a live browser
or actual HTTP transport. Connection-close behavior is asserted as a response
header, not certified by a wire-level test. Build result is recorded in the tracker.

No real key, saved data or legacy log changes; no microphone, live provider call,
full-suite/allocation/browser rerun, push, hosted CI or deployment. Six accepted,
nine open. Earlier L1/CI applies to `eb1a716`, not these newer local fixes.

Next: consolidate the remaining L2 route/rights decisions into a bounded closeout
list, without adding features or repeating unchanged checks. Actual-host manual
note-marker acceptance and the other release gates are still pending.
