-- ORP portal — Phase 0 key/value store for the existing dashboard data.
-- One JSONB row per user per key (orpLeads, orpVacancies). RLS scopes each
-- user to their own rows. Run after schema.sql.

create table app_state (
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null,
  value      jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table app_state enable row level security;

create policy app_state_own on app_state
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
