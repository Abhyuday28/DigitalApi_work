# DigitalAPI Quiz REST API

Next.js App Router + TypeScript + Supabase Auth/PostgreSQL. API for registration, login, quizzes, scoring, credit staking, rewards, wallet, mock payments and admin quiz management. Docker/Cloud Run ready.

## Setup
1. Run `npm install` (commit generated lockfile before deploying).
2. Copy `.env.example` to `.env.local`. Configure Supabase URL, publishable key and server-only service-role key. Never expose the service-role secret to clients.
3. Apply `supabase/migrations/20261117000000_init.sql` to the intended Supabase database.
4. Run `npm run dev`. Check `/api/v1/health` and `/api/openapi.json`.
5. Run `npm run typecheck && npm test && npm run build`.

## Endpoints
Prefix: `/api/v1`. POST `/auth/register`, POST `/auth/login`, GET `/health`, GET `/quizzes`, GET `/quizzes/:id`, POST `/quizzes/:id/enter`, POST `/attempts/:id/submit`, GET `/wallet/balance`, GET `/wallet/transactions`, POST `/payments/mock`, GET/POST `/admin/quizzes`, PATCH/DELETE `/admin/quizzes/:id`, POST `/admin/quizzes/:id/questions`, PATCH/DELETE `/admin/questions/:id`.
Protected routes accept `Authorization: Bearer <access_token>`. Submission JSON: `{"answers":{"QUESTION_UUID":1}}` (0-based answer index). Payment JSON: `{"amount":100,"idempotency_key":"UUID"}`.
Trusted database owners can promote a user by updating `public.profiles.role` to `admin`; never expose this operation publicly.

## Credits and security
The auth trigger grants 500 credits once. Wallet operations use PostgreSQL RPC functions, row locks and atomic transactions. Re-submissions and duplicate mock payments cannot pay twice. Correct answers remain server-side. RLS is enabled on all application tables; client roles are revoked direct access. Backend uses service-role credentials only on the server.

**Prototype limitation:** question editing while attempts are open may change scoring; add snapshots or lock published quiz editing. Add timeouts, production rate limits, and concurrency integration tests. Mock purchases do not process real money.

## Deployment
Build the Docker image and deploy to GCP Cloud Run with port 8080, inject Supabase URL as configuration and the server-only key via Secret Manager. Set Cloud Run base URL in `NEXT_PUBLIC_APP_URL`. Import `/api/openapi.json` into DigitalAPI Gateway (https://trial.digitalapi.ai), configure upstream and auth policy, then publish via Developer Portal. Deployment and publication require separate credentials and have not been performed.
