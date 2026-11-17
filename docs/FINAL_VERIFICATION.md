# Quiz API — final verification checklist

**State:** This checklist is not evidence that any item passed. The owner reports that Supabase tables, Cloud Run deployment and DigitalAPI integration have been set up. Repository documentation dated 17 Nov 2026 separately records unverified flows and a prior gateway 404. Mark tasks complete only after inspecting actual results.

## Existing repository evidence (recorded; recheck after changes)
- [x] API route code and Supabase SQL migration are committed
- [x] Cloud Shell reportedly passed TypeScript check, 6 validation tests and production build
- [x] Cloud Run health reportedly returned HTTP 200, and OpenAPI JSON was reachable
- [x] DigitalAPI reportedly imported 17 routes and deployed `r1` to `test`

## Must verify for submission
- [ ] Check all seven Supabase tables and the signup trigger in the target project
- [ ] Register a fresh test user; wallet starts with **exactly 500 credits** and one signup ledger record
- [ ] Log in and obtain a bearer token; anonymous wallet request returns 401
- [ ] Admin creates quiz, creates questions and publishes it; standard user is forbidden from admin APIs
- [ ] Quiz listing excludes `correct_index`
- [ ] Enter quiz: stake deducted once, attempt and ledger debit created
- [ ] Fail a quiz: no reward; stake remains debited
- [ ] Pass a quiz: reward added once with corresponding ledger row
- [ ] Re-submit same attempt: no duplicate credit
- [ ] Mock purchase adds credits once; reusing same idempotency UUID adds zero additional credits
- [ ] Concurrent entry/submission requests never create inconsistent wallet state
- [ ] DigitalAPI gateway route responds HTTP 200 to `/api/v1/health` through the **gateway URL**, not the management console
- [ ] Gateway forwards bearer authorization; wallet/quiz calls work through gateway
- [ ] API is visible and callable from DigitalAPI Developer Portal; record listing/invocation URL
- [ ] Live OpenAPI `servers[0].url` is correct and request/response schemas sufficiently describe endpoints
- [ ] Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm audit --omit=dev`; save console outputs
- [ ] Confirm exposed service-role key rotated and runtime uses replacement (never paste key in evidence)
- [ ] Capture evidence screenshots/results and record all final URLs

## Priority
1. Verify the old gateway `404 Route Not Found` is resolved.
2. Run real Supabase wallet and quiz end-to-end workflows, including retries.
3. Confirm Developer Portal visibility and record gateway invocation URL.
4. Update project README and DECISIONS.md with **actual** dated evidence.
5. Capture final demo.

## Safe usage
The included smoke-test is read-only and checks public health, OpenAPI and protected endpoints. It does **not** prove the full credit workflow. Use throwaway test users for state-changing verification; never commit secrets or bearer tokens.
