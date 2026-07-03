-- ORP Tenant-Placement Portal — Phase 0 schema
-- Run in Supabase: SQL Editor -> New query -> paste -> Run.
-- RLS is ON for every table; only an authenticated user (Cyril's login) can read/write.
-- The browser uses the anon key, which can do nothing until logged in.

create extension if not exists pgcrypto;

create type applicant_stage as enum (
  'new','matched','screening','approved','placed','nurture','future_buyer','declined','lost'
);

create table landlords (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  email       text,
  phone       text,
  created_at  timestamptz not null default now()
);

create table units (
  id            uuid primary key default gen_random_uuid(),
  landlord_id   uuid references landlords(id) on delete set null,
  client_id     text,   -- stable id from the dashboard's local vacancy list; lets "publish" upsert instead of wiping/recreating so apply links never break
  beds          int,
  baths         numeric,
  type          text,
  price         numeric,
  address       text,   -- shown once a unit is chosen, not on the public listings card
  neighbourhood text,
  description   text,   -- short public blurb shown on the listings card
  status        text not null default 'available',  -- available | rented
  listed_at     date,
  created_at    timestamptz not null default now()
);
create unique index on units (client_id) where client_id is not null;

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
  -- Self-reported affordability screening (Phase 1.5) — used to compute the
  -- rent-to-income ratio on the dashboard. Self-reported only; SingleKey (screenings
  -- table) is the verified credit/background check layer.
  monthly_income      numeric,
  employer            text,
  job_title            text,
  employment_status   text,   -- full_time | part_time | self_employed | student | unemployed | retired | other
  employment_length   text,   -- <6mo | 6-12mo | 1-2yr | 2yr+
  occupants           int,
  has_pets            boolean,
  pets_detail         text,
  -- Form-410-equivalent CRM fields (Phase 1.6). No SIN/bank/licence — see
  -- docs/portal-build-plan.md for why those stay out of a public web form.
  address_history     jsonb,  -- {current:{address,city,postal,landlord_name,landlord_phone,monthly_rent,time_there,reason_leaving}, previous:{...}|null}
  emergency_contact   jsonb,  -- {name,phone,relationship}
  personal_references jsonb,  -- [{name,phone,relationship}, ...]
  vehicle             jsonb,  -- {make_model,plate} | null
  additional_income   jsonb,  -- {source,amount} | null
  is_smoker           boolean,
  created_at          timestamptz not null default now()
);

create table applications (
  id            uuid primary key default gen_random_uuid(),
  applicant_id  uuid not null references applicants(id) on delete cascade,
  unit_id       uuid references units(id) on delete set null,
  match_score   int,
  unit_snapshot jsonb,  -- unit's beds/baths/type/price/neighbourhood/address at time of application, so later unit edits/removal never corrupt the record
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

-- Row Level Security: lock everything to logged-in users.
alter table landlords    enable row level security;
alter table units        enable row level security;
alter table applicants   enable row level security;
alter table applications enable row level security;
alter table screenings   enable row level security;
alter table approvals    enable row level security;
alter table activities   enable row level security;
alter table documents    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['landlords','units','applicants','applications','screenings','approvals','activities','documents']
  loop
    execute format(
      'create policy %I_auth_all on %I for all to authenticated using (true) with check (true);',
      t, t
    );
  end loop;
end $$;

-- Public (unauthenticated) visitors may browse available units only — this
-- is what powers the public listings page and per-unit apply links. Every
-- other table stays fully locked to Cyril's authenticated session.
create policy units_public_read on units for select to anon using (status = 'available');
