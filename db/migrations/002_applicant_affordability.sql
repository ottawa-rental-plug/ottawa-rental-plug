-- ORP Tenant-Placement Portal — migration 002
-- Adds self-reported income/employment fields used to compute the
-- rent-to-income affordability ratio on the dashboard.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (IF NOT EXISTS guards).

alter table applicants add column if not exists monthly_income    numeric;
alter table applicants add column if not exists employer          text;
alter table applicants add column if not exists job_title         text;
alter table applicants add column if not exists employment_status text;
alter table applicants add column if not exists employment_length text;
alter table applicants add column if not exists occupants         int;
alter table applicants add column if not exists has_pets          boolean;
alter table applicants add column if not exists pets_detail       text;
