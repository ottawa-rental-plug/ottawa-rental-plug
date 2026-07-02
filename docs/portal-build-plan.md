# ORP Tenant-Placement Portal — Build Plan

The portal (`landlord.html`) evolves from a localStorage lead viewer into a
Supabase-backed tenant-placement operating system. Screening via SingleKey.

## Flow (locked)

Apply → Match → Screen + place → Approved → Nurture → Future buyer + referral

- **Match before screen** so SingleKey fees are only spent on applicants who fit a live unit.
- **Approved** is both the internal go/no-go gate and the "Approved by Cyril" reusable tenant badge — the hand-off from pipeline into the relationship moat.

## Architecture shift

| Today | Target |
|-------|--------|
| Data in browser `localStorage` (`orpLeads`, `orpVacancies`) | Supabase Postgres (cloud, multi-device, phone-synced) |
| Single shared dashboard password | Supabase Auth login for Cyril (landlord logins later via RLS) |
| Leads pulled from Netlify form submissions | Branded application writes directly to `applicants` |
| No screening / documents | SingleKey via Netlify function; PDFs in Supabase Storage |

Frontend stays static HTML; it talks to Supabase via the JS client, and to
Netlify functions for anything needing a secret (SingleKey key, webhooks).

## Data model (Postgres)

- **landlords** — id, name, email, phone, created_at
- **units** (was vacancies) — id, landlord_id, beds, baths, type, price, address, neighbourhood, status (available/rented), listed_at
- **applicants** (was leads) — id, name, email, phone, beds_wanted, budget, move_in, neighbourhood, source, stage, created_at, consent_screening_at, consent_ip
- **applications** (applicant ↔ unit) — id, applicant_id, unit_id, match_score, stage, created_at
- **screenings** — id, applicant_id, application_id, provider, provider_request_id, status (requested/completed/failed), result_summary (pass/band only — NO raw PII), report_url, consent_at, requested_at, completed_at
- **approvals** — id, applicant_id, decision, criteria_checklist (jsonb), badge_issued_at, notes, decided_by
- **activities** — id, applicant_id, type (note/sms/email/status_change), body, created_at  (the CRM timeline)
- **documents** — id, applicant_id, kind, storage_path, created_at  (files live in Supabase Storage)

**Stages:** new → matched → screening → approved → placed → nurture → future_buyer (+ declined / lost)

## Reusing what already exists

- `scoreLeadAgainstVacancy()` (beds 40 / budget 30 / timing 20 / urgency 10) moves to a shared module, used to compute `applications.match_score` when an applicant is created or a unit added.
- The dashboard UI, tabs, aging alerts, and price-drop logic stay; only the storage calls (`getLeads`/`saveLeads`/`getVacancies`) become async Supabase reads/writes.

## SingleKey wiring (Netlify function `screening.js`)

1. Agent clicks "Request screening" on a matched applicant.
2. Function calls SingleKey embedded/request flow with applicant email + property address; applicant pays SingleKey directly ("they pay").
3. Store a `screenings` row (status = requested) + consent timestamp.
4. SingleKey webhook → `screening-webhook.js` → update row with result summary + report link.
5. Portal shows result on the applicant record.

Security: SingleKey key in Netlify env; verify webhook signature; store only the
summary + link, never the raw credit/background report.

## Phases

- **Phase 0 — Foundation.** Supabase project, schema, Cyril auth, migrate existing localStorage data, swap storage layer. *Outcome: portal works identically but cloud-backed and phone-synced — fixes the localStorage problem on its own.*
- **Phase 1 — Apply + Match.** ✅ Branded application form → `applicants`; auto-match writes `applications`.
- **Phase 2 — Screen + place.** ✅ Consent-gated SingleKey screening from the Applicants tab (agent-token auth); `screenings` rows store summary + link only. Ships with a **manual mode** that works today via your SingleKey account; flips to the live embedded flow + webhook once `SINGLEKEY_API_TOKEN` is set. See [`phase2-setup.md`](phase2-setup.md).
- **Phase 3 — Approved.** ✅ Fixed criteria checklist (Human Rights Code defensible), approve/decline decision → `approvals`, "Approved by Cyril" badge, and a one-click Tenant Summary PDF. See [`phase3-approved.md`](phase3-approved.md).
- **Phase 4 — Nurture / CRM.** ✅ *(core)* Per-applicant timeline (`activities`): notes/comms logs + automatic status-change entries, and manual stage control across the full pipeline (incl. nurture / future_buyer). See [`phase4-crm.md`](phase4-crm.md). *Still open: follow-up tags/reminders and a dedicated future-buyer view.*
- **Later.** Comms hub (SMS/email), payments (Stripe), landlord client portal (RLS), compliant form mapping, mortgage affordability triggers.

## Cost

- Supabase: free tier covers solo volume; ~$25/mo at scale.
- SingleKey: per-check, passed to applicant.
- Netlify: already in use.

## Compliance guardrails (build in from day one)

- Explicit, timestamped applicant consent before any screening (PIPEDA + credit consent).
- Ontario Human Rights Code: consistent criteria for every applicant; no screening/rejection on protected grounds.
- Data minimization + retention limits; heavy PII stays with SingleKey.
- "Approved by Cyril" badge must not imply a guarantee.

## Open items to confirm before Phase 2 goes *live* (manual mode runs without them)

- SingleKey API token (info@singlekey.com) + confirm the embedded-flow request/response
  and webhook field names against their sandbox. Adjust in `screening.js` and
  `screening-webhook.js` if they differ.
- OREA Form 410 path deferred — use WEBForms export or free government forms (compliant).
