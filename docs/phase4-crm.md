# Phase 4 — Nurture / CRM (core)

Phase 4 gives every applicant a lightweight CRM record so the relationship
continues past the placement — the seed of the future-buyer + referral pipeline.

No new setup: the `activities` table already ships in
[`db/schema.sql`](../db/schema.sql), read/written under your signed-in session.

## What's here
From the **Applicants** tab, every row has a **Timeline** button that opens a
per-applicant panel with:

- **Stage control** — a dropdown across the full pipeline (`new → matched →
  screening → approved → placed → nurture → future_buyer`, plus `declined` /
  `lost`). Changing it updates the applicant and logs the change automatically.
- **Add to timeline** — jot a note or log a call/text/email follow-up.
- **Timeline** — every entry (notes and automatic *Stage* changes) newest-first,
  with type and timestamp.

Screening requests and approval decisions already move the stage; those show up
here alongside your manual notes, so each applicant has one running history.

## Data
- `activities` — `id, applicant_id, type (note|sms|email|status_change), body, created_at`.
- Helpers in `js/supabase-client.js`: `orpLoadActivities`, `orpAddActivity`,
  `orpSetStage` (updates the stage and writes a `status_change` entry).

## Still open (later)
- Follow-up **tags / reminders** (e.g. "call back in 30 days") with a due view.
- A dedicated **future-buyer** list that filters the `future_buyer` stage for the
  mortgage hand-off.
- Comms hub (send SMS/email from the timeline) — deferred to the "Later" bucket.
