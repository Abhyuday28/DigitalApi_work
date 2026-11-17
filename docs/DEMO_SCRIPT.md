# Assignment demo — sequence and narration

**Opening (20–30 seconds):** “This is a REST API for a quiz application with a credit wallet. The backend uses Next.js/TypeScript, Supabase Auth/PostgreSQL, and SQL transactions for wallet changes. The service runs on Google Cloud Run and is exposed through DigitalAPI Gateway.”

1. **Architecture:** show the diagram in `DECISIONS.md`, briefly explain atomic SQL RPCs.
2. **Deployment:** open Cloud Run `/api/v1/health` and `/api/openapi.json`; show HTTP 200 responses.
3. **Gateway:** call `/api/v1/health` through the actual DigitalAPI gateway invocation URL. If it returns 404, report the blocker rather than claiming success.
4. **Auth/signup:** register a new test user and log in. Do not display actual access tokens.
5. **Wallet:** show initial 500 credits and signup transaction.
6. **Admin:** create quiz and questions, publish quiz; demonstrate standard user cannot administer quizzes.
7. **Stake:** enter quiz and show stake debit and new balance.
8. **Fail/pass:** show a failing attempt (no reward) and passing attempt (single reward). Show transaction history.
9. **Retries:** submit a completed attempt again and retry the same mock purchase UUID; balances must not increase twice.
10. **DigitalAPI Developer Portal:** show listing, documentation, gateway calls and recorded public URL.
11. **Wrap-up:** explain why SQL transactions and idempotency matter, plus limitations (concurrency tests, mutable published questions, security hardening as applicable).

**Suggested proof:** a short screen recording, redacted HTTP response captures, test reports, screenshot of the Developer Portal listing, and commit hash. Mark failed/pending items transparently.
