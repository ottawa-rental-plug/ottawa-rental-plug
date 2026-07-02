# Phase 4 — Nurture / CRM (core)

Phase 4 gives every applicant a lightweight CRM record so the relationship
continues past the placement — the seed of the future-buyer + referral pipeline.

## Setup
- The `activities` table already ships in [`db/schema.sql`](../db/schema.sql).
- **Follow-ups add two columns.** If your database predates Phase 4, run
  [`db/phase4-followups.sql`](../db/phase4-followups.sql) once in the Supabase
  SQL Editor (it's additive and idempotent). Fresh installs get them from
  `schema.sql`. Everything else works without it.

## What's here
From the **Applicants** tab, every row has a **Timeline** button that opens a
per-applicant panel with:

- **Stage control** — a dropdown across the full pipeline (`new → matched →
  screening → approved → placed → nurture → future_buyer`, plus `declined` /
  `lost`). Changing it updates the applicant and logs the change automatically.
- **Add to timeline** — jot a note or log a call/text/email follow-up.
- **Timeline** — every entry (notes and automatic *Stage* changes) newest-first,
  with type and timestamp.

- **Follow-up reminder** — set a date + note ("call back in 30 days"). Due
  follow-ups show a red **⏰ Due** chip on the applicant's row, and the applied
  date/note appears until then.

Screening requests and approval decisions already move the stage; those show up
here alongside your manual notes, so each applicant has one running history.

## Filters (Applicants tab)
Quick chips scope the list:
- **All**
- **Follow-ups due `(n)`** — anyone with a follow-up date at or before now.
- **Future buyers** — the `future_buyer` stage, ready for the mortgage hand-off.
- **Approved** — anyone with an approved decision.

## Data
- `activities` — `id, applicant_id, type (note|sms|email|status_change), body, created_at`.
- `applicants.follow_up_at`, `applicants.follow_up_note` — the next reminder.
- Helpers in `js/supabase-client.js`: `orpLoadActivities`, `orpAddActivity`,
  `orpSetStage` (updates the stage and writes a `status_change` entry),
  `orpSetFollowUp`.

## Still open (later)
- Comms hub (send SMS/email from the timeline) — deferred to the "Later" bucket.
- Recurring/na­gging reminders beyond a single next-follow-up date.
