# OpenRouter fallback request safeguards

October 6, 2026, checkpoint 138, based on `3ac8f47`. Closes the implementation
slice S1 in the L2 closeout ledger, not the whole L2 or live-voice release gate.

## Changes

`openRouterProxy()` in `vite.config.js` now has explicit dev/preview hooks and
injectable fetch/environment/timeouts for offline testing. Production defaults
still use the existing environment and global fetch; no credentials changed.

- `/api/openrouter/status` and `/chat` use the reviewed local-browser guard:
  loopback peer, local Host/socket port and same-origin request evidence before
  reading keys or inputs. Remote/custom-host access fails closed. This is not
  identity authentication or protection from a native local client forging headers.
- Status is GET-only and returns booleans/model names, never key values. Chat
  remains POST-only. All branches send no-store; denied access requests close
  the connection after the generic 403 response.
- Chat uploads use a fixed **64 KiB** buffer and a **10-second** whole-upload
  deadline, with actual-byte checks, abort/close handling and listener cleanup.
  Oversized/incomplete requests are destroyed before provider calls; on real
  sockets clients may see a reset rather than the attempted generic 400.
- Each provider attempt has a **256 KiB** actual-byte response cap and a maximum
  **15-second fetch/body deadline**, with redirects rejected and canceled/released
  streams on failure. Non-OK provider bodies are canceled without reading them.
- All fallback attempts share a **30-second upstream budget**, using monotonic
  time and the smaller remaining deadline for each attempt. It starts after upload,
  not at initial connection: upload and upstream phases have separate budgets.
  No further attempt starts after expiry; the fixed eight-model list also bounds
  attempt count. Timers require the event loop to run, not a hard realtime guarantee.
- Provider error objects, malformed JSON, empty/non-string answers and thrown
  exception text are not forwarded. Exhaustion returns fixed generic 502 text.
  Malformed/missing chat input returns a generic 400 without a provider call.
- Successful replies return only text and the selected model. System/messages,
  token cap and model order remain unchanged. The obsolete unbounded-deadline
  body reader was removed after checking it had no remaining callers.

Successful generated text is still provider content, not sanitized into a fixed
message. These changes concern error privacy and resource boundaries, not model
accuracy or output safety certification. Manual voice commands are unchanged.

## Verification and limitations

```text
node --test --test-concurrency=1 src/voice/openRouterProxySecurity.test.mjs src/voice/voiceProviderResponse.test.mjs src/voice/voiceRequestAccess.test.mjs src/voice/voiceRequestBody.test.mjs src/voice/voiceFallback.test.mjs src/voice/freeVoiceGate.test.mjs
npm run build
```

Seventeen new route checks cover both plugin hooks: local access, status/methods,
payload/model order/token cap, exception/error/malformed response failures,
unread canceled error bodies, declared and streamed overflow, shared fallback
deadline, upload stalls/aborts/overflow, no provider call on bad inputs and fresh
retry. Existing helper and free-voice selection tests run alongside them.

The first run passed the new checks but failed an existing source-string assertion
expecting `process.env.OPENAI_API_KEY`. It was updated to the injectable `env`
lookup while preserving the boolean-only requirement; new behavioral status tests
also verify it. Final counts and build result are in the finish-line tracker.

Tests use synthetic credentials and in-process streams; no live API, microphone,
actual HTTP/browser or user data access. No full-repository/allocation rerun.
The existing browser chat timeout is 20 seconds; a canceled browser request does
not yet propagate cancellation to the upstream loop, which is now bounded by its
30-second budget. Concurrency, total spend, global connection/header limits and
other proxies remain separate S2/S3 work. No new provider/model, paid call, key
write, remote push or deployment. Six release gates accepted, nine open;
hosted CI still applies to `eb1a716`, not these newer local runtime changes.
