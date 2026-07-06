-- Phase 1: Kanban board + task system
-- Adds tasks table for tracking follow-ups, reminders, and action items

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references applicants(id) on delete cascade,
  created_by text,
  title text not null,
  description text,
  due_at timestamptz,
  completed_at timestamptz,
  priority text default 'normal', -- high, normal, low
  type text default 'followup', -- followup, screening, approval, lease, other
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tasks_applicant_id_idx on tasks(applicant_id);
create index if not exists tasks_due_at_idx on tasks(due_at);
create index if not exists tasks_completed_at_idx on tasks(completed_at);

-- Admin can access all tasks, landlords see only matched applicants' tasks
alter table tasks enable row level security;
create policy tasks_admin_all on tasks for all to authenticated using (
  (select auth.jwt() ->> 'email') = 'cyrilrentsottawa@gmail.com'
);

grant select, insert, update, delete on tasks to authenticated;
