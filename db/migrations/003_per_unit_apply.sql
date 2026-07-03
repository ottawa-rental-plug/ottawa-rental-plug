-- ORP Tenant-Placement Portal — migration 003
-- Per-unit application: stable unit ids for shareable apply links, public
-- read access to available units, an application-time snapshot of the unit
-- applied to, and the Form-410-equivalent applicant CRM fields (address
-- history, references, emergency contact, vehicle, additional income,
-- smoker — no SIN/bank/licence).
-- Run in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (IF NOT EXISTS guards).

alter table units add column if not exists client_id text;
alter table units add constraint units_client_id_unique unique (client_id) deferrable initially deferred;
alter table units add column if not exists address     text;
alter table units add column if not exists description text;

drop policy if exists units_public_read on units;
create policy units_public_read on units for select to anon using (status = 'available');

alter table applications add column if not exists unit_snapshot jsonb;

alter table applicants add column if not exists address_history     jsonb;
alter table applicants add column if not exists emergency_contact   jsonb;
alter table applicants add column if not exists personal_references jsonb;
alter table applicants add column if not exists vehicle             jsonb;
alter table applicants add column if not exists additional_income   jsonb;
alter table applicants add column if not exists is_smoker           boolean;
