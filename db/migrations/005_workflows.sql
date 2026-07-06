-- Phase 2: Workflow automation
-- Automation rules: trigger emails, advance stages, schedule reminders

create table if not exists workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_type text not null, -- stage_change, screening_result, manual
  trigger_stage text, -- new, matched, screening, approved, placed, etc
  action_type text not null, -- send_email, advance_stage, create_task
  action_data jsonb, -- {template: 'followup', delay_hours: 0} or {next_stage: 'approved'}
  enabled boolean default true,
  created_at timestamptz default now()
);

create table if not exists workflow_executions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references workflows(id),
  applicant_id uuid references applicants(id) on delete cascade,
  executed_at timestamptz default now(),
  status text, -- pending, completed, failed
  error text
);

create index if not exists workflows_trigger_idx on workflows(trigger_type, trigger_stage);
create index if not exists workflow_executions_applicant_idx on workflow_executions(applicant_id);

alter table workflows enable row level security;
alter table workflow_executions enable row level security;

create policy workflows_admin_all on workflows for all to authenticated using (
  (select auth.jwt() ->> 'email') = 'cyrilrentsottawa@gmail.com'
);
create policy workflow_executions_admin_all on workflow_executions for all to authenticated using (
  (select auth.jwt() ->> 'email') = 'cyrilrentsottawa@gmail.com'
);

grant select, insert, update, delete on workflows to authenticated;
grant select, insert, update, delete on workflow_executions to authenticated;

-- Built-in workflows
insert into workflows (name, trigger_type, trigger_stage, action_type, action_data, enabled)
values
  ('Auto-email: Screening Ready', 'stage_change', 'screening', 'send_email', '{"template":"screening","delay_hours":0}'::jsonb, true),
  ('Auto-email: Approved!', 'stage_change', 'approved', 'send_email', '{"template":"approved","delay_hours":0}'::jsonb, true),
  ('Auto-task: Follow-up in 3 days', 'stage_change', 'matched', 'create_task', '{"title":"Follow up on application","delay_hours":72}'::jsonb, true)
on conflict do nothing;
