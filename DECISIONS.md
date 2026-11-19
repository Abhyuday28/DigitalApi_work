# Engineering decisions — Quiz API with Credits

**Project:** DigitalAPI Quiz API  
**Stack:** Next.js (App Router), TypeScript, Supabase Auth/PostgreSQL, Google Cloud Run, DigitalAPI Gateway  
**Decision status:** Accepted for the assignment prototype; production hardening still open  
**Last updated:** 19 November 2026

> This file records why the system is built this way, what has actually been checked, and what still needs work. It is not a claim that every feature has passed an end-to-end test.

## 1. What we're building

A REST API where people can sign up, log in, browse quizzes, stake credits, submit answers and see their score. An administrator manages quizzes and questions. The credit wallet starts at 500, deducts a stake on entry, awards credits on a pass, and supports mock purchases. The finished assignment also needs tests, an API contract, a containerized deployment, and exposure through DigitalAPI Gateway and its Developer Portal.

The hardest requirement is **not** returning quiz questions. It is ensuring a user's wallet never changes twice for one action, even when requests overlap or someone retries a request.

## 2. Decisions we made

### D-01 — One Next.js application for the REST API

**Decision:** Use Next.js App Router route handlers for the backend. No separate Express or FastAPI server.

**Why:** A single TypeScript project is faster to set up and easier to demonstrate. Cloud Run can run the standalone Next.js build, and the same repository holds the OpenAPI route.

**Trade-off:** Next.js isn't a dedicated API framework. We need to be disciplined about input validation, route tests, logging and HTTP response semantics. The current route is concentrated in `src/app/api/v1/[...path]/route.ts`; it should be split into domain-specific modules if it grows.

**Rejected for now:** A separate backend service. It adds deployment and operational work without solving the assignment's central problem.

### D-02 — Supabase handles identity and data

**Decision:** Supabase Auth issues sessions; Supabase PostgreSQL stores quizzes, questions, attempts, wallets and the transaction ledger.

**Why:** Managed authentication and Postgres reduce infrastructure work. We can still use proper SQL constraints and transactions.

**Boundary:** The server verifies bearer tokens through Supabase Auth. Admin permissions come from `profiles.role`, not a user-editable request field. The service-role key belongs on the server only, supplied through Google Secret Manager.

**Trade-off:** The server's service-role client bypasses RLS, so route authorization needs tests. RLS is enabled and client table permissions are restricted, but neither replaces server-side access checks.

### D-03 — Credits are an integer ledger, not client-side state

**Decision:** Store whole-number credits in `wallets.balance`. Every balance change should have a matching row in `credit_transactions`.

**Why:** Integers avoid floating-point surprises. A separate ledger makes stake, reward and purchase activity auditable.

**Rules intended by the schema:**

- Signup: create wallet with **500** credits and a single `signup` transaction.
- Entry: lock the user's wallet row, check sufficient credits, deduct stake, create an attempt and record the debit in one SQL transaction.
- Pass: finalize the attempt once, credit its reward and record a ledger entry.
- Fail: finalize the attempt, with no reward; the initial stake remains deducted.
- Mock purchase: use a client-provided idempotency UUID so retries do not credit twice.

**Why SQL functions:** A read-then-write sequence in separate HTTP requests is vulnerable to races. The `enter_quiz`, `submit_quiz` and `mock_purchase` PostgreSQL functions keep each operation inside a database transaction and lock relevant rows.

**Remaining risks:** We have not demonstrated concurrent integration tests. Also, changing published questions during an active attempt can change grading: freeze question sets or snapshot them per attempt before treating scoring as production-safe.

### D-04 — Keep answers on the server

**Decision:** The public quiz endpoint returns question prompts and options, not `correct_index`.

**Why:** Sending correct answers to the client defeats scoring integrity.

**Trade-off:** Answer validation and scoring happen inside the database function. We need tests for missing answers, invalid indices, retries and simultaneous submissions.

### D-05 — Mock payments are deliberately not real payments

**Decision:** `POST /api/v1/payments/mock` credits the wallet without charging money.

**Why:** The assignment explicitly asks for a mock payment; adding a real processor introduces scope, credentials and financial risk.

**Boundary:** No claim of funds received should be made. In a real payment system, credits would be issued only after verifying an authentic payment event.

### D-06 — Cloud Run for hosting; DigitalAPI for API exposure

**Decision:** Build a Docker image, deploy the Next.js service on Google Cloud Run (Mumbai region `asia-south1`), then route requests through DigitalAPI Gateway.

**Why:** Cloud Run provides a publicly reachable HTTPS backend without managing servers. DigitalAPI satisfies the assignment's gateway and developer portal requirements.

**Observed deployment:** Cloud Run service `digitalapi-quiz` in GCP project `numeric-point-355211`. Health returned `{"data":{"status":"ok"}}` and `/api/openapi.json` returned a specification.

**Gateway debugging note:** Importing the OpenAPI file produced 17 routes and revision `r1` was deployed to the `test` environment. API Tester returned `{"error_msg":"404 Route Not Found"}`. The mapped upstream was named `sample-upstream`, with target `sample-upstream.ft-gateway.digitalapicraft.com:443` instead of our Cloud Run host. That mismatch was identified; its correction and a successful gateway request have **not yet been confirmed**.

**Expected target:**
- Host: `digitalapi-quiz-qfysxyx6qa-el.a.run.app`
- Scheme: HTTPS; port: 443
- Forward `/api/v1/health` unchanged
- Rewrite upstream Host to the Cloud Run hostname if DigitalAPI requires it

The route URI is already `/api/v1/health`; don't rewrite paths until the upstream and environment are checked.

### D-07 — OpenAPI is a contract, not proof that the API works

**Decision:** Expose an OpenAPI 3.1 JSON document at `/api/openapi.json` and import it into DigitalAPI.

**Why:** The gateway and reviewers can discover endpoints from one place.

**Current limitation:** Request schemas in the starter specification are generic objects; response descriptions are generic, too. We should replace these with accurate Zod-derived schemas, error examples, security declarations and response status codes. The production `servers` URL must not be `http://localhost:3000`.

### D-08 — Small tests first, then realistic integration tests

**Decision:** Start with Vitest validation tests; add database/API integration coverage before calling the project complete.

**Evidence:** Cloud Shell reported TypeScript passing, 6/6 validation tests passing, and a successful Next.js production build. These checks do **not** validate credit consistency or real Supabase behavior.

**Security:** An npm audit initially reported 3 issues (including 2 critical); a later command reported 0 vulnerabilities. Re-run the audit against the installed lockfile, review changes and commit the lockfile. Do not assume the original repository dependency ranges alone prove remediation.

## 3. Architecture at a glance

```text
Client / API Tester
       |
       v
DigitalAPI Gateway  [route + auth-header forwarding]
       |
       v
Cloud Run: Next.js route handlers
       |                  |
       | JWT validation   | admin authorization
       v                  v
Supabase Auth        profiles.role
       |
       v
Supabase PostgreSQL
  quizzes / questions / attempts
  wallets / credit_transactions / mock_payments
  atomic SQL functions for balance changes
```

## 4. API surface

| Area | Endpoints |
| --- | --- |
| Health | `GET /api/v1/health` |
| Authentication | `POST /api/v1/auth/register`, `POST /api/v1/auth/login` |
| Quizzes | `GET /api/v1/quizzes`, `GET /api/v1/quizzes/{id}` |
| Participation | `POST /api/v1/quizzes/{id}/enter`, `POST /api/v1/attempts/{id}/submit` |
| Wallet | `GET /api/v1/wallet/balance`, `GET /api/v1/wallet/transactions` |
| Mock payment | `POST /api/v1/payments/mock` |
| Admin | Create/list/update/delete quizzes and add/update/delete questions |

Endpoints are defined in code. Successful authenticated end-to-end responses are still to be verified.

## 5. Review and release checklist

Use these boxes as an **evidence checklist**, not a wish list. Only tick an item when it has been observed or tested.

### Repository and build
- [x] Next.js + TypeScript starter committed to `feat/nextjs-supabase-quiz-api`
- [x] Supabase SQL migration included in repository
- [x] Cloud Shell TypeScript check passed
- [x] Vitest validation suite passed (6 tests)
- [x] Next.js production build completed
- [ ] Commit and review updated dependency lockfile
- [ ] Re-run `npm audit --omit=dev` and document results
- [ ] Add full route and database integration tests

### Supabase
- [ ] Confirm migration applied to project `alffxumdnxfbpthzifoq`
- [ ] Confirm all seven public application tables exist
- [ ] Register a fresh user and confirm exactly 500 credits
- [ ] Verify login and authenticated wallet balance
- [ ] Test insufficient stake returns an error with no debit
- [ ] Test pass and fail settlement, with ledger entries
- [ ] Test repeated submissions and concurrent entry requests
- [ ] Confirm mock purchase idempotency under retries
- [ ] Confirm admin-only endpoints reject ordinary users
- [ ] Rotate previously exposed service-role credentials and confirm Cloud Run uses the replacement

### Cloud Run and gateway
- [x] Cloud Run revision deployed and serving traffic
- [x] Direct Cloud Run health endpoint returned 200
- [x] Direct OpenAPI endpoint returned JSON
- [x] DigitalAPI specification imported (17 routes)
- [x] DigitalAPI revision r1 deployed in `test`
- [ ] Replace sample upstream target with actual Cloud Run host
- [ ] Verify `GET /api/v1/health` via DigitalAPI returns 200
- [ ] Verify authorization headers reach Next.js
- [ ] Verify login, wallet and one quiz workflow via DigitalAPI
- [ ] Publish and independently verify API in Developer Portal
- [ ] Capture final gateway URL and demo evidence

### Quality and presentation
- [ ] Expand OpenAPI request/response schemas and add example payloads
- [ ] Add automated retry/concurrency tests for wallet functions
- [ ] Prevent editing questions in active/published quizzes (or snapshot questions)
- [ ] Implement rate limits for authentication and mock payments
- [ ] Document deployment, rollback and incident diagnostics
- [ ] Record a short end-to-end demo with actual balances and ledger rows

## 6. Demo sequence for the assignment

1. Explain the architecture and why SQL functions own wallet mutations.
2. Register a user; show their 500-credit wallet and signup ledger row.
3. Sign in and retrieve an access token.
4. Create and publish a quiz as an admin; add questions.
5. Enter the quiz and show the stake debit.
6. Submit a failing attempt; show no reward.
7. Enter another quiz and pass; show a single reward credit.
8. Repeat a submission to demonstrate idempotency.
9. Purchase mock credits twice with the same idempotency key; show only one credit.
10. Run the same API calls through DigitalAPI Gateway and show the Developer Portal listing.

This is the planned demo, **not** a record of a completed demo.

## 7. What I would improve next

1. **Fix the DigitalAPI sample upstream** and get one green request through the gateway.
2. **Verify Supabase schema and wallet functions** against the target project. Until this is done, the main business requirement is unproven.
3. Add concurrency tests, immutable grading snapshots and end-to-end auth tests.
4. Make OpenAPI accurate enough for another developer to use without guessing payloads.
5. Finish the marketplace publication and capture a reproducible demonstration.

## References in this repository

- `README.md` — setup and endpoint overview
- `src/app/api/v1/[...path]/route.ts` — API route logic
- `src/lib/supabase.ts` — Supabase client and authorization
- `src/lib/schemas.ts` — Zod validation
- `supabase/migrations/20261117000000_init.sql` — schema and credit functions
- `tests/schemas.test.ts` — initial validation tests
- `Dockerfile` — Cloud Run container build

---

**Maintenance rule:** When a decision changes, update its section and record the reason. When a checklist item is checked, keep a link to the test output, commit, deployment, or screenshot that demonstrates it.


## 8. Decisions and verification update — 19 November 2026

This update records the behavior added and tested after the earlier status above. Where an earlier checklist or statement conflicts with this dated update, use the newer evidence here and in `README.md`.

### D-09 — A user may enter a given quiz only once, ever

**Decision:** Enforce one quiz entry per user per quiz, regardless of whether the previous attempt passed or failed. A retry after a failed or completed attempt is not allowed.

**Implementation:** Migration `supabase/migrations/20261119060000_one_attempt_per_quiz.sql` creates `public.quiz_entries` with a primary key on `(user_id, quiz_id)` and seeds it from historical attempts. The `enter_quiz` database function claims the entry before deducting credits. The unique constraint rejects a duplicate, including concurrent attempts to enter the same quiz. Entry claim, stake debit, attempt creation and ledger transaction are part of the same database transaction.

**Reason:** A per-attempt submission idempotency check alone does not stop a user creating a new attempt for the same quiz. A database uniqueness constraint is the authoritative guard and avoids a race-prone application-only check.

**Observed:** The migration was applied in the target Supabase SQL Editor and committed as `8f81423` (`Enforce one quiz attempt per user`). Duplicate entry was rejected and the wallet balance remained 510 credits. The concurrency guarantee follows from the database unique constraint and transaction design; a dedicated concurrent-request stress test remains pending.

### D-10 — Validate identifier formats before database lookups

**Decision:** Validate route path identifiers as UUIDs before querying or mutating records. Malformed quiz, question or attempt identifiers should produce HTTP `400`, not a database cast error or generic `500`.

**Implementation:** UUID validation is applied to quiz detail and entry routes, attempt submission, and admin quiz/question update, delete and question-creation routes.

**Observed:** A malformed quiz UUID sent to the deployed production API returned HTTP `400`. Invalid question UUID, invalid attempt UUID and the remaining admin-route malformed-ID cases are not yet confirmed by reported production test results.

### D-11 — Keep admin authorization server-side

**Decision:** Admin operations continue to require `profiles.role = 'admin'`; a normal authenticated user must not be able to create or manage quizzes/questions.

**Observed:** A normal user's request to create an admin quiz returned HTTP `403` with `Admin role required`. This confirms that tested route, not every admin route individually.

## 9. Updated verification record

### Passed and observed

- Registration and login; email confirmation was required for the test account before login succeeded.
- Admin quiz creation and question creation.
- Published quiz listing and quiz detail response; correct answer indices were not exposed in public quiz details.
- Quiz entry and stake deduction.
- Correct-answer attempt passed and credited the configured reward.
- Incorrect-answer attempt failed without a reward.
- Duplicate answer submission did not issue a second reward.
- One-entry-per-user-per-quiz rule rejected a duplicate entry without another wallet debit.
- Wallet balance and transaction history were read; balance remained 510 after duplicate-entry rejection.
- Ordinary user was denied admin quiz creation with HTTP 403.
- TypeScript check and production build passed.
- Updated Cloud Run revision deployed in `asia-south1`.
- Production malformed quiz UUID returned HTTP 400.

### Still pending

- Explicit unauthenticated protected endpoint check (expected 401).
- Invalid question UUID, invalid attempt UUID and all remaining malformed admin-ID route checks.
- Cross-user attempt ownership test (expected denial).
- Insufficient wallet balance behavior.
- Concurrent duplicate-entry integration test.
- Unpublished quiz entry behavior.
- DigitalAPI gateway end-to-end request and Developer Portal publication.
- Investigation of the additional test attempt reference found in wallet transaction history.
- Full regression and production security review.

**Evidence discipline:** Do not mark a pending item complete based solely on implementation or expected behavior. Keep credentials and bearer tokens out of Git history, logs and screenshots. The project remains an assignment prototype and is not represented as production-certified.
