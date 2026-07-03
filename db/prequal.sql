-- ORP — pre-qualification fields for applicants.
-- Optional: the apply form and function work without these (they retry without
-- them), but adding them lets the dashboard store income + down payment so the
-- future-buyer tracker can compute pre-qualification.
-- Run in Supabase: SQL Editor -> paste -> Run. Safe to run more than once.

alter table applicants add column if not exists income       numeric;
alter table applicants add column if not exists down_payment  numeric;
