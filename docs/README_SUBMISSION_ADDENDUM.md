# Submission addendum — fill only with verified results

- **Repository:** https://github.com/Abhyuday28/DigitalApi_work
- **Cloud Run base:** https://digitalapi-quiz-qfysxyx6qa-el.a.run.app (listed in repository; reconfirm before submission)
- **OpenAPI:** https://digitalapi-quiz-qfysxyx6qa-el.a.run.app/api/openapi.json
- **DigitalAPI invocation base:** `TO_VERIFY` (do not substitute trial.digitalapi.ai)
- **Developer Portal API page:** `TO_VERIFY`
- **Deployment revision / commit SHA:** `TO_RECORD`
- **Date/time of final tests:** `TO_RECORD`
- **Auth + credit workflow result:** `NOT YET VERIFIED IN THIS PACKAGE`
- **Gateway end-to-end result:** `NOT YET VERIFIED IN THIS PACKAGE`
- **Security audit outcome:** `NOT YET VERIFIED IN THIS PACKAGE`

## Smoke test
Run Node.js 20+ from the repository root after copying `scripts/smoke-test.mjs` into it:

```bash
node scripts/smoke-test.mjs
# Optional, with confirmed invocation URL:
GATEWAY_BASE_URL='https://YOUR-ACTUAL-GATEWAY-BASE' node scripts/smoke-test.mjs
# Authenticated check (do not persist the bearer token in shell history):
read -rsp 'Access token: ' TEST_ACCESS_TOKEN; echo; export TEST_ACCESS_TOKEN
node scripts/smoke-test.mjs
unset TEST_ACCESS_TOKEN
```

The tool writes `smoke-results.json` locally. Treat it as test evidence, not a replacement for live demo and integration tests. Check it for sensitive output before sharing (responses are truncated, but may still contain private data).

## Source of truth
Current content derives from README.md, DECISIONS.md, package.json, routes and tests on GitHub `main` inspected 17 Nov 2026. Existing documentation reports Cloud Run checks and an earlier DigitalAPI 404; this addendum does not imply that problem remains or has been fixed today.
