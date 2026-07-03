-- Phase 5 — Landlord client portal.
-- Supabase: SQL Editor -> New query -> paste -> Run. Idempotent (safe to re-run).
--
-- SECURITY CHANGE: until now every table used one blanket policy —
--   `for all to authenticated using (true)` — meaning ANY logged-in Supabase
--   user could read/write EVERY row in EVERY table. That was safe only because
--   the one and only login was Cyril. Adding landlord logins makes that policy
--   a serious data leak (any landlord could read every other landlord's units,
--   every applicant's PII, every screening result).
--
-- This migration replaces it with:
--   - Cyril (admin, matched by email) keeps full read/write on everything, exactly
--     as before.
--   - A landlord (matched via landlords.auth_user_id = auth.uid()) can only
--     READ their own landlords row and their own units.
--   - A landlord can read a curated, PII-minimized view of applicants matched to
--     their units (name + pipeline status + screening/approval outcome — NOT
--     email/phone, so Cyril stays the single point of contact, matching the
--     brand's "you call us directly" positioning). Change ADMIN_EMAIL below or
--     extend the view if you want landlords to see contact info directly.
--   - applicants/applications/screenings/approvals/activities/documents stay
--     admin-only for direct table access; landlords only ever see the view.

-- ── 1. Link a landlords row to a Supabase Auth login ───────────────────
alter table landlords add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;
alter table landlords add column if not exists invited_at   timestamptz;

-- ── 2. Admin check (Cyril's login) ──────────────────────────────────────
-- Change this if Cyril's login email ever changes.
create or replace function is_admin() returns boolean
language sql stable as $$
  select coalesce((select auth.jwt() ->> 'email') = 'cyrilrentsottawa@gmail.com', false);
$$;

-- The landlords row (if any) tied to the current session.
create or replace function current_landlord_id() returns uuid
language sql stable as $$
  select id from landlords where auth_user_id = auth.uid();
$$;

-- ── 3. Replace the old blanket policy with role-scoped policies ────────
drop policy if exists landlords_auth_all    on landlords;
drop policy if exists units_auth_all        on units;
drop policy if exists applicants_auth_all   on applicants;
drop policy if exists applications_auth_all on applications;
drop policy if exists screenings_auth_all   on screenings;
drop policy if exists approvals_auth_all    on approvals;
drop policy if exists activities_auth_all   on activities;
drop policy if exists documents_auth_all    on documents;

-- Admin: full access, unchanged from before, on every table.
do $$
declare t text;
begin
  foreach t in array array['landlords','units','applicants','applications','screenings','approvals','activities','documents']
  loop
    execute format('create policy %I_admin_all on %I for all to authenticated using (is_admin()) with check (is_admin());', t, t);
  end loop;
end $$;

-- Landlord: read-only, scoped to their own data.
create policy landlords_self_read on landlords
  for select to authenticated
  using (is_admin() or auth_user_id = auth.uid());

create policy units_landlord_read on units
  for select to authenticated
  using (is_admin() or landlord_id = current_landlord_id());

-- applicants/applications/screenings/approvals: admin-only direct table access
-- (the admin_all policies above already cover admin). Landlords read through
-- the view below instead, which excludes applicant PII.

-- ── 4. Landlord-safe applicant view (no email/phone) ────────────────────
-- security_invoker is intentionally left at its default (false/definer-style):
-- applicants/applications/screenings/approvals only grant direct SELECT to
-- admin, so the view must run as its owner (bypassing that per-table RLS) and
-- rely on its own WHERE clause below as the actual security boundary. Run this
-- as the Supabase project owner (SQL Editor), not a restricted role.
drop view if exists landlord_applicant_view;
create view landlord_applicant_view as
select
  a.id, a.name, a.beds_wanted, a.budget, a.move_in, a.neighbourhood, a.stage, a.created_at,
  ap.unit_id, ap.match_score,
  u.beds as unit_beds, u.type as unit_type, u.price as unit_price, u.address as unit_address,
  s.status as screening_status, s.result_summary as screening_result,
  apv.decision as approval_decision, apv.badge_issued_at
from applicants a
join applications ap on ap.applicant_id = a.id
join units u on u.id = ap.unit_id
left join lateral (
  select status, result_summary from screenings
  where applicant_id = a.id order by requested_at desc limit 1
) s on true
left join lateral (
  select decision, badge_issued_at from approvals
  where applicant_id = a.id order by created_at desc limit 1
) apv on true
where is_admin() or u.landlord_id = current_landlord_id();

grant select on landlord_applicant_view to authenticated;
