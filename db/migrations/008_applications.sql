-- Phase 5: Applications (link applicants to units with match scores)

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references applicants(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  match_score numeric default 0, -- 0-100 match percentage
  status text default 'pending', -- pending, approved, declined, placed
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists applications_applicant_idx on applications(applicant_id);
create index if not exists applications_unit_idx on applications(unit_id);
create index if not exists applications_status_idx on applications(status);
create index if not exists applications_match_score_idx on applications(match_score);

alter table applications enable row level security;
create policy applications_admin_all on applications for all to authenticated using (
  (select auth.jwt() ->> 'email') = 'cyrilrentsottawa@gmail.com'
);
create policy applications_landlord_view on applications for select to authenticated using (
  unit_id in (select id from units where landlord_id = auth.uid())
);

grant select, insert, update, delete on applications to authenticated;

-- Unique constraint: each applicant can only have one active application per unit
create unique index if not exists applications_unique_active on applications(applicant_id, unit_id) where status != 'declined';
