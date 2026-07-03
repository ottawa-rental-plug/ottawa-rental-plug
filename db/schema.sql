-- ORP Tenant-Placement Portal — Phase 0 schema
-- Run in Supabase: SQL Editor -> New query -> paste -> Run.
-- RLS is ON for every table. Cyril (admin) has full read/write everywhere;
-- a landlord login (Phase 5) can only read their own units + a PII-minimized
-- applicant view. The browser uses the anon key, which can do nothing until
-- logged in.

create extension if not exists pgcrypto;

create type applicant_stage as enum (
  'new','matched','screening','approved','placed','nurture','future_buyer','declined','lost'
);

create table landlords (
  id            uuid primary key default gen_random_uuid(),
  name          text,
  email         text,
  phone         text,
  auth_user_id  uuid unique references auth.users(id) on delete set null,  -- Phase 5 portal login
  invited_at    timestamptz,
  created_at    timestamptz not null default now()
);

create table units (
  id            uuid primary key default gen_random_uuid(),
  landlord_id   uuid references landlords(id) on delete set null,
  beds          int,
  baths         numeric,
  type          text,
  price         numeric,
  address       text,
  neighbourhood text,
  status        text not null default 'available',  -- available | rented
  listed_at     date,
  created_at    timestamptz not null default now()
);

create table applicants (
  id                  uuid primary key default gen_random_uuid(),
  name                text,
  email               text,
  phone               text,
  beds_wanted         text,
  budget              numeric,
  move_in             date,
  neighbourhood       text,
  source              text,
  stage               applicant_stage not null default 'new',
  consent_screening_at timestamptz,        -- timestamped screening consent (PIPEDA)
  consent_ip          text,
  follow_up_at        timestamptz,         -- next follow-up due (Phase 4 CRM)
  follow_up_note      text,                -- what the follow-up is about
  created_at          timestamptz not null default now()
);

create table applications (
  id            uuid primary key default gen_random_uuid(),
  applicant_id  uuid not null references applicants(id) on delete cascade,
  unit_id       uuid references units(id) on delete set null,
  match_score   int,
  stage         text,
  created_at    timestamptz not null default now()
);

-- Stores ONLY the result summary + a link. Never the raw credit/background report.
create table screenings (
  id                  uuid primary key default gen_random_uuid(),
  applicant_id        uuid not null references applicants(id) on delete cascade,
  application_id      uuid references applications(id) on delete set null,
  provider            text not null default 'singlekey',
  provider_request_id text,
  status              text not null default 'requested',  -- requested | completed | failed
  result_summary      text,   -- e.g. 'pass' / score band
  report_url          text,
  consent_at          timestamptz,
  requested_at        timestamptz not null default now(),
  completed_at        timestamptz
);

create table approvals (
  id               uuid primary key default gen_random_uuid(),
  applicant_id     uuid not null references applicants(id) on delete cascade,
  decision         text,                 -- approved | declined
  criteria_checklist jsonb,              -- fixed criteria, applied consistently (Human Rights Code)
  badge_issued_at  timestamptz,
  notes            text,
  decided_by       text,
  created_at       timestamptz not null default now()
);

create table activities (
  id            uuid primary key default gen_random_uuid(),
  applicant_id  uuid not null references applicants(id) on delete cascade,
  type          text,   -- note | sms | email | status_change
  body          text,
  created_at    timestamptz not null default now()
);

create table documents (
  id            uuid primary key default gen_random_uuid(),
  applicant_id  uuid not null references applicants(id) on delete cascade,
  kind          text,
  storage_path  text,   -- file lives in Supabase Storage
  created_at    timestamptz not null default now()
);

create index on units (status);
create index on applicants (stage);
create index on applications (applicant_id);
create index on applications (unit_id);
create index on screenings (applicant_id);
create index on activities (applicant_id);

-- Row Level Security: lock everything to logged-in users, scoped by role.
alter table landlords    enable row level security;
alter table units        enable row level security;
alter table applicants   enable row level security;
alter table applications enable row level security;
alter table screenings   enable row level security;
alter table approvals    enable row level security;
alter table activities   enable row level security;
alter table documents    enable row level security;

-- Admin check (Cyril's login). Change this if Cyril's login email ever changes.
create or replace function is_admin() returns boolean
language sql stable as $$
  select coalesce((select auth.jwt() ->> 'email') = 'cyrilrentsottawa@gmail.com', false);
$$;

-- The landlords row (if any) tied to the current session (Phase 5 portal login).
create or replace function current_landlord_id() returns uuid
language sql stable as $$
  select id from landlords where auth_user_id = auth.uid();
$$;

-- Admin: full read/write on every table.
do $$
declare t text;
begin
  foreach t in array array['landlords','units','applicants','applications','screenings','approvals','activities','documents']
  loop
    execute format(
      'create policy %I_admin_all on %I for all to authenticated using (is_admin()) with check (is_admin());',
      t, t
    );
  end loop;
end $$;

-- Landlord (Phase 5): read-only, scoped to their own data. applicants/
-- applications/screenings/approvals stay admin-only for direct table access;
-- a landlord reads applicant data only through landlord_applicant_view below,
-- which excludes email/phone so Cyril stays the single point of contact.
create policy landlords_self_read on landlords
  for select to authenticated
  using (is_admin() or auth_user_id = auth.uid());

create policy units_landlord_read on units
  for select to authenticated
  using (is_admin() or landlord_id = current_landlord_id());

-- security_invoker is intentionally left at its default (false/definer-style):
-- applicants/applications/screenings/approvals only grant direct SELECT to
-- admin, so the view must run as its owner (bypassing that per-table RLS) and
-- rely on its own WHERE clause below as the actual security boundary. Run this
-- as the Supabase project owner (SQL Editor), not a restricted role.
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
