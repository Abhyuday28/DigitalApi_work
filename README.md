# Quiz Application API with Credit System

A REST API for quiz participation, scoring, and a credit wallet. Users register, receive **500 starter credits**, stake credits to join a quiz, and either earn a reward by passing or lose the stake when they fail. Administrators manage quizzes and questions. Mock payments let users top up credits for demonstration purposes.

Built for the DigitalAPI assignment with **Next.js, TypeScript, Supabase PostgreSQL/Auth, Docker, Google Cloud Run, and DigitalAPI Gateway**.

> **Current state (19 Nov 2026):** Cloud Run deployment and direct API checks are verified. Registration/login, admin authorization, quiz creation, public quiz response filtering, successful and failed attempts, wallet ledger behavior, duplicate submission handling, and one-attempt-per-user-per-quiz behavior have been exercised. A malformed quiz UUID returned HTTP `400` in production. The DigitalAPI gateway end-to-end route and several security/edge cases remain pending. This is an assignment prototype, not a production-certified service.

## Live links

| Resource | Link | Status / notes |
| --- | --- | --- |
| Cloud Run application | **https://digitalapi-quiz-qfysxyx6qa-el.a.run.app** | Public Next.js service; user-tested |
| API health | [GET /api/v1/health](https://digitalapi-quiz-qfysxyx6qa-el.a.run.app/api/v1/health) | Returned `200` with `{"data":{"status":"ok"}}` in Cloud Shell |
| OpenAPI 3.1 JSON | [GET /api/openapi.json](https://digitalapi-quiz-qfysxyx6qa-el.a.run.app/api/openapi.json) | Returned API definition in Cloud Shell |
| Cloud Run console | [digitalapi-quiz](https://console.cloud.google.com/run/detail/asia-south1/digitalapi-quiz?project=numeric-point-355211) | GCP project `numeric-point-355211`, region `asia-south1` |
| Supabase dashboard | [Project dashboard](https://supabase.com/dashboard/project/alffxumdnxfbpthzifoq) | Project targeted by app; schema/data still require independent verification |
| Supabase SQL editor | [SQL editor](https://supabase.com/dashboard/project/alffxumdnxfbpthzifoq/sql) | Apply/review migration here |
| DigitalAPI trial console | [trial.digitalapi.ai](https://trial.digitalapi.ai) | API imported; gateway routing still under investigation |
| GitHub implementation | [fix/api-contract-and-login-validation](https://github.com/Abhyuday28/DigitalApi_work/tree/fix/api-contract-and-login-validation) | Current working branch; migration commit `8f81423` is pushed |
| Engineering decisions | [DECISIONS.md](./DECISIONS.md) | Detailed rationale, limitations and release checklist |

**Cloud Run URL note:** Deployment output also displayed `https://digitalapi-quiz-608691584440.asia-south1.run.app`. Google Cloud Shell's `gcloud run services describe ... --format='value(status.url)'` returned the `qfysxyx6qa-el.a.run.app` address above; use that verified service URL consistently. These are backend URLs, **not** a confirmed DigitalAPI public gateway URL.

**DigitalAPI gateway public URL:** Not recorded/verified yet. Add it here only after a successful request through the gateway. The DigitalAPI *management portal* URL is not the API invocation URL.

## What this API includes

- Registration and login via Supabase Auth
- Authenticated listing and viewing of published quizzes, without exposing correct answers
- Quiz entry using a credit stake, plus submission and scoring
- 500 credits for new users, wallet balance, and credit transaction history
- Reward credits for passing; no reward after failing
- Mock purchases with an idempotency key (no actual payment processor)
- Protected admin endpoints to create, update and delete quizzes/questions
- Zod request validation, JSON error responses and role checks
- OpenAPI JSON contract and Docker-based Cloud Run deployment
- Starter Vitest unit tests

### Architecture

```text
      API client / DigitalAPI API Tester
                    |
                    v
      DigitalAPI Gateway (test / r1)
         routing + header forwarding
                    |
                    v
      Google Cloud Run (HTTPS)
         Next.js App Router REST API
          /api/v1/*  /api/openapi.json
                    |
       +------------+-------------+
       |                          |
       v                          v
  Supabase Auth             Supabase PostgreSQL
  session validation        quizzes / questions / attempts
  bearer tokens             wallets / credit_transactions
                            mock_payments + SQL RPC functions
```

The frontend page at `/` is intentionally minimal: this assignment's primary deliverable is the REST API.

### Why the credit system uses PostgreSQL functions

The app treats the database as the source of truth for balances. Values are stored as **integer credits**, with a wallet balance and append-only transaction records. Entry, scoring/settlement and mock purchases are implemented as SQL functions (`enter_quiz`, `submit_quiz`, `mock_purchase`) so a wallet lock, balance update and ledger entry can happen in the same database transaction.

A user can retry submission without a second reward, and a repeated mock-payment idempotency key should not add credits twice. These are **design guarantees intended by the SQL**, not verified concurrency-test results. See [DECISIONS.md](./DECISIONS.md) for known risks, particularly editing published questions while attempts are active.

## API endpoints

All routes below are relative to the Cloud Run base URL. **Protected** endpoints need `Authorization: Bearer <supabase_access_token>`.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/health` | Public | Basic HTTP health check |
| POST | `/api/v1/auth/register` | Public | Create account |
| POST | `/api/v1/auth/login` | Public | Sign in and receive token |
| GET | `/api/v1/quizzes` | User | Published quizzes |
| GET | `/api/v1/quizzes/{id}` | User | Quiz and questions (answers hidden) |
| POST | `/api/v1/quizzes/{id}/enter` | User | Stake credits and start attempt |
| POST | `/api/v1/attempts/{id}/submit` | User | Submit answers and settle result |
| GET | `/api/v1/wallet/balance` | User | Current balance |
| GET | `/api/v1/wallet/transactions` | User | Latest 100 credit transactions |
| POST | `/api/v1/payments/mock` | User | Add mock credits with idempotency key |
| GET | `/api/v1/admin/quizzes` | Admin | List all quizzes |
| POST | `/api/v1/admin/quizzes` | Admin | Create quiz |
| PATCH | `/api/v1/admin/quizzes/{id}` | Admin | Update quiz |
| DELETE | `/api/v1/admin/quizzes/{id}` | Admin | Delete quiz |
| POST | `/api/v1/admin/quizzes/{id}/questions` | Admin | Add a question |
| PATCH | `/api/v1/admin/questions/{id}` | Admin | Update question |
| DELETE | `/api/v1/admin/questions/{id}` | Admin | Delete question |

**API format:** Successful responses use `{"data": ...}`; errors use an `error` field. Protected endpoints without a bearer token return `401`. Registration may require email confirmation based on Supabase Auth settings. The current OpenAPI document lists the routes, but its request/response schemas are generic and still need expansion.

## Quick API smoke test

You can use Cloud Shell, macOS/Linux terminal, or an HTTP client.

```bash
export API_URL="https://digitalapi-quiz-qfysxyx6qa-el.a.run.app"

# Does the deployed Next.js service respond?
curl -i "$API_URL/api/v1/health"

# Is the OpenAPI document available?
curl -fsS "$API_URL/api/openapi.json" | python3 -m json.tool > /dev/null

# Expected 401 without a token (NOT a database connectivity check)
curl -i "$API_URL/api/v1/wallet/balance"
```

### Register and sign in

Use an email address you control and a strong test password. **Don't commit real credentials or access tokens.**

```bash
curl -X POST "$API_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_TEST_EMAIL","password":"YOUR_STRONG_TEST_PASSWORD"}'
```

Confirm the email if Supabase requires it, then log in:

```bash
curl -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_TEST_EMAIL","password":"YOUR_STRONG_TEST_PASSWORD"}'
```

The login response contains `data.access_token`. For the next commands, set `ACCESS_TOKEN` privately rather than putting a real token into shared screenshots, logs, or README examples:

```bash
read -rsp "Access token: " ACCESS_TOKEN
echo
curl -H "Authorization: Bearer $ACCESS_TOKEN" "$API_URL/api/v1/wallet/balance"
curl -H "Authorization: Bearer $ACCESS_TOKEN" "$API_URL/api/v1/wallet/transactions"
unset ACCESS_TOKEN
```

A newly created user's wallet should start at **500** credits **if the migration and signup trigger are correctly installed**. A healthy `/health` response by itself does not verify the database.

### Example request bodies

Create quiz (admin):

```json
{
  "title": "General Knowledge",
  "description": "Five-minute starter quiz",
  "stake": 50,
  "reward": 100,
  "pass_percentage": 60,
  "published": false
}
```

Add question to quiz (admin):

```json
{
  "prompt": "How many days are in a leap year?",
  "options": ["365", "366", "364", "367"],
  "correct_index": 1
}
```

Submit an attempt (answer values are **zero-based option indices**):

```json
{
  "answers": {
    "REPLACE_WITH_QUESTION_UUID": 1
  }
}
```

Mock payment (credits only, no real charge):

```json
{
  "amount": 100,
  "idempotency_key": "b4c39d7f-531a-4f52-b1bf-cd8772ac5490"
}
```

Use a new idempotency UUID for each new purchase; reuse the same UUID only when retrying the *same* purchase.

## Running locally

**Requirements:** Node.js 22 recommended, npm, and access to a Supabase project. Docker and Google Cloud CLI are only needed for container deployment.

```bash
git clone -b feat/nextjs-supabase-quiz-api https://github.com/Abhyuday28/DigitalApi_work.git
cd DigitalApi_work
npm install
cp .env.example .env.local
```

Configure `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://alffxumdnxfbpthzifoq.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_ROTATED_SERVER_ONLY_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

The `SUPABASE_SERVICE_ROLE_KEY` variable is read only by the server module; never add `NEXT_PUBLIC_` to its name. Use a freshly rotated secret if an older key was previously exposed. Keep `.env.local` out of source control.

Apply [`supabase/migrations/20261117000000_init.sql`](./supabase/migrations/20261117000000_init.sql) to the **intended development database**, after reviewing it. The migration creates:

`profiles`, `wallets`, `quizzes`, `questions`, `attempts`, `credit_transactions`, and `mock_payments`.

It also creates the signup trigger and credit RPC functions. The migration is **not confirmed applied** to the linked Supabase project. Do not run a non-idempotent schema migration repeatedly or against a database containing valuable data without a backup.

```bash
npm run typecheck
npm test
npm run build
npm run dev
```

Open `http://localhost:3000`, `http://localhost:3000/api/v1/health`, or `http://localhost:3000/api/openapi.json`.

### Admin setup

Admin endpoints require `profiles.role = 'admin'`. There is no public self-promotion endpoint. A trusted database administrator can assign this role for a specific account through Supabase SQL Editor after verifying the correct user ID. Never add an unauthenticated role-changing API.

## Deploying on Google Cloud Run

**Deployed configuration reported during setup:**

| Item | Value |
| --- | --- |
| GCP project ID | `numeric-point-355211` |
| Cloud Run service | `digitalapi-quiz` |
| Region | `asia-south1` |
| Container port | `8080` |
| Runtime | Node.js / Next.js standalone server |
| Supabase project ref | `alffxumdnxfbpthzifoq` |
| Secret Manager secret | `quiz-supabase-key` (expected) |

The `Dockerfile` uses the Next.js standalone output from `next.config.ts`. Cloud Run gets `SUPABASE_SERVICE_ROLE_KEY` from Google Secret Manager, never from a pasted literal key in `--set-secrets`.

After billing, required APIs, database setup, secret creation and runtime identity permissions are configured:

```bash
gcloud config set project numeric-point-355211

gcloud run deploy digitalapi-quiz \
  --source . \
  --project numeric-point-355211 \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars NEXT_PUBLIC_SUPABASE_URL=https://alffxumdnxfbpthzifoq.supabase.co,NEXT_PUBLIC_APP_URL=https://digitalapi-quiz-qfysxyx6qa-el.a.run.app \
  --set-secrets SUPABASE_SERVICE_ROLE_KEY=quiz-supabase-key:latest
```

**Caution:** Before deploying, confirm the service account has `roles/secretmanager.secretAccessor`, inspect `npm audit`, and run tests against the database. The example is a deployment template, not evidence the migration or secret rotation succeeded. Cloud Run public ingress is needed for the external gateway; protected API endpoints still require bearer tokens.

Check the current service URL and traffic with:

```bash
gcloud run services describe digitalapi-quiz \
  --project numeric-point-355211 \
  --region asia-south1 \
  --format='value(status.url)'
```

## DigitalAPI Gateway integration

1. Log in to [DigitalAPI Trial](https://trial.digitalapi.ai) and open **API Gateway → APIs**.
2. Import the JSON from the live [OpenAPI URL](https://digitalapi-quiz-qfysxyx6qa-el.a.run.app/api/openapi.json). The imported API is named **Quiz Application API with Credit System**.
3. Select the **test** environment and confirm all **17 routes** exist.
4. Create or edit an upstream target to match the Cloud Run hostname, using **HTTPS / 443**.
5. Preserve the full original route path, e.g. `GET /api/v1/health` must reach that exact path upstream. Ensure bearer `Authorization` headers are forwarded.
6. Save changes as a new revision if the deployed `r1` is read-only, then deploy to `test`.
7. In **Testing**, call `GET /api/v1/health` through the **gateway's environment endpoint**, not the management portal URL.
8. Only after successful routing and an authenticated wallet/quiz workflow, publish to the Developer Portal / Marketplace.

**Observed issue:** The initial mapped upstream was `sample-upstream.ft-gateway.digitalapicraft.com:443`. That is not our Cloud Run service. The intended target host is:

```text
digitalapi-quiz-qfysxyx6qa-el.a.run.app
```

In DigitalAPI, distinguish **hostname** (without `https://`) from a full **upstream URL** (with `https://`). A gateway `{"error_msg":"404 Route Not Found"}` response points toward gateway matching/configuration; a Next.js `{"error":"Endpoint not found"}` response points toward the backend path. A missing bearer token on wallet endpoints should return `401`, not a gateway 404.

The public gateway invocation URL and Developer Portal listing are **not yet verified**. Please do not substitute `https://trial.digitalapi.ai` as the API base URL.

## Verification checklist

### Confirmed from project and Cloud Shell output
- [x] Next.js + TypeScript route implementation exists in this branch
- [x] Database schema and SQL functions committed
- [x] TypeScript check passed
- [x] Vitest: **6 validation tests passed**
- [x] Next.js production build passed
- [x] Cloud Run deployed and served traffic
- [x] Direct Cloud Run health returned `200`
- [x] Direct OpenAPI endpoint returned JSON
- [x] DigitalAPI imported 17 routes and deployed revision `r1` in `test`

### Still needs proof
- [ ] Commit updated `package-lock.json`, re-run audit, and confirm no unresolved critical vulnerabilities
- [ ] Confirm Supabase migration was applied and all seven tables exist
- [ ] Register/login and verify first wallet balance is 500
- [ ] Demonstrate stake debit, pass reward, fail outcome and transaction history
- [ ] Test duplicate submissions, duplicate mock payments and concurrent requests
- [ ] Validate user/admin authorization and RLS behavior
- [ ] Confirm the previously exposed Supabase service-role key was rotated
- [ ] Replace DigitalAPI sample upstream and obtain `200` through the gateway
- [ ] Confirm the production OpenAPI `servers` entry is not localhost
- [ ] Publish the API in DigitalAPI Developer Portal and record its public URL
- [ ] Add precise OpenAPI schemas, integration tests, rate limits and operational monitoring

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `404 Route Not Found` in DigitalAPI Tester | Correct test environment/revision, request host, route matching, upstream binding and path rewriting |
| Direct Cloud Run health works, gateway fails | Most likely gateway configuration, especially sample upstream or base-path mismatch |
| `401 Missing bearer token` | Supply a Supabase access token in `Authorization` header |
| `403 Admin role required` | Check `profiles.role` and server-side role verification |
| `500 INTERNAL_ERROR` | Cloud Run logs, Supabase configuration, migration status; avoid exposing secrets in logs |
| Wallet missing after registration | Confirm migration, auth trigger, correct Supabase project and email-confirmation flow |
| `http://localhost:3000` appears in live OpenAPI | Set `NEXT_PUBLIC_APP_URL` on Cloud Run or correct the exported spec before gateway import |
| Cloud Run cannot load secret | Verify Secret Manager secret/version and runtime service account permissions |

## Project layout

```text
.
├── Dockerfile
├── next.config.ts
├── package.json
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── openapi.json/route.ts
│   │   │   └── v1/[...path]/route.ts
│   │   └── page.tsx
│   └── lib/
│       ├── response.ts
│       ├── schemas.ts
│       └── supabase.ts
├── supabase/
│   └── migrations/20261117000000_init.sql
├── tests/
│   └── schemas.test.ts
├── DECISIONS.md
└── README.md
```

## Engineering notes

- **Authentication:** Supabase Auth and bearer JWT validation in the server.
- **Authorization:** User vs admin role checks; server service-role credentials must remain private.
- **Validation:** Zod input schemas plus database constraints.
- **Credit integrity:** Transactional SQL RPCs and a credit ledger.
- **Testing:** Passing unit validation suite; integration and concurrency tests still outstanding.
- **Deployment:** Google Cloud Run backend live; DigitalAPI route and marketplace verification outstanding.
- **Payments:** Fake credits only. No money is collected.

For trade-offs, limitations, and the planned end-to-end demo, see **[DECISIONS.md](./DECISIONS.md)**.

---

**Maintainer note:** Update the checklist only after saving proof (test output, deployed URL, Gateway response, or screenshots). Never put a live access token, service-role key, or Secret Manager payload in this README or in a public commit.


## Verified implementation update — 19 November 2026

This section supersedes older verification notes above where they conflict.

### Additional safeguards and business rules

- **One attempt per user per quiz, ever.** The database migration `supabase/migrations/20261119060000_one_attempt_per_quiz.sql` adds `public.quiz_entries` with a unique primary key on `(user_id, quiz_id)`, and seeds it from historical attempts. The `enter_quiz` database function claims that unique entry before deducting the stake. A second entry is rejected, including after a failed or passed attempt.
- Entry, stake deduction, attempt creation, and the corresponding transaction are performed within the database function's transaction. The unique constraint is the concurrency guard against a second entry.
- **UUID path validation** was added for quiz, question, and attempt identifiers in the API route. A malformed quiz ID was tested through the production API and returned HTTP `400` rather than an internal-server error.
- **Admin authorization** is enforced using the user's `profiles.role`. A normal user attempting admin quiz creation received HTTP `403` with `Admin role required`.

### Verified behavior

- Registration and login worked; email confirmation was required for the test account before login succeeded.
- Admin quiz and question creation worked.
- Published quiz listing and quiz detail responses worked; public quiz details omitted `correct_index`.
- Quiz entry deducted the stake; a correct answer passed and credited the reward; an incorrect answer failed without a reward.
- Repeated submission did not issue a second reward.
- Wallet balance and transaction history were checked; after duplicate-entry rejection the balance remained unchanged at 510 credits.
- The production build and TypeScript checks passed, and the updated Cloud Run service was deployed in `asia-south1`.

### Still pending — do not treat as passed

- Unauthenticated protected-route response verification.
- Invalid question UUID and invalid attempt UUID production checks.
- Cross-user attempt ownership checks.
- Insufficient-wallet-balance behavior.
- Concurrent duplicate-entry test.
- Entry into an unpublished quiz.
- DigitalAPI gateway end-to-end routing and Developer Portal publication.
- Investigation of an additional historical/test attempt reference noted during wallet-ledger review.

The migration was committed as `8f81423` (`Enforce one quiz attempt per user`) and applied in the target Supabase SQL Editor. Do not expose access tokens, passwords, or Supabase service-role credentials in documentation.
