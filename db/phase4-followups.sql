-- Phase 4 CRM — follow-up reminders on applicants.
-- Additive + safe to run on an existing database (idempotent). New installs get
-- these columns from schema.sql already; run this only if you set up before Phase 4.
-- Supabase: SQL Editor -> New query -> paste -> Run.

alter table applicants add column if not exists follow_up_at   timestamptz;
alter table applicants add column if not exists follow_up_note text;

-- Speeds up the "follow-ups due" view.
create index if not exists applicants_follow_up_at_idx on applicants (follow_up_at);
