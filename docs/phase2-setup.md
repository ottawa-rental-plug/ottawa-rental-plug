# Phase 2 — Go-Live Checklist (Screen + place, via SingleKey)

Phase 2 adds tenant screening to the pipeline. From the dashboard's
**Applicants** tab you can request a SingleKey screening on a matched applicant,
and the result (summary + report link) shows up in the **Screening** column.

**It works today in "manual mode"** — you can request, track, and record results
using your existing SingleKey account before any SingleKey API access. When
SingleKey grants API access, set the env vars below and it flips to the live
embedded flow automatically.

## Compliance, built in
- **Consent gate.** Screening is *blocked* unless the applicant gave timestamped
  consent at apply time (`consent_screening_at`). No consent → the request is
  refused (409) and the dashboard shows "No screening consent".
- **Data minimization.** Only a short result summary and a report *link* are ever
  stored. The raw credit/background report stays with SingleKey. Never paste raw
  report contents into the dashboard.
- **Consistent criteria.** Screening is offered for every matched applicant the
  same way (Ontario Human Rights Code). The pass/fail decision and "Approved by
  Cyril" badge come in Phase 3.

## Access model
The dashboard calls the screening function as the **signed-in agent** (your
Supabase session token) — no separate password. The SingleKey token and
Supabase service-role key stay server-side in Netlify.

## 1. Database
No new tables — the `screenings` table already ships in
[`db/schema.sql`](../db/schema.sql).

## 2. Manual mode (works now, no SingleKey API needed)
1. Dashboard → **Applicants**. Matched applicants (best match ≥ 50) who consented
   show a **Request Screening** button. Those who didn't show *No screening consent*.
2. Click **Request Screening** → it logs a screening request (stage → *Screening*,
   column shows *Requested*).
3. Run the check through your SingleKey account as you do today; the applicant pays.
4. When the result is back, click **Mark result** → Pass / Needs review, and
   optionally paste the SingleKey report link. The column updates to the summary
   (or *Failed*). Use **Re-screen** to run another check later.

> Manual mode needs only the Phase 1 env var `SUPABASE_SERVICE_ROLE_KEY`.

## 3. API mode (when SingleKey grants API access — info@singlekey.com)
Add in Netlify → **Site settings → Environment variables**:
- `SINGLEKEY_API_TOKEN` — your SingleKey API token (server-side only)
- `SINGLEKEY_BASE_URL` — `https://sandbox.singlekey.com` (testing) or `https://platform.singlekey.com` (live)
- `SINGLEKEY_WEBHOOK_SECRET` — shared secret to verify result webhooks

Then **redeploy**. Now **Request Screening** opens SingleKey's embedded flow (the
tenant completes + pays) and the result arrives automatically via the webhook —
no "Mark result" step needed.

> Before go-live, confirm SingleKey's exact request/response and webhook field
> names against their sandbox, and adjust if needed in
> [`netlify/functions/screening.js`](../netlify/functions/screening.js) (embedded-flow
> payload) and [`netlify/functions/screening-webhook.js`](../netlify/functions/screening-webhook.js)
> (outcome + token fields).

## 4. Webhook URL (API mode)
In SingleKey's dashboard, point the screening-result webhook at:

```
https://ottawarentalplug.com/.netlify/functions/screening-webhook
```

Set the same `SINGLEKEY_WEBHOOK_SECRET` value in SingleKey; it's sent as the
`x-singlekey-secret` header and mismatches are rejected. The webhook stores only
the outcome summary + report link.

## Env var summary
| Var | Mode | Purpose |
|-----|------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | both | Server-side DB writes (already set) |
| `SINGLEKEY_API_TOKEN` | API | Enables the live SingleKey embedded flow |
| `SINGLEKEY_BASE_URL` | API | `sandbox` for testing, `platform` for live |
| `SINGLEKEY_WEBHOOK_SECRET` | API | Verifies result webhooks |
